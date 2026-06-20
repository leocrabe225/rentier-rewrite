import type { Command } from "./commands";
import type { GameEvent } from "./events";
import {
  type GameState,
  type PlayerId,
  type Player,
  currentPlayer,
  playerById,
  getImprovementLevel,
  type JailedStatus,
} from "./domain/state";
import {
  BOARD_SIZE,
  boardPosition,
  type BoardPosition,
} from "./domain/position";
import type { PropertyColor } from "./domain/tiles";
import {
  FREE_PARKING_POSITION,
  groupPositions,
  JAIL_POSITION,
  tileAt,
} from "./domain/board";
import { type ImprovementLevel } from "./domain/improvementLevel";
import { JAIL_FINE, MAX_JAIL_ATTEMPTS } from "./domain/rules";

// Two dice, not one. Doubles matter for jail rules later.
export type DiceRoll = readonly [first: number, second: number];
export interface Dice {
  roll(): DiceRoll;
}

type JailedPlayer = Player & { readonly status: JailedStatus };

export interface EngineDeps {
  readonly dice: Dice;
}

export interface EngineResult {
  readonly state: GameState;
  readonly events: ReadonlyArray<GameEvent>;
}

export type RejectionReason =
  | "NotOnAProperty"
  | "InsufficientFunds"
  | "AlreadyOwned"
  | "NotAProperty"
  | "NotOwner"
  | "NotAnUpgrade"
  | "NotInJail";

export interface Accepted extends EngineResult {
  readonly status: "accepted";
}
export interface Rejected {
  readonly status: "rejected";
  readonly reason: RejectionReason;
}

export type Reduction = Accepted | Rejected;

export function reduce(
  state: GameState,
  command: Command,
  deps: EngineDeps,
): Reduction {
  switch (command.type) {
    case "RollDice":
      return rollDice(state, deps);
    case "BuyProperty":
      return buyProperty(state);
    case "ImproveProperty":
      return improveProperty(state, command);
    case "PayJailFine":
      return payJailFine(state);
    default:
      return assertNever(command);
  }
}

function rollDice(state: GameState, deps: EngineDeps): Accepted {
  const player = currentPlayer(state);

  if (isJailed(player)) {
    return rollForJail(state, player, deps);
  }

  return move(state, deps);
}

function buyProperty(state: GameState): Reduction {
  const player = currentPlayer(state);
  const tile = tileAt(player.position);

  if (tile.kind !== "property") {
    return { status: "rejected", reason: "NotOnAProperty" };
  }

  if (state.ownership.has(player.position)) {
    return { status: "rejected", reason: "AlreadyOwned" };
  }

  if (player.balance < tile.price) {
    return { status: "rejected", reason: "InsufficientFunds" };
  }

  const paid = withPlayer(state, player.id, {
    balance: player.balance - tile.price,
  });

  return {
    status: "accepted",
    state: withOwnership(paid, player.position, player.id),
    events: [
      {
        type: "PropertyBought",
        playerId: player.id,
        position: player.position,
      },
    ],
  };
}

function improveProperty(
  state: GameState,
  command: Extract<Command, { type: "ImproveProperty" }>,
): Reduction {
  const tile = tileAt(command.position);
  const player = currentPlayer(state);

  if (tile.kind !== "property") {
    return { status: "rejected", reason: "NotAProperty" };
  }

  if (state.ownership.get(command.position) !== player.id) {
    return { status: "rejected", reason: "NotOwner" };
  }

  const currentLevel = getImprovementLevel(state, command.position);
  if (command.toLevel <= currentLevel) {
    return { status: "rejected", reason: "NotAnUpgrade" };
  }

  const cost = tile.costPerLevel * (command.toLevel - currentLevel);

  if (cost > player.balance) {
    return { status: "rejected", reason: "InsufficientFunds" };
  }

  return {
    status: "accepted",
    state: withPlayer(
      withImprovement(state, command.position, command.toLevel),
      player.id,
      { balance: player.balance - cost },
    ),
    events: [
      {
        type: "PropertyImproved",
        playerId: player.id,
        position: command.position,
        level: command.toLevel,
      },
    ],
  };
}

function payJailFine(state: GameState): Reduction {
  const player = currentPlayer(state);

  if (!isJailed(player)) {
    return { status: "rejected", reason: "NotInJail" };
  }

  if (player.balance < JAIL_FINE) {
    return { status: "rejected", reason: "InsufficientFunds" };
  }

  return {
    status: "accepted",
    state: withPlayer(state, player.id, {
      balance: player.balance - JAIL_FINE,
      status: { kind: "free" },
    }),
    events: [{ type: "JailFinePaid", playerId: player.id, amount: JAIL_FINE }],
  };
}

function move(state: GameState, deps: EngineDeps): Accepted {
  const player = currentPlayer(state);
  const [a, b] = deps.dice.roll();
  const sum = a + b;

  const from = player.position;
  const raw = from + sum;
  const to = boardPosition(raw % BOARD_SIZE);

  const moved = withPlayer(state, player.id, { position: to });

  const events: GameEvent[] = [];

  events.push({ type: "Moved", playerId: player.id, from, to });
  if (raw >= BOARD_SIZE) {
    events.push({ type: "PassedGo", playerId: player.id });
  }

  const landing = applyLanding(moved, player.id, to);
  events.push(...landing.events);

  return {
    status: "accepted",
    state: landing.state,
    events,
  };
}

function rollForJail(
  state: GameState,
  player: JailedPlayer,
  deps: EngineDeps,
): Accepted {
  const [a, b] = deps.dice.roll();

  if (a === b) {
    const newState = withPlayer(state, player.id, { status: { kind: "free" } });
    const events: GameEvent[] = [
      { type: "FreedFromJail", playerId: player.id },
    ];

    const moved = move(newState, deps);
    events.push(...moved.events);
    return {
      state: moved.state,
      events: events,
      status: "accepted",
    };
  }

  const failedAttempts = player.status.failedAttempts + 1;

  if (failedAttempts < MAX_JAIL_ATTEMPTS) {
    return {
      state: withPlayer(state, player.id, {
        status: { kind: "jailed", failedAttempts: failedAttempts },
      }),
      events: [{ type: "RemainedInJail", playerId: player.id }],
      status: "accepted",
    };
  }

  return {
    state: withPlayer(state, player.id, { status: { kind: "free" } }),
    events: [{ type: "FreedFromJail", playerId: player.id }],
    status: "accepted",
  };
}

function withPlayer(
  state: GameState,
  playerId: PlayerId,
  patch: Partial<Omit<Player, "id">>,
): GameState {
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, ...patch } : p,
  );

  return {
    ...state,
    players,
  };
}

function withOwnership(
  state: GameState,
  position: BoardPosition,
  playerId: PlayerId,
): GameState {
  const ownership = new Map(state.ownership);

  ownership.set(position, playerId);
  return {
    ...state,
    ownership,
  };
}

function withImprovement(
  state: GameState,
  position: BoardPosition,
  toLevel: ImprovementLevel,
): GameState {
  const improvements = new Map(state.improvements);

  improvements.set(position, toLevel);
  return {
    ...state,
    improvements,
  };
}

function isJailed(player: Player): player is JailedPlayer {
  return player.status.kind === "jailed";
}

function applyLanding(
  state: GameState,
  playerId: PlayerId,
  position: BoardPosition,
): EngineResult {
  const tile = tileAt(position);

  switch (tile.kind) {
    case "go":
      return { state, events: [] };
    case "property": {
      const owner = state.ownership.get(position);

      if (owner === undefined) {
        return {
          state,
          events: [{ type: "LandedOnProperty", playerId, position }],
        };
      }

      if (owner === playerId) {
        return {
          state,
          events: [],
        };
      }

      const monopolyFactor = ownsWholeGroup(state, owner, tile.color) ? 2 : 1;
      const level = getImprovementLevel(state, position);
      const rent = tile.rent * level * monopolyFactor;

      return {
        state: transfer(state, playerId, owner, rent),
        events: [{ type: "RentPaid", from: playerId, to: owner, amount: rent }],
      };
    }
    case "go-to-jail": {
      return {
        state: withPlayer(state, playerId, {
          position: JAIL_POSITION,
          status: { kind: "jailed", failedAttempts: 0 },
        }),
        events: [
          { type: "Moved", playerId, from: position, to: JAIL_POSITION },
          { type: "SentToJail", playerId },
        ],
      };
    }
    case "jail":
      return { state, events: [] };
    case "freeParking": {
      const shouldDraw = (p: Player) =>
        !isJailed(p) && p.position !== FREE_PARKING_POSITION;

      const events: GameEvent[] = state.players
        .filter(shouldDraw)
        .flatMap((p) => [
          {
            type: "Moved",
            playerId: p.id,
            from: p.position,
            to: FREE_PARKING_POSITION,
          },
          { type: "DrawnToFreeParking", playerId: p.id },
        ]);

      const players: Player[] = state.players.map((p) =>
        shouldDraw(p) ? { ...p, position: FREE_PARKING_POSITION } : p,
      );

      return { events, state: { ...state, players } };
    }
    default:
      return assertNever(tile);
  }
}

function transfer(
  state: GameState,
  from: PlayerId,
  to: PlayerId,
  amount: number,
): GameState {
  const playerFrom = playerById(state, from);
  const playerTo = playerById(state, to);

  const balanceFrom = playerFrom.balance - amount;
  const balanceTo = playerTo.balance + amount;

  const newState = withPlayer(
    withPlayer(state, from, { balance: balanceFrom }),
    to,
    { balance: balanceTo },
  );

  return newState;
}

function ownsWholeGroup(
  state: GameState,
  owner: PlayerId,
  color: PropertyColor,
): boolean {
  return groupPositions(color).every(
    (pos) => state.ownership.get(pos) === owner,
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled variant : ${JSON.stringify(value)}`);
}

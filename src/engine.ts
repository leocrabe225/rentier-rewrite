import type { Command } from "./commands";
import type { GameEvent } from "./events";
import {
  type GameState,
  type Player,
  currentPlayer,
  getImprovementLevel,
  type FreePlayer,
  type JailedPlayer,
  type InPlayPlayer,
  type BankruptPlayer,
  type InPlayFields,
  inPlayPlayerById,
} from "./domain/state";
import { type PlayerId } from "./domain/playerId";
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
  railroadPositions,
  tileAt,
} from "./domain/board";
import { type ImprovementLevel } from "./domain/improvementLevel";
import {
  JAIL_FINE,
  MAX_JAIL_ATTEMPTS,
  RAILROAD_RENT_BASE,
} from "./domain/rules";
import { money, type Money } from "./domain/money";

// Two dice, not one. Doubles matter for jail rules later.
export type DiceRoll = readonly [first: number, second: number];
export interface Dice {
  roll(): DiceRoll;
}

export interface EngineDeps {
  readonly dice: Dice;
}

export interface EngineResult {
  readonly state: GameState;
  readonly events: ReadonlyArray<GameEvent>;
}

export type RejectionReason =
  | "NotBuyable"
  | "InsufficientFunds"
  | "AlreadyOwned"
  | "NotAProperty"
  | "NotOwner"
  | "NotAnUpgrade"
  | "NotInJail"
  | "Bankrupt";

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
  const player = currentPlayer(state);
  if (player.kind === "bankrupt") {
    return { status: "rejected", reason: "Bankrupt" };
  }

  switch (command.type) {
    case "RollDice":
      return rollDice(state, player, deps);
    case "BuyProperty":
      return buyProperty(state, player);
    case "ImproveProperty":
      return improveProperty(state, player, command);
    case "PayJailFine":
      return payJailFine(state, player);
    default:
      return assertNever(command);
  }
}

function rollDice(
  state: GameState,
  player: InPlayPlayer,
  deps: EngineDeps,
): Accepted {
  if (player.kind === "jailed") {
    return rollForJail(state, player, deps);
  }

  return move(state, player, deps);
}

function buyProperty(state: GameState, player: InPlayPlayer): Reduction {
  const tile = tileAt(player.position);

  if (tile.kind !== "railroad" && tile.kind !== "property") {
    return { status: "rejected", reason: "NotBuyable" };
  }

  if (state.ownership.has(player.position)) {
    return { status: "rejected", reason: "AlreadyOwned" };
  }

  if (player.balance < tile.price) {
    return { status: "rejected", reason: "InsufficientFunds" };
  }

  const paidPlayer = overrideInPlayPlayer(player, {
    balance: money(player.balance - tile.price),
  });

  return {
    status: "accepted",
    state: withOwnership(
      replacePlayer(state, paidPlayer),
      paidPlayer.position,
      paidPlayer.id,
    ),
    events: [
      {
        type: "PropertyBought",
        playerId: paidPlayer.id,
        position: paidPlayer.position,
      },
    ],
  };
}

function improveProperty(
  state: GameState,
  player: InPlayPlayer,
  command: Extract<Command, { type: "ImproveProperty" }>,
): Reduction {
  const tile = tileAt(command.position);

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

  const cost = money(tile.costPerLevel * (command.toLevel - currentLevel));

  if (cost > player.balance) {
    return { status: "rejected", reason: "InsufficientFunds" };
  }

  const paidPlayer = overrideInPlayPlayer(player, {
    balance: money(player.balance - cost),
  });

  return {
    status: "accepted",
    state: replacePlayer(
      withImprovement(state, command.position, command.toLevel),
      paidPlayer,
    ),
    events: [
      {
        type: "PropertyImproved",
        playerId: paidPlayer.id,
        position: command.position,
        level: command.toLevel,
      },
    ],
  };
}

function payJailFine(state: GameState, player: InPlayPlayer): Reduction {
  if (player.kind === "free") {
    return { status: "rejected", reason: "NotInJail" };
  }
  if (player.balance < JAIL_FINE) {
    return { status: "rejected", reason: "InsufficientFunds" };
  }

  const freePlayer = freeJailedPlayer(
    overrideJailedPlayer(player, {
      balance: money(player.balance - JAIL_FINE),
    }),
  );

  return {
    status: "accepted",
    state: replacePlayer(state, freePlayer),
    events: [{ type: "JailFinePaid", playerId: player.id, amount: JAIL_FINE }],
  };
}

function move(
  state: GameState,
  player: FreePlayer,
  deps: EngineDeps,
): Accepted {
  const [a, b] = deps.dice.roll();
  const sum = a + b;

  const from = player.position;
  const raw = from + sum;
  const to = boardPosition(raw % BOARD_SIZE);

  const movedPlayer = overrideFreePlayer(player, { position: to });
  const moved = replacePlayer(state, movedPlayer);

  const events: GameEvent[] = [];

  events.push({ type: "Moved", playerId: movedPlayer.id, from, to });
  if (raw >= BOARD_SIZE) {
    events.push({ type: "PassedGo", playerId: movedPlayer.id });
  }

  const landing = applyLanding(moved, movedPlayer);
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
    const freedPlayer = freeJailedPlayer(player);
    const newState = replacePlayer(state, freedPlayer);
    const events: GameEvent[] = [
      { type: "FreedFromJail", playerId: freedPlayer.id },
    ];

    const moved = move(newState, freedPlayer, deps);
    events.push(...moved.events);
    return {
      state: moved.state,
      events: events,
      status: "accepted",
    };
  }

  const failedAttempts = player.failedAttempts + 1;

  if (failedAttempts < MAX_JAIL_ATTEMPTS) {
    const newPlayer = overrideJailedPlayer(player, {
      failedAttempts: failedAttempts,
    });
    return {
      state: replacePlayer(state, newPlayer),
      events: [{ type: "RemainedInJail", playerId: player.id }],
      status: "accepted",
    };
  }

  return {
    state: replacePlayer(state, freeJailedPlayer(player)),
    events: [{ type: "FreedFromJail", playerId: player.id }],
    status: "accepted",
  };
}

function replacePlayer(state: GameState, player: Player): GameState {
  const players = state.players.map((p) => (p.id === player.id ? player : p));

  return {
    ...state,
    players,
  };
}

function overrideJailedPlayer(
  player: JailedPlayer,
  patch: Partial<Omit<JailedPlayer, "id">>,
): JailedPlayer {
  return {
    ...player,
    ...patch,
  };
}

function overrideInPlayPlayer(
  player: InPlayPlayer,
  patch: Partial<Omit<InPlayFields, "id">>,
): InPlayPlayer {
  return {
    ...player,
    ...patch,
  };
}

function overrideFreePlayer(
  player: FreePlayer,
  patch: Partial<Omit<FreePlayer, "id">>,
): FreePlayer {
  return {
    ...player,
    ...patch,
  };
}

function jailPlayer(player: FreePlayer): JailedPlayer {
  return {
    id: player.id,
    balance: player.balance,
    kind: "jailed",
    position: JAIL_POSITION,
    failedAttempts: 0,
  };
}

function freeJailedPlayer(player: JailedPlayer): FreePlayer {
  return {
    id: player.id,
    balance: player.balance,
    position: player.position,
    kind: "free",
  };
}

function bankruptInPlayPlayer(player: InPlayPlayer): BankruptPlayer {
  return {
    id: player.id,
    kind: "bankrupt",
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

function applyLanding(state: GameState, player: FreePlayer): EngineResult {
  const tile = tileAt(player.position);

  switch (tile.kind) {
    case "go":
      return { state, events: [] };
    case "property": {
      const ownerId = state.ownership.get(player.position);

      if (ownerId === undefined) {
        return {
          state,
          events: [
            {
              type: "LandedOnProperty",
              playerId: player.id,
              position: player.position,
            },
          ],
        };
      }

      if (ownerId === player.id) {
        return {
          state,
          events: [],
        };
      }

      const owner = inPlayPlayerById(state, ownerId);

      const monopolyFactor = ownsWholeGroup(state, owner.id, tile.color)
        ? 2
        : 1;
      const level = getImprovementLevel(state, player.position);
      const rent = money(tile.rent * level * monopolyFactor);

      return chargeRent(state, player, owner, rent);
    }
    case "railroad": {
      const ownerId = state.ownership.get(player.position);

      if (ownerId === undefined) {
        return {
          state,
          events: [
            {
              type: "LandedOnRailroad",
              playerId: player.id,
              position: player.position,
            },
          ],
        };
      }

      if (ownerId === player.id) {
        return {
          state,
          events: [],
        };
      }

      const owner = inPlayPlayerById(state, ownerId);

      const railroadAmount = getOwnedRailroad(state, owner.id).length;

      const rent = money(RAILROAD_RENT_BASE * 2 ** (railroadAmount - 1));

      return chargeRent(state, player, owner, rent);
    }
    case "go-to-jail": {
      const jailedPlayer = jailPlayer(player);
      return {
        state: replacePlayer(state, jailedPlayer),
        events: [
          {
            type: "Moved",
            playerId: player.id,
            from: player.position,
            to: JAIL_POSITION,
          },
          { type: "SentToJail", playerId: player.id },
        ],
      };
    }
    case "jail":
      return { state, events: [] };
    case "freeParking": {
      const events: GameEvent[] = state.players.flatMap((p) =>
        p.kind === "free" && p.position !== FREE_PARKING_POSITION
          ? [
              {
                type: "Moved",
                playerId: p.id,
                from: p.position,
                to: FREE_PARKING_POSITION,
              },
              { type: "DrawnToFreeParking", playerId: p.id },
            ]
          : [],
      );

      const players: Player[] = state.players.map((p) =>
        p.kind === "free" && p.position !== FREE_PARKING_POSITION
          ? { ...p, position: FREE_PARKING_POSITION }
          : p,
      );

      return { events, state: { ...state, players } };
    }
    case "tax": {
      if (player.balance < tile.amount) {
        return bankrupt(state, player);
      }
      const taxedPlayer = overrideInPlayPlayer(player, {
        balance: money(player.balance - tile.amount),
      });

      return {
        state: replacePlayer(state, taxedPlayer),
        events: [{ type: "TaxPaid", playerId: player.id, amount: tile.amount }],
      };
    }
    default:
      return assertNever(tile);
  }
}

function bankrupt(state: GameState, player: FreePlayer): EngineResult {
  const bankruptPlayer = bankruptInPlayPlayer(player);

  const newState = releaseProperties(state, bankruptPlayer.id);

  return {
    state: replacePlayer(newState, bankruptPlayer),
    events: [{ type: "WentBankrupt", playerId: bankruptPlayer.id }],
  };
}

function transfer(
  state: GameState,
  from: InPlayPlayer,
  to: InPlayPlayer,
  amount: Money,
): GameState {
  const newFrom = overrideInPlayPlayer(from, {
    balance: money(from.balance - amount),
  });
  const newTo = overrideInPlayPlayer(to, {
    balance: money(to.balance + amount),
  });

  return replacePlayer(replacePlayer(state, newFrom), newTo);
}

function chargeRent(
  state: GameState,
  from: FreePlayer,
  to: InPlayPlayer,
  rent: Money,
): EngineResult {
  if (from.balance < rent) {
    return bankrupt(state, from);
  }

  return {
    state: transfer(state, from, to, rent),
    events: [{ type: "RentPaid", from: from.id, to: to.id, amount: rent }],
  };
}

function releaseProperties(state: GameState, id: PlayerId): GameState {
  const ownership = new Map(
    [...state.ownership].filter(([, owner]) => owner !== id),
  );
  const improvements = new Map(
    [...state.improvements].filter(([pos]) => state.ownership.get(pos) !== id),
  );
  return { ...state, ownership, improvements };
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

function getOwnedRailroad(
  state: GameState,
  owner: PlayerId,
): readonly BoardPosition[] {
  return railroadPositions().filter(
    (pos) => state.ownership.get(pos) === owner,
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled variant : ${JSON.stringify(value)}`);
}

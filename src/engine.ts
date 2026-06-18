import type { Command } from "./commands";
import type { GameEvent } from "./events";
import {
  type GameState,
  type PlayerId,
  type Player,
  currentPlayer,
  playerById,
} from "./domain/state";
import {
  BOARD_SIZE,
  boardPosition,
  type BoardPosition,
} from "./domain/position";
import type { PropertyColor } from "./domain/tiles";
import { groupPositions, tileAt } from "./domain/board";

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
  | "NotOnAProperty"
  | "InsufficientFunds"
  | "AlreadyOwned";

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
    default:
      return assertNever(command);
  }
}

function rollDice(state: GameState, deps: EngineDeps): Accepted {
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

function withPlayer(
  state: GameState,
  playerId: PlayerId,
  patch: Partial<Omit<Player, "id">>,
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, ...patch } : p,
    ),
  };
}

function withOwnership(
  state: GameState,
  position: BoardPosition,
  playerId: PlayerId,
): GameState {
  const newOwnership = new Map(state.ownership);

  newOwnership.set(position, playerId);
  return {
    ...state,
    ownership: newOwnership,
  };
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
      const rent = tile.rent * monopolyFactor;

      return {
        state: transfer(state, playerId, owner, rent),
        events: [{ type: "RentPaid", from: playerId, to: owner, amount: rent }],
      };
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

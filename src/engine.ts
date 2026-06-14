import type { Command } from "./commands";
import type { GameEvent } from "./events";
import type { GameState, PlayerId, Player } from "./domain/state";
import {
  BOARD_SIZE,
  boardPosition,
  type BoardPosition,
} from "./domain/position";
import type { Tile } from "./domain/tiles";
import { tileAt } from "./domain/board";

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

export function reduce(
  state: GameState,
  command: Command,
  deps: EngineDeps,
): EngineResult {
  switch (command.type) {
    case "RollDice":
      return rollDice(state, deps);
    case "buyProperty":
      throw new Error("buyProperty: not implemented");
    default:
      return assertNever(command);
  }
}

function rollDice(state: GameState, deps: EngineDeps): EngineResult {
  const player = currentPlayer(state);

  const [a, b] = deps.dice.roll();
  const sum = a + b;

  const from = player.position;
  const raw = from + sum;
  const to = boardPosition(raw % BOARD_SIZE);

  const events: GameEvent[] = [];

  events.push({ type: "Moved", playerId: player.id, from, to });
  if (raw >= BOARD_SIZE) {
    events.push({ type: "PassedGo", playerId: player.id });
  }

  const tile = tileAt(to);
  events.push(...eventsForTile(tile, player.id, to));

  return { state: withPlayerPosition(state, player.id, to), events };
}

function currentPlayer(state: GameState): Player {
  const player = state.players.find((p) => p.id === state.currentPlayerId);

  if (player === undefined) {
    throw new Error(`Current player not found: ${state.currentPlayerId}`);
  }
  return player;
}

function withPlayerPosition(
  state: GameState,
  playerId: PlayerId,
  position: BoardPosition,
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, position } : p,
    ),
  };
}

function eventsForTile(
  tile: Tile,
  playerId: PlayerId,
  position: BoardPosition,
): ReadonlyArray<GameEvent> {
  switch (tile.kind) {
    case "go":
      return [];
    case "property":
      return [{ type: "LandedOnProperty", playerId, position }];
    default:
      return assertNever(tile);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled variant : ${JSON.stringify(value)}`);
}

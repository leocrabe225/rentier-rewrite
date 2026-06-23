import {
  BASE_IMPROVEMENT_LEVEL,
  type ImprovementLevel,
} from "./improvementLevel";
import type { Money } from "./money";
import type { BoardPosition } from "./position";

export type PlayerId = string; // Might brand this later

interface PlayerCore {
  readonly id: PlayerId;
}
export interface InPlayFields extends PlayerCore {
  readonly position: BoardPosition;
  readonly balance: Money;
}

export interface FreePlayer extends InPlayFields {
  readonly kind: "free";
}
export interface JailedPlayer extends InPlayFields {
  readonly kind: "jailed";
  readonly failedAttempts: number;
}
export interface BankruptPlayer extends PlayerCore {
  readonly kind: "bankrupt";
}
export type InPlayPlayer = FreePlayer | JailedPlayer;
export type Player = InPlayPlayer | BankruptPlayer;

export interface GameState {
  readonly players: ReadonlyArray<Player>;
  readonly currentPlayerId: PlayerId;
  readonly ownership: ReadonlyMap<BoardPosition, PlayerId>;
  readonly improvements: ReadonlyMap<BoardPosition, ImprovementLevel>;
}

export function currentPlayer(state: GameState): Player {
  return playerById(state, state.currentPlayerId);
}

export function playerById(state: GameState, id: PlayerId): Player {
  const player = state.players.find((p) => p.id === id);

  if (player === undefined) {
    throw new Error(`player not found: ${id}`);
  }
  return player;
}

export function inPlayPlayerById(state: GameState, id: PlayerId): InPlayPlayer {
  const player = playerById(state, id);
  if (player.kind === "bankrupt") {
    throw new Error(`expected an in-play player, but ${id} is bankrupt`);
  }
  return player;
}

export function getImprovementLevel(
  state: GameState,
  position: BoardPosition,
): ImprovementLevel {
  return state.improvements.get(position) ?? BASE_IMPROVEMENT_LEVEL;
}

import {
  BASE_IMPROVEMENT_LEVEL,
  type ImprovementLevel,
} from "./improvementLevel";
import type { BoardPosition } from "./position";

export type PlayerId = string; // Might brand this later

export type JailedStatus = {
  readonly kind: "jailed";
  readonly failedAttempts: number;
};
export type FreeStatus = {
  readonly kind: "free";
};

export type PlayerStatus = FreeStatus | JailedStatus;

export interface Player {
  readonly id: PlayerId;
  readonly status: PlayerStatus;
  readonly position: BoardPosition;
  readonly balance: number;
}

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

export function getImprovementLevel(
  state: GameState,
  position: BoardPosition,
): ImprovementLevel {
  return state.improvements.get(position) ?? BASE_IMPROVEMENT_LEVEL;
}

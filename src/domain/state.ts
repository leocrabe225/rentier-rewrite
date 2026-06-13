import type { BoardPosition } from "./position";

export type PlayerId = string; // Might brand this later

export interface Player {
  readonly id: PlayerId;
  readonly position: BoardPosition;
}

export interface GameState {
  readonly players: ReadonlyArray<Player>;
  readonly currentPlayerId: PlayerId;
}

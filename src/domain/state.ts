import type { BoardPosition } from "./position";

export type PlayerId = string; // Might brand this later

export interface Player {
  readonly id: PlayerId;
  readonly position: BoardPosition;
  readonly balance: number;
}

export interface GameState {
  readonly players: ReadonlyArray<Player>;
  readonly currentPlayerId: PlayerId;
  readonly ownership: ReadonlyMap<BoardPosition, PlayerId>;
}

export function currentPlayer(state: GameState): Player {
  const player = state.players.find((p) => p.id === state.currentPlayerId);

  if (player === undefined) {
    throw new Error(`Current player not found: ${state.currentPlayerId}`);
  }
  return player;
}

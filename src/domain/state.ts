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
  return playerById(state, state.currentPlayerId);
}

export function playerById(state: GameState, id: PlayerId): Player {
  const player = state.players.find((p) => p.id === id);

  if (player === undefined) {
    throw new Error(`player not found: ${id}`);
  }
  return player;
}

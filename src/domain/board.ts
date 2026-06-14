import type { BoardPosition } from "./position";
import type { Tile } from "./tiles";

// Must have exactly BOARD_SIZE entries. Guarded by the "tile at every position" test
const board: ReadonlyArray<Tile> = [
  { kind: "go" },
  { kind: "property", name: "placeholder-1" },
  { kind: "property", name: "placeholder-2" },
  { kind: "property", name: "placeholder-3" },
  { kind: "property", name: "placeholder-4" },
  { kind: "property", name: "placeholder-5" },
  { kind: "property", name: "placeholder-6" },
  { kind: "property", name: "placeholder-7" },
  { kind: "property", name: "placeholder-8" },
  { kind: "property", name: "placeholder-9" },
  { kind: "property", name: "placeholder-10" },
  { kind: "property", name: "placeholder-11" },
  { kind: "property", name: "placeholder-12" },
  { kind: "property", name: "placeholder-13" },
  { kind: "property", name: "placeholder-14" },
  { kind: "property", name: "placeholder-15" },
  { kind: "property", name: "placeholder-16" },
  { kind: "property", name: "placeholder-17" },
  { kind: "property", name: "placeholder-18" },
  { kind: "property", name: "placeholder-19" },
  { kind: "property", name: "placeholder-20" },
  { kind: "property", name: "placeholder-21" },
  { kind: "property", name: "placeholder-22" },
  { kind: "property", name: "placeholder-23" },
  { kind: "property", name: "placeholder-24" },
  { kind: "property", name: "placeholder-25" },
  { kind: "property", name: "placeholder-26" },
  { kind: "property", name: "placeholder-27" },
  { kind: "property", name: "placeholder-28" },
  { kind: "property", name: "placeholder-29" },
  { kind: "property", name: "placeholder-30" },
  { kind: "property", name: "placeholder-31" },
  { kind: "property", name: "placeholder-32" },
  { kind: "property", name: "placeholder-33" },
  { kind: "property", name: "placeholder-34" },
  { kind: "property", name: "placeholder-35" },
];

export function tileAt(position: BoardPosition): Tile {
  const tile = board[position];

  if (tile === undefined) {
    throw new Error(`${position} is out of the board bounds`);
  }

  return tile;
}

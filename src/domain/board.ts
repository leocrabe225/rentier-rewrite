import { money } from "./money";
import { BOARD_SIZE, boardPosition, type BoardPosition } from "./position";
import type { PropertyColor, Tile } from "./tiles";

export const JAIL_POSITION = boardPosition(9);
export const FREE_PARKING_POSITION = boardPosition(18);

// Must have exactly BOARD_SIZE entries. Guarded by the "tile at every position" test
const board: ReadonlyArray<Tile> = [
  { kind: "go" },
  {
    kind: "property",
    name: "placeholder-1",
    price: money(500),
    rent: money(100),
    color: "pink",
    costPerLevel: money(500),
  },
  {
    kind: "property",
    name: "placeholder-2",
    price: money(500),
    rent: money(100),
    color: "pink",
    costPerLevel: money(500),
  },
  {
    kind: "tax",
    amount: money(2000),
  },
  {
    kind: "railroad",
    price: money(2000),
  },
  {
    kind: "property",
    name: "placeholder-5",
    price: money(500),
    rent: money(100),
    color: "lime",
    costPerLevel: money(500),
  },
  {
    kind: "chance",
  },
  {
    kind: "property",
    name: "placeholder-7",
    price: money(500),
    rent: money(100),
    color: "lime",
    costPerLevel: money(500),
  },
  {
    kind: "property",
    name: "placeholder-8",
    price: money(500),
    rent: money(100),
    color: "lime",
    costPerLevel: money(500),
  },
  {
    kind: "jail",
  },
  {
    kind: "property",
    name: "placeholder-10",
    price: money(500),
    rent: money(100),
    color: "orange",
    costPerLevel: money(1000),
  },
  {
    kind: "property",
    name: "placeholder-11",
    price: money(500),
    rent: money(100),
    color: "orange",
    costPerLevel: money(1000),
  },
  {
    kind: "property",
    name: "placeholder-12",
    price: money(500),
    rent: money(100),
    color: "orange",
    costPerLevel: money(1000),
  },
  {
    kind: "railroad",
    price: money(2000),
  },
  {
    kind: "property",
    name: "placeholder-14",
    price: money(500),
    rent: money(100),
    color: "purple",
    costPerLevel: money(1000),
  },
  {
    kind: "chance",
  },
  {
    kind: "property",
    name: "placeholder-16",
    price: money(500),
    rent: money(100),
    color: "purple",
    costPerLevel: money(1000),
  },
  {
    kind: "property",
    name: "placeholder-17",
    price: money(500),
    rent: money(100),
    color: "purple",
    costPerLevel: money(1000),
  },
  {
    kind: "freeParking",
  },
  {
    kind: "property",
    name: "placeholder-19",
    price: money(500),
    rent: money(100),
    color: "red",
    costPerLevel: money(1500),
  },
  {
    kind: "chance",
  },
  {
    kind: "property",
    name: "placeholder-21",
    price: money(500),
    rent: money(100),
    color: "red",
    costPerLevel: money(1500),
  },
  {
    kind: "property",
    name: "placeholder-22",
    price: money(500),
    rent: money(100),
    color: "red",
    costPerLevel: money(1500),
  },
  {
    kind: "railroad",
    price: money(2000),
  },
  {
    kind: "property",
    name: "placeholder-24",
    price: money(500),
    rent: money(100),
    color: "yellow",
    costPerLevel: money(1500),
  },
  {
    kind: "property",
    name: "placeholder-25",
    price: money(500),
    rent: money(100),
    color: "yellow",
    costPerLevel: money(1500),
  },
  {
    kind: "property",
    name: "placeholder-26",
    price: money(500),
    rent: money(100),
    color: "yellow",
    costPerLevel: money(1500),
  },
  {
    kind: "go-to-jail",
  },
  {
    kind: "property",
    name: "placeholder-28",
    price: money(500),
    rent: money(100),
    color: "brown",
    costPerLevel: money(2000),
  },
  {
    kind: "property",
    name: "placeholder-29",
    price: money(500),
    rent: money(100),
    color: "brown",
    costPerLevel: money(2000),
  },
  {
    kind: "property",
    name: "placeholder-30",
    price: money(500),
    rent: money(100),
    color: "brown",
    costPerLevel: money(2000),
  },
  {
    kind: "railroad",
    price: money(2000),
  },
  {
    kind: "chance",
  },
  {
    kind: "property",
    name: "placeholder-33",
    price: money(500),
    rent: money(100),
    color: "darkblue",
    costPerLevel: money(2000),
  },
  {
    kind: "tax",
    amount: money(1000),
  },
  {
    kind: "property",
    name: "placeholder-35",
    price: money(500),
    rent: money(100),
    color: "darkblue",
    costPerLevel: money(2000),
  },
];

export function tileAt(position: BoardPosition): Tile {
  const tile = board[position];

  if (tile === undefined) {
    throw new Error(`${position} is out of the board bounds`);
  }

  return tile;
}

export function groupPositions(color: PropertyColor): readonly BoardPosition[] {
  const positions: BoardPosition[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = boardPosition(i);
    const tile = tileAt(pos);
    if (tile.kind === "property" && tile.color === color) positions.push(pos);
  }
  return positions;
}

export function railroadPositions(): readonly BoardPosition[] {
  const positions: BoardPosition[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = boardPosition(i);
    if (tileAt(pos).kind === "railroad") positions.push(pos);
  }
  return positions;
}

export function propertyPositions(): readonly BoardPosition[] {
  const positions: BoardPosition[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = boardPosition(i);
    if (tileAt(pos).kind === "property") positions.push(pos);
  }
  return positions;
}

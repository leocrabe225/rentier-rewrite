import { BOARD_SIZE, boardPosition, type BoardPosition } from "./position";
import type { PropertyColor, Tile } from "./tiles";

// Must have exactly BOARD_SIZE entries. Guarded by the "tile at every position" test
const board: ReadonlyArray<Tile> = [
  { kind: "go" },
  {
    kind: "property",
    name: "placeholder-1",
    price: 500,
    rent: 100,
    color: "pink",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-2",
    price: 500,
    rent: 100,
    color: "pink",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-3",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-4",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-5",
    price: 500,
    rent: 100,
    color: "lime",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-6",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-7",
    price: 500,
    rent: 100,
    color: "lime",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-8",
    price: 500,
    rent: 100,
    color: "lime",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-9",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-10",
    price: 500,
    rent: 100,
    color: "orange",
    costPerLevel: 1000,
  },
  {
    kind: "property",
    name: "placeholder-11",
    price: 500,
    rent: 100,
    color: "orange",
    costPerLevel: 1000,
  },
  {
    kind: "property",
    name: "placeholder-12",
    price: 500,
    rent: 100,
    color: "orange",
    costPerLevel: 1000,
  },
  {
    kind: "property",
    name: "placeholder-13",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-14",
    price: 500,
    rent: 100,
    color: "purple",
    costPerLevel: 1000,
  },
  {
    kind: "property",
    name: "placeholder-15",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-16",
    price: 500,
    rent: 100,
    color: "purple",
    costPerLevel: 1000,
  },
  {
    kind: "property",
    name: "placeholder-17",
    price: 500,
    rent: 100,
    color: "purple",
    costPerLevel: 1000,
  },
  {
    kind: "property",
    name: "placeholder-18",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-19",
    price: 500,
    rent: 100,
    color: "red",
    costPerLevel: 1500,
  },
  {
    kind: "property",
    name: "placeholder-20",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-21",
    price: 500,
    rent: 100,
    color: "red",
    costPerLevel: 1500,
  },
  {
    kind: "property",
    name: "placeholder-22",
    price: 500,
    rent: 100,
    color: "red",
    costPerLevel: 1500,
  },
  {
    kind: "property",
    name: "placeholder-23",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-24",
    price: 500,
    rent: 100,
    color: "yellow",
    costPerLevel: 1500,
  },
  {
    kind: "property",
    name: "placeholder-25",
    price: 500,
    rent: 100,
    color: "yellow",
    costPerLevel: 1500,
  },
  {
    kind: "property",
    name: "placeholder-26",
    price: 500,
    rent: 100,
    color: "yellow",
    costPerLevel: 1500,
  },
  {
    kind: "property",
    name: "placeholder-27",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-28",
    price: 500,
    rent: 100,
    color: "brown",
    costPerLevel: 2000,
  },
  {
    kind: "property",
    name: "placeholder-29",
    price: 500,
    rent: 100,
    color: "brown",
    costPerLevel: 2000,
  },
  {
    kind: "property",
    name: "placeholder-30",
    price: 500,
    rent: 100,
    color: "brown",
    costPerLevel: 2000,
  },
  {
    kind: "property",
    name: "placeholder-31",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-32",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-33",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 2000,
  },
  {
    kind: "property",
    name: "placeholder-34",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 500,
  },
  {
    kind: "property",
    name: "placeholder-35",
    price: 500,
    rent: 100,
    color: "darkblue",
    costPerLevel: 2000,
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

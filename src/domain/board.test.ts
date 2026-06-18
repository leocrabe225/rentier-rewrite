import { describe, it, expect } from "vitest";
import { BOARD_SIZE, boardPosition } from "./position";
import { tileAt } from "./board";
import type { PropertyColor } from "./tiles";

describe("board", () => {
  it("has Go at position 0", () => {
    expect(tileAt(boardPosition(0))).toEqual({ kind: "go" });
  });

  it("has a property at position 1", () => {
    expect(tileAt(boardPosition(1)).kind).toBe("property");
  });

  // Not just checking the array size allows to keep the array private
  it("has a tile at every board position", () => {
    for (let i = 0; i < BOARD_SIZE; i++) {
      expect(() => tileAt(boardPosition(i))).not.toThrow();
    }
  });

  it("has no singleton color groups. Every color appears at least twice", () => {
    const counts = new Map<PropertyColor, number>();
    for (let i = 0; i < BOARD_SIZE; i++) {
      const tile = tileAt(boardPosition(i));
      if (tile.kind === "property") {
        counts.set(tile.color, (counts.get(tile.color) ?? 0) + 1);
      }
    }

    // Ensures that the board has colors, not just a green test with nothing checked.
    expect(counts.size).toBeGreaterThan(0);

    for (const [color, count] of counts) {
      expect(
        count,
        `color "${color}" has ${count} member(s)`,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

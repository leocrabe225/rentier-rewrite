import { describe, it, expect } from "vitest";
import { BOARD_SIZE, boardPosition } from "./position";
import { tileAt } from "./board";

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
});

import { describe, expect, it } from "vitest";
import { BOARD_SIZE, boardPosition } from "./position";

describe("boardPosition", () => {
  it("accepts a position within range", () => {
    expect(() => boardPosition(3)).not.toThrow();
  });

  it("rejects a non-integer position", () => {
    expect(() => boardPosition(3.5)).toThrow(RangeError);
  });

  it("rejects a position below 0", () => {
    expect(() => boardPosition(-1)).toThrow(RangeError);
  });

  it("rejects a position above the maximum", () => {
    expect(() => boardPosition(BOARD_SIZE)).toThrow(RangeError);
  });

  it("accepts the biggest position", () => {
    expect(() => boardPosition(BOARD_SIZE - 1)).not.toThrow();
  });

  it("accepts the smallest position", () => {
    expect(() => boardPosition(0)).not.toThrow();
  });
});

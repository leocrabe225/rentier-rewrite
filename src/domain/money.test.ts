import { describe, expect, it } from "vitest";
import { money } from "./money";

describe("money", () => {
  it("accepts a non-negative integer", () => {
    expect(() => money(500)).not.toThrow();
  });

  it("rejects a non-integer amount", () => {
    expect(() => money(500.5)).toThrow(RangeError);
  });

  it("rejects a negative amount", () => {
    expect(() => money(-1)).toThrow(RangeError);
  });

  it("accepts zero", () => {
    expect(() => money(0)).not.toThrow();
  });
});

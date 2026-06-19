import { describe, expect, it } from "vitest";
import {
  MAX_IMPROVEMENT_LEVEL,
  MIN_IMPROVEMENT_LEVEL,
} from "./improvementLevel";
import { improvementLevel } from "./improvementLevel";

describe("improvementLevel", () => {
  it("accepts a level within range", () => {
    expect(() => improvementLevel(3)).not.toThrow();
  });

  it("rejects a non-integer level", () => {
    expect(() => improvementLevel(3.5)).toThrow(RangeError);
  });

  it("rejects a level below 1", () => {
    expect(() => improvementLevel(0)).toThrow(RangeError);
  });

  it("rejects a level above the maximum", () => {
    expect(() => improvementLevel(MAX_IMPROVEMENT_LEVEL + 1)).toThrow(
      RangeError,
    );
  });

  it("accepts the maximum level", () => {
    expect(() => improvementLevel(MAX_IMPROVEMENT_LEVEL)).not.toThrow();
  });

  it("accepts the minimum level", () => {
    expect(() => improvementLevel(MIN_IMPROVEMENT_LEVEL)).not.toThrow();
  });
});

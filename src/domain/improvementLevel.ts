export const MIN_IMPROVEMENT_LEVEL = 1;
export const MAX_IMPROVEMENT_LEVEL = 5;

declare const improvementLevelBrand: unique symbol;
export type ImprovementLevel = number & {
  readonly [improvementLevelBrand]: true;
};

export function improvementLevel(n: number): ImprovementLevel {
  if (
    !Number.isInteger(n) ||
    n < MIN_IMPROVEMENT_LEVEL ||
    n > MAX_IMPROVEMENT_LEVEL
  ) {
    throw new RangeError(`improvementLevel out of range ${n}`);
  }
  return n as ImprovementLevel;
}

export const BASE_IMPROVEMENT_LEVEL = improvementLevel(1);

export const BOARD_SIZE = 36;

declare const positionBrand: unique symbol;
export type BoardPosition = number & { readonly [positionBrand]: true };

export function boardPosition(n: number): BoardPosition {
  if (!Number.isInteger(n) || n < 0 || n >= BOARD_SIZE) {
    throw new RangeError(`Position out of range ${n}`);
  }
  return n as BoardPosition;
}

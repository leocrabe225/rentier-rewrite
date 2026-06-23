declare const moneyBrand: unique symbol;
export type Money = number & { readonly [moneyBrand]: true };

export function money(n: number): Money {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`Amount not representable ${n}`);
  }
  return n as Money;
}

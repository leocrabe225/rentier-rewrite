declare const playerIdBrand: unique symbol;
export type PlayerId = string & { readonly [playerIdBrand]: true };

export function playerId(s: string): PlayerId {
  return s as PlayerId;
}

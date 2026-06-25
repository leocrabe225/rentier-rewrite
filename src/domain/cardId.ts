declare const cardIdBrand: unique symbol;

export type CardId = string & { readonly [cardIdBrand]: true };

export function cardId(s: string): CardId {
  return s as CardId;
}

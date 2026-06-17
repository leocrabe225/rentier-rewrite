export type Command =
  | { readonly type: "RollDice" }
  | { readonly type: "BuyProperty" };

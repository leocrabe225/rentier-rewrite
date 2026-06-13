export type Command =
  | { readonly type: "RollDice" }
  | { readonly type: "buyProperty" };
// A union of one today. Which will grow ("BuyProperty", etc ..)

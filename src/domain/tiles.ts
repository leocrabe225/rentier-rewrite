import type { Money } from "./money";

export type PropertyColor =
  | "pink"
  | "lime"
  | "orange"
  | "purple"
  | "red"
  | "yellow"
  | "brown"
  | "darkblue";

export type Tile =
  | { readonly kind: "go" }
  | {
      readonly kind: "property";
      readonly name: string;
      readonly color: PropertyColor;
      readonly price: Money;
      readonly rent: Money;
      readonly costPerLevel: Money;
    }
  | {
      readonly kind: "go-to-jail";
    }
  | {
      readonly kind: "jail";
    }
  | {
      readonly kind: "freeParking";
    }
  | {
      readonly kind: "tax";
      readonly amount: Money;
    }
  | {
      readonly kind: "railroad";
      readonly price: Money;
    }
  | { readonly kind: "chance" };

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
      readonly price: number;
      readonly rent: number;
      readonly costPerLevel: number;
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
      readonly amount: number;
    };

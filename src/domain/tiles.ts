export type Tile =
  | { readonly kind: "go" }
  | { readonly kind: "property"; readonly name: string };

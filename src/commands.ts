import type { ImprovementLevel } from "./domain/improvementLevel";
import type { BoardPosition } from "./domain/position";

export type Command =
  | { readonly type: "RollDice" }
  | { readonly type: "BuyProperty" }
  | {
      readonly type: "ImproveProperty";
      readonly position: BoardPosition;
      readonly toLevel: ImprovementLevel;
    }
  | { readonly type: "PayJailFine" };

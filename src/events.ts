import type { BoardPosition } from "./domain/position";
import type { PlayerId } from "./domain/state";

export type GameEvent =
  | {
      readonly type: "Moved";
      readonly playerId: PlayerId;
      readonly from: BoardPosition;
      readonly to: BoardPosition;
    }
  | { readonly type: "PassedGo"; readonly playerId: PlayerId }
  | {
      readonly type: "LandedOnProperty";
      readonly playerId: PlayerId;
      readonly position: BoardPosition;
    }
  | {
      readonly type: "PropertyBought";
      readonly playerId: PlayerId;
      readonly position: BoardPosition;
    };

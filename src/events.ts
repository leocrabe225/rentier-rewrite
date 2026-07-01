import type { ImprovementLevel } from "./domain/improvementLevel";
import type { Money } from "./domain/money";
import type { BoardPosition } from "./domain/position";
import type { PlayerId } from "./domain/playerId";
import type { CardId } from "./domain/cardId";

export type GameEvent =
  | {
      readonly type: "Moved";
      readonly playerId: PlayerId;
      readonly from: BoardPosition;
      readonly to: BoardPosition;
    }
  | {
      readonly type: "PassedGo";
      readonly playerId: PlayerId;
      readonly amount: Money;
    }
  | {
      readonly type: "LandedOnProperty";
      readonly playerId: PlayerId;
      readonly position: BoardPosition;
    }
  | { readonly type: "SentToJail"; readonly playerId: PlayerId }
  | { readonly type: "RemainedInJail"; readonly playerId: PlayerId }
  | { readonly type: "FreedFromJail"; readonly playerId: PlayerId }
  | {
      readonly type: "JailFinePaid";
      readonly playerId: PlayerId;
      readonly amount: Money;
    }
  | {
      readonly type: "PropertyBought";
      readonly playerId: PlayerId;
      readonly position: BoardPosition;
    }
  | {
      readonly type: "RentPaid";
      readonly from: PlayerId;
      readonly to: PlayerId;
      readonly amount: Money;
    }
  | {
      readonly type: "PropertyImproved";
      readonly playerId: PlayerId;
      readonly position: BoardPosition;
      readonly level: ImprovementLevel;
    }
  | { readonly type: "DrawnToFreeParking"; readonly playerId: PlayerId }
  | { readonly type: "WentBankrupt"; readonly playerId: PlayerId }
  | {
      readonly type: "TaxPaid";
      readonly playerId: PlayerId;
      readonly amount: Money;
    }
  | {
      readonly type: "LandedOnRailroad";
      readonly playerId: PlayerId;
      readonly position: BoardPosition;
    }
  | {
      readonly type: "CardDrawn";
      readonly playerId: PlayerId;
      readonly cardId: CardId;
    }
  | {
      readonly type: "ReceivedFromBank";
      readonly playerId: PlayerId;
      readonly amount: Money;
    }
  | {
      readonly type: "PaidToBank";
      readonly playerId: PlayerId;
      readonly amount: Money;
    }
  | { readonly type: "PurchaseDeclined"; readonly playerId: PlayerId }
  | { readonly type: "TurnBegan"; readonly playerId: PlayerId }
  | { readonly type: "PlayerWon"; readonly playerId: PlayerId };

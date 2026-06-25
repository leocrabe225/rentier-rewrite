import type { CardId } from "./cardId";
import type { Money } from "./money";

interface CardCore {
  readonly id: CardId;
}

export interface CreditCard extends CardCore {
  readonly kind: "credit";
  readonly amount: Money;
}
export interface DebitCard extends CardCore {
  readonly kind: "debit";
  readonly amount: Money;
}
export interface RepairCard extends CardCore {
  readonly kind: "repair";
  readonly perProperty: Money;
  readonly perImprovement: Money;
}

export type Card = CreditCard | DebitCard | RepairCard;

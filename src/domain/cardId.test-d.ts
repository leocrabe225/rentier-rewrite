import type { CardId } from "./cardId";

// @ts-expect-error a raw string must go through cardId() to become a CardId
export const rawStringIsNotACardId: CardId = "credit-1";

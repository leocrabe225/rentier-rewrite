import type { PlayerId } from "./playerId";

// @ts-expect-error a raw string must go through playerId() to become a PlayerId
export const rawStringIsNotAPlayerId: PlayerId = "p1";

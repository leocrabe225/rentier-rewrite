import { describe, it, expect } from "vitest";
import { reduce, type Dice } from "./engine";
import { boardPosition } from "./domain/position";
import type { GameState } from "./domain/state";

describe("rolling the dice moves the current player", () => {
  it("emits Moved with the new position when the player does not pass GO", () => {
    // Arrange: one player sitting on GO (position 0).
    const state: GameState = {
      players: [{ id: "p1", position: boardPosition(0) }],
      currentPlayerId: "p1",
    };

    // Inject deterministic dice. Always 4+3=7 here.
    const dice: Dice = { roll: () => [3, 4] };

    // Act
    const result = reduce(state, { type: "RollDice" }, { dice });

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(7),
      },
    ]);
  });
});

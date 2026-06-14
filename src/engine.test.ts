import { describe, it, expect } from "vitest";
import { reduce, type Dice } from "./engine";
import { BOARD_SIZE, boardPosition } from "./domain/position";
import type { GameState } from "./domain/state";

describe("RollDice", () => {
  it("emits Moved with the new position when the player does not pass GO", () => {
    // Arrange
    const state: GameState = {
      players: [{ id: "p1", position: boardPosition(0) }],
      currentPlayerId: "p1",
    };

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

  it("emits PassedGo when player passes GO", () => {
    // Arrange
    const state: GameState = {
      players: [{ id: "p1", position: boardPosition(BOARD_SIZE - 1) }],
      currentPlayerId: "p1",
    };

    const dice: Dice = { roll: () => [3, 4] };

    // Act
    const result = reduce(state, { type: "RollDice" }, { dice });

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(BOARD_SIZE - 1),
        to: boardPosition(6),
      },
      { type: "PassedGo", playerId: "p1" },
    ]);
  });

  it("emits PassedGo when player lands on GO", () => {
    // Arrange
    const state: GameState = {
      players: [{ id: "p1", position: boardPosition(BOARD_SIZE - 2) }],
      currentPlayerId: "p1",
    };

    const dice: Dice = { roll: () => [1, 1] };

    // Act
    const result = reduce(state, { type: "RollDice" }, { dice });

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(BOARD_SIZE - 2),
        to: boardPosition(0),
      },
      { type: "PassedGo", playerId: "p1" },
    ]);
  });
});

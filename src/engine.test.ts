import { describe, it, expect } from "vitest";
import { reduce, type Accepted, type Dice, type Reduction } from "./engine";
import { BOARD_SIZE, boardPosition } from "./domain/position";
import { currentPlayer, type GameState, type Player } from "./domain/state";
import { tileAt } from "./domain/board";

const STARTING_BALANCE = 1500;

const noDice: Dice = {
  roll: () => {
    throw new Error("BuyProperty must not roll");
  },
};

describe("RollDice", () => {
  it("emits Moved with the new position when the player does not pass GO", () => {
    // Arrange
    const state: GameState = {
      players: [makePlayer({})],
      currentPlayerId: "p1",
      ownership: new Map(),
    };

    const dice: Dice = { roll: () => [3, 4] };

    // Act
    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(7),
      },
      { type: "LandedOnProperty", playerId: "p1", position: boardPosition(7) },
    ]);
  });

  it("emits PassedGo when player passes GO", () => {
    // Arrange
    const state: GameState = {
      players: [makePlayer({ position: boardPosition(BOARD_SIZE - 1) })],
      currentPlayerId: "p1",
      ownership: new Map(),
    };

    const dice: Dice = { roll: () => [3, 4] };

    // Act
    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(BOARD_SIZE - 1),
        to: boardPosition(6),
      },
      { type: "PassedGo", playerId: "p1" },
      { type: "LandedOnProperty", playerId: "p1", position: boardPosition(6) },
    ]);
  });

  it("emits PassedGo when player lands on GO", () => {
    // Arrange
    const state: GameState = {
      players: [makePlayer({ position: boardPosition(BOARD_SIZE - 2) })],
      currentPlayerId: "p1",
      ownership: new Map(),
    };

    const dice: Dice = { roll: () => [1, 1] };

    // Act
    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

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

  it("emits LandedOnProperty when the player lands on a property", () => {
    // Arrange
    const state: GameState = {
      players: [makePlayer({})],
      currentPlayerId: "p1",
      ownership: new Map(),
    };

    const dice: Dice = { roll: () => [1, 1] };

    // Act
    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(2),
      },
      { type: "LandedOnProperty", playerId: "p1", position: boardPosition(2) },
    ]);
  });
});

describe("BuyProperty", () => {
  it("rejects BuyProperty when the player is not standing on a property", () => {
    const state: GameState = {
      players: [makePlayer({})], // Standing on GO
      currentPlayerId: "p1",
      ownership: new Map(),
    };

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    expect(result).toEqual({ status: "rejected", reason: "NotOnAProperty" });
  });

  it("buys the unowned property the player is standing on", () => {
    const state: GameState = {
      players: [makePlayer({ position: boardPosition(1) })],
      currentPlayerId: "p1",
      ownership: new Map(),
    };

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    assertAccepted(result);

    expect(result.events).toEqual([
      { type: "PropertyBought", playerId: "p1", position: boardPosition(1) },
    ]);
    expect(result.state.ownership.get(boardPosition(1))).toBe("p1");
  });

  it("deducts the property's price from the buyer's balance", () => {
    const state: GameState = {
      players: [makePlayer({ position: boardPosition(1) })],
      currentPlayerId: "p1",
      ownership: new Map(),
    };

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    assertAccepted(result);

    const tile = tileAt(boardPosition(1));
    if (tile.kind !== "property") throw new Error("expected a property at 1");

    const buyer = currentPlayer(result.state);
    expect(buyer.balance).toBe(STARTING_BALANCE - tile.price);
  });

  it("rejects buyProperty when the player can't afford the property", () => {
    const tile = tileAt(boardPosition(1));
    if (tile.kind !== "property") throw new Error("expected a property at 1");

    const state: GameState = {
      players: [
        makePlayer({ position: boardPosition(1), balance: tile.price - 1 }),
      ],
      currentPlayerId: "p1",
      ownership: new Map(),
    };

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    expect(result).toEqual({ status: "rejected", reason: "InsufficientFunds" });
  });

  it("rejects BuyProperty when the property is already owned", () => {
    const state: GameState = {
      // balance: 0 because "AlreadyOwned" should be checked before "Insufficient balance"
      players: [makePlayer({ position: boardPosition(1), balance: 0 })],
      currentPlayerId: "p1",
      ownership: new Map([[boardPosition(1), "p2"]]),
    };

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    expect(result).toEqual({ status: "rejected", reason: "AlreadyOwned" });
  });
});

// No Omit<id> here, it's a default constructor helper, not a patcher.
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    position: boardPosition(0),
    balance: STARTING_BALANCE,
    ...overrides,
  };
}

function assertAccepted(r: Reduction): asserts r is Accepted {
  if (r.status === "rejected") {
    throw new Error(`expected accepted, got rejected: ${r.reason}`);
  }
}

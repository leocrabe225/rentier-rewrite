import { describe, it, expect } from "vitest";
import { reduce, type Accepted, type Dice, type Reduction } from "./engine";
import { BOARD_SIZE, boardPosition } from "./domain/position";
import {
  currentPlayer,
  playerById,
  type GameState,
  type Player,
} from "./domain/state";
import { JAIL_POSITION, tileAt } from "./domain/board";
import { improvementLevel } from "./domain/improvementLevel";
import { JAIL_FINE, MAX_JAIL_ATTEMPTS, STARTING_BALANCE } from "./domain/rules";

const noDice: Dice = {
  roll: () => {
    throw new Error("BuyProperty must not roll");
  },
};

describe("RollDice", () => {
  it("emits Moved with the new position when the player does not pass GO", () => {
    // Arrange
    const state = makeState();

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

    const p1 = currentPlayer(result.state);
    expect(p1.position).toBe(boardPosition(7));
  });

  it("emits PassedGo when player passes GO", () => {
    // Arrange
    const state = makeState({
      players: [makePlayer({ position: boardPosition(BOARD_SIZE - 1) })],
    });

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

    const p1 = currentPlayer(result.state);
    expect(p1.position).toBe(boardPosition(6));
  });

  it("emits PassedGo when player lands on GO", () => {
    // Arrange
    const state = makeState({
      players: [makePlayer({ position: boardPosition(BOARD_SIZE - 2) })],
    });

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

    const p1 = currentPlayer(result.state);
    expect(p1.position).toBe(boardPosition(0));
  });

  it("emits LandedOnProperty when the player lands on a property", () => {
    // Arrange
    const state = makeState({});

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

  it("pays rent to the owner when landing on an owned property", () => {
    const tile = tileAt(boardPosition(5));
    if (tile.kind !== "property") throw new Error("expected a property at 5");

    const state = makeState({
      players: [
        makePlayer({ id: "p1", balance: 1000 }),
        makePlayer({ id: "p2", balance: 2000 }),
      ],
      ownership: new Map([[boardPosition(5), "p2"]]),
    });

    const dice: Dice = { roll: () => [2, 3] };

    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(5),
      },
      { type: "RentPaid", from: "p1", to: "p2", amount: tile.rent },
    ]);

    const p1 = playerById(result.state, "p1");
    const p2 = playerById(result.state, "p2");
    expect(p1.balance).toBe(1000 - tile.rent);
    expect(p2.balance).toBe(2000 + tile.rent);
  });

  it("charges no rent when landing on your own property", () => {
    const state = makeState({
      ownership: new Map([[boardPosition(5), "p1"]]),
    });

    const dice: Dice = { roll: () => [2, 3] };

    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(5),
      },
    ]);

    const p1 = currentPlayer(result.state);
    expect(p1.balance).toBe(STARTING_BALANCE);
  });

  it("doubles rent when the owner holds the whole color group", () => {
    const tile = tileAt(boardPosition(2));
    if (tile.kind !== "property") throw new Error("expected a property at 2");

    const state = makeState({
      players: [
        makePlayer({ id: "p1", balance: 1000 }),
        makePlayer({ id: "p2", balance: 2000 }),
      ],
      ownership: new Map([
        [boardPosition(1), "p2"],
        [boardPosition(2), "p2"],
      ]),
    });

    const dice: Dice = { roll: () => [1, 1] };
    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    const doubled = tile.rent * 2;
    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(2),
      },
      { type: "RentPaid", from: "p1", to: "p2", amount: doubled },
    ]);

    const p1 = playerById(result.state, "p1");
    const p2 = playerById(result.state, "p2");
    expect(p1.balance).toBe(1000 - doubled);
    expect(p2.balance).toBe(2000 + doubled);
  });

  it("charges single rent when the owner holds only part of the color group", () => {
    const tile = tileAt(boardPosition(2));
    if (tile.kind !== "property") throw new Error("expected a property at 2");

    const state = makeState({
      players: [
        makePlayer({ id: "p1", balance: 1000 }),
        makePlayer({ id: "p2", balance: 2000 }),
      ],
      ownership: new Map([[boardPosition(2), "p2"]]),
    });

    const dice: Dice = { roll: () => [1, 1] };
    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(2),
      },
      { type: "RentPaid", from: "p1", to: "p2", amount: tile.rent },
    ]);

    const p1 = playerById(result.state, "p1");
    const p2 = playerById(result.state, "p2");
    expect(p1.balance).toBe(1000 - tile.rent);
    expect(p2.balance).toBe(2000 + tile.rent);
  });

  it("scales rent by improvement level", () => {
    const tile = tileAt(boardPosition(5));
    if (tile.kind !== "property") throw new Error("expected a property at 5");

    const state = makeState({
      players: [
        makePlayer({ id: "p1", balance: 1000 }),
        makePlayer({ id: "p2", balance: 2000 }),
      ],
      ownership: new Map([[boardPosition(5), "p2"]]),
      improvements: new Map([[boardPosition(5), improvementLevel(3)]]),
    });

    const dice: Dice = { roll: () => [2, 3] };
    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    const rent = tile.rent * 3;
    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(5),
      },
      { type: "RentPaid", from: "p1", to: "p2", amount: rent },
    ]);

    const p1 = playerById(result.state, "p1");
    const p2 = playerById(result.state, "p2");
    expect(p1.balance).toBe(1000 - rent);
    expect(p2.balance).toBe(2000 + rent);
  });

  it("scales rent by improvement level * monopolyFactor", () => {
    const tile = tileAt(boardPosition(5));
    if (tile.kind !== "property") throw new Error("expected a property at 5");

    const state = makeState({
      players: [
        makePlayer({ id: "p1", balance: 1000 }),
        makePlayer({ id: "p2", balance: 2000 }),
      ],
      ownership: new Map([
        [boardPosition(5), "p2"],
        [boardPosition(7), "p2"],
        [boardPosition(8), "p2"],
      ]),
      improvements: new Map([[boardPosition(5), improvementLevel(3)]]),
    });

    const dice: Dice = { roll: () => [2, 3] };
    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    const rent = tile.rent * 3 * 2;
    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(5),
      },
      { type: "RentPaid", from: "p1", to: "p2", amount: rent },
    ]);

    const p1 = playerById(result.state, "p1");
    const p2 = playerById(result.state, "p2");
    expect(p1.balance).toBe(1000 - rent);
    expect(p2.balance).toBe(2000 + rent);
  });

  it("sends the player to jail when they land on the go-to-jail tile", () => {
    const state = makeState({
      players: [makePlayer({ position: boardPosition(20) })],
    });

    const dice: Dice = { roll: () => [3, 4] };

    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(20),
        to: boardPosition(27),
      },
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(27),
        to: boardPosition(JAIL_POSITION),
      },
      { type: "SentToJail", playerId: "p1" },
    ]);

    const p1 = currentPlayer(result.state);
    expect(p1.status).toEqual({ kind: "jailed", failedAttempts: 0 });
    expect(tileAt(p1.position)).toEqual({ kind: "jail" });
  });

  it("does not jail a player who is just visiting the jail tile", () => {
    const state = makeState({});

    const dice: Dice = { roll: () => [4, 5] };

    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(0),
        to: boardPosition(9),
      },
    ]);

    const p1 = currentPlayer(result.state);
    expect(p1.status).toEqual({ kind: "free" });
    expect(tileAt(p1.position)).toEqual({ kind: "jail" });
  });

  it("keeps a jailed player when the roll is not doubles", () => {
    const state = makeState({
      players: [
        makePlayer({
          status: { kind: "jailed", failedAttempts: 0 },
          position: JAIL_POSITION,
        }),
      ],
    });

    const dice: Dice = { roll: () => [4, 5] };

    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "RemainedInJail",
        playerId: "p1",
      },
    ]);

    const p1 = currentPlayer(result.state);
    expect(p1.status).toEqual({ kind: "jailed", failedAttempts: 1 });
    expect(tileAt(p1.position)).toEqual({ kind: "jail" });
  });

  it("frees a jailed player when the roll is doubles", () => {
    const state = makeState({
      players: [
        makePlayer({
          status: { kind: "jailed", failedAttempts: 0 },
          position: JAIL_POSITION,
        }),
      ],
    });

    const dice: Dice = { roll: () => [5, 5] };

    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "FreedFromJail",
        playerId: "p1",
      },
      {
        type: "Moved",
        playerId: "p1",
        from: boardPosition(9),
        to: boardPosition(19),
      },
      { type: "LandedOnProperty", playerId: "p1", position: boardPosition(19) },
    ]);

    const p1 = currentPlayer(result.state);
    expect(p1.status).toEqual({ kind: "free" });
    expect(p1.position).toEqual(boardPosition(19));
  });

  it("frees a jailed player after its third failed roll", () => {
    const state = makeState({
      players: [
        makePlayer({
          status: { kind: "jailed", failedAttempts: MAX_JAIL_ATTEMPTS - 1 },
          position: JAIL_POSITION,
        }),
      ],
    });

    const dice: Dice = { roll: () => [4, 5] };

    const result = reduce(state, { type: "RollDice" }, { dice });

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "FreedFromJail",
        playerId: "p1",
      },
    ]);

    const p1 = currentPlayer(result.state);
    expect(p1.status).toEqual({ kind: "free" });
    expect(p1.position).toEqual(boardPosition(9));
  });
});

describe("BuyProperty", () => {
  it("rejects BuyProperty when the player is not standing on a property", () => {
    const state = makeState({});

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    expect(result).toEqual({ status: "rejected", reason: "NotOnAProperty" });
  });

  it("buys the unowned property the player is standing on", () => {
    const state = makeState({
      players: [makePlayer({ position: boardPosition(1) })],
    });

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    assertAccepted(result);

    expect(result.events).toEqual([
      { type: "PropertyBought", playerId: "p1", position: boardPosition(1) },
    ]);
    expect(result.state.ownership.get(boardPosition(1))).toBe("p1");
  });

  it("deducts the property's price from the buyer's balance", () => {
    const state = makeState({
      players: [makePlayer({ position: boardPosition(1) })],
    });

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    assertAccepted(result);

    const tile = tileAt(boardPosition(1));
    if (tile.kind !== "property") throw new Error("expected a property at 1");

    const buyer = currentPlayer(result.state);
    expect(buyer.balance).toBe(STARTING_BALANCE - tile.price);
  });

  it("rejects BuyProperty when the player can't afford the property", () => {
    const tile = tileAt(boardPosition(1));
    if (tile.kind !== "property") throw new Error("expected a property at 1");

    const state = makeState({
      players: [
        makePlayer({ position: boardPosition(1), balance: tile.price - 1 }),
      ],
    });

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    expect(result).toEqual({ status: "rejected", reason: "InsufficientFunds" });
  });

  it("rejects BuyProperty when the property is already owned", () => {
    const state = makeState({
      // balance: 0 because "AlreadyOwned" should be checked before "Insufficient balance"
      players: [makePlayer({ position: boardPosition(1), balance: 0 })],
      ownership: new Map([[boardPosition(1), "p2"]]),
    });

    const result = reduce(state, { type: "BuyProperty" }, { dice: noDice });

    expect(result).toEqual({ status: "rejected", reason: "AlreadyOwned" });
  });
});

describe("ImproveProperty", () => {
  it("raises an owned property to the requested level", () => {
    const state = makeState({
      ownership: new Map([[boardPosition(5), "p1"]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      { dice: noDice },
    );

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "PropertyImproved",
        playerId: "p1",
        position: boardPosition(5),
        level: improvementLevel(4),
      },
    ]);
    expect(result.state.improvements.get(boardPosition(5))).toBe(4);
  });

  it("rejects improving a tile that is not a property", () => {
    const state = makeState({});

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(0),
        toLevel: improvementLevel(4),
      },
      { dice: noDice },
    );

    expect(result).toEqual({ status: "rejected", reason: "NotAProperty" });
  });

  it("rejects improving a property the player does not own", () => {
    const state = makeState({
      ownership: new Map([[boardPosition(5), "p2"]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      { dice: noDice },
    );

    expect(result).toEqual({ status: "rejected", reason: "NotOwner" });
  });

  it("deducts the improvement cost from the player's balance", () => {
    const tile = tileAt(boardPosition(5));
    if (tile.kind !== "property") throw new Error("expected a property at 5");

    const state = makeState({
      ownership: new Map([[boardPosition(5), "p1"]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      { dice: noDice },
    );

    assertAccepted(result);

    const cost = tile.costPerLevel * (4 - 1); // rate * levels added, from default 1
    const p1 = playerById(result.state, "p1");
    expect(p1.balance).toBe(STARTING_BALANCE - cost);
  });

  it("rejects improving not above the current level", () => {
    const state = makeState({
      ownership: new Map([[boardPosition(5), "p1"]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(1),
      },
      { dice: noDice },
    );

    expect(result).toEqual({ status: "rejected", reason: "NotAnUpgrade" });
  });

  it("rejects a non-property before judging whether it's an upgrade", () => {
    const state = makeState({});

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(0),
        toLevel: improvementLevel(1),
      },
      { dice: noDice },
    );

    expect(result).toEqual({ status: "rejected", reason: "NotAProperty" });
  });

  it("rejects improving when the player can't afford the cost", () => {
    const tile = tileAt(boardPosition(5));
    if (tile.kind !== "property") throw new Error("expected a property at 5");

    const cost = tile.costPerLevel * (4 - 1);
    const state = makeState({
      players: [makePlayer({ balance: cost - 1 })],
      ownership: new Map([[boardPosition(5), "p1"]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      { dice: noDice },
    );

    expect(result).toEqual({ status: "rejected", reason: "InsufficientFunds" });
  });

  it("deducts the improvement cost from the player's balance with an already-improved property", () => {
    const tile = tileAt(boardPosition(5));
    if (tile.kind !== "property") throw new Error("expected a property at 5");

    const state = makeState({
      ownership: new Map([[boardPosition(5), "p1"]]),
      improvements: new Map([[boardPosition(5), improvementLevel(2)]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      { dice: noDice },
    );

    assertAccepted(result);

    const cost = tile.costPerLevel * (4 - 2);
    const p1 = playerById(result.state, "p1");
    expect(p1.balance).toBe(STARTING_BALANCE - cost);
  });
});

describe("PayJailFine", () => {
  it("frees a jailed player who pays the fine, charging 500", () => {
    const state = makeState({
      players: [
        makePlayer({
          status: { kind: "jailed", failedAttempts: 0 },
          position: JAIL_POSITION,
          balance: 1000,
        }),
      ],
    });

    const result = reduce(state, { type: "PayJailFine" }, { dice: noDice });

    assertAccepted(result);

    expect(result.events).toEqual([
      { type: "JailFinePaid", playerId: "p1", amount: JAIL_FINE },
    ]);

    const p1 = currentPlayer(result.state);
    expect(p1.status).toEqual({ kind: "free" });
    expect(p1.balance).toBe(1000 - JAIL_FINE);
    expect(p1.position).toBe(JAIL_POSITION);
  });

  it("rejects a free player", () => {
    const state = makeState({
      players: [
        makePlayer({
          status: { kind: "free" },
          position: JAIL_POSITION,
          balance: 1000,
        }),
      ],
    });

    const result = reduce(state, { type: "PayJailFine" }, { dice: noDice });

    expect(result).toEqual({ status: "rejected", reason: "NotInJail" });
  });

  it("rejects a player that doesn't have enough money in the balance", () => {
    const state = makeState({
      players: [
        makePlayer({
          status: { kind: "jailed", failedAttempts: 0 },
          position: JAIL_POSITION,
          balance: JAIL_FINE - 1,
        }),
      ],
    });

    const result = reduce(state, { type: "PayJailFine" }, { dice: noDice });

    expect(result).toEqual({ status: "rejected", reason: "InsufficientFunds" });
  });
});

// No Omit<id> here, it's a default constructor helper, not a patcher.
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    status: { kind: "free" },
    position: boardPosition(0),
    balance: STARTING_BALANCE,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    players: [makePlayer({})],
    currentPlayerId: "p1",
    ownership: new Map(),
    improvements: new Map(),
    ...overrides,
  };
}

function assertAccepted(r: Reduction): asserts r is Accepted {
  if (r.status === "rejected") {
    throw new Error(`expected accepted, got rejected: ${r.reason}`);
  }
}

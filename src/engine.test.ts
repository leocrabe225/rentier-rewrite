import { describe, it, expect } from "vitest";
import {
  reduce,
  type Accepted,
  type Deck,
  type Dice,
  type EngineDeps,
  type Reduction,
} from "./engine";
import {
  BOARD_SIZE,
  boardPosition,
  type BoardPosition,
} from "./domain/position";
import {
  currentPlayer,
  playerById,
  type BankruptPlayer,
  type FreePlayer,
  type GameState,
  type InPlayPlayer,
  type JailedPlayer,
  type Player,
  type TurnPurchase,
  type TurnRoll,
} from "./domain/state";
import { FREE_PARKING_POSITION, JAIL_POSITION, tileAt } from "./domain/board";
import { improvementLevel } from "./domain/improvementLevel";
import {
  JAIL_FINE,
  MAX_JAIL_ATTEMPTS,
  RAILROAD_RENT_BASE,
  STARTING_BALANCE,
} from "./domain/rules";
import type { Tile } from "./domain/tiles";
import { money, type Money } from "./domain/money";
import { playerId } from "./domain/playerId";
import { cardId } from "./domain/cardId";
import type { Card } from "./domain/card";

const P1 = playerId("p1");
const P2 = playerId("p2");
const P3 = playerId("p3");
const P4 = playerId("p4");

const CREDIT_CARD_1 = cardId("credit-1");
const DEBIT_CARD_1 = cardId("debit-1");
const REPAIR_CARD = cardId("repair");

const noDice: Dice = {
  roll: () => {
    throw new Error("this test must not roll");
  },
};

const noDeck: Deck = {
  draw: () => {
    throw new Error("This test must not draw");
  },
};

describe("RollDice", () => {
  describe("Movement", () => {
    it("rejects RollDice when the turn kind not roll", () => {
      const state = makeState({
        players: [freePlayer({ position: boardPosition(1) })],
        turn: turnPurchase(),
      });

      const result = reduce(state, { type: "RollDice" }, makeDeps({}));

      expect(result).toEqual({
        status: "rejected",
        reason: "NoPendingRoll",
      });
    });

    it("emits Moved with the new position when the player does not pass GO", () => {
      // Arrange
      const state = makeState();

      const dice: Dice = { roll: () => [3, 4] };

      // Act
      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(7),
        },
        {
          type: "LandedOnProperty",
          playerId: P1,
          position: boardPosition(7),
        },
      ]);

      const p1 = inPlay(currentPlayer(result.state));
      expect(p1.position).toBe(boardPosition(7));
    });

    it("emits PassedGo when player passes GO", () => {
      expect(() => propertyTileAt(boardPosition(5))).not.toThrow();
      // Arrange
      const state = makeState({
        players: [
          freePlayer({ position: boardPosition(BOARD_SIZE - 1) }),
          freePlayer({ id: P2 }),
        ],
      });

      const dice: Dice = { roll: () => [2, 4] };

      // Act
      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(BOARD_SIZE - 1),
          to: boardPosition(5),
        },
        { type: "PassedGo", playerId: P1 },
        {
          type: "LandedOnProperty",
          playerId: P1,
          position: boardPosition(5),
        },
      ]);

      const p1 = inPlay(currentPlayer(result.state));
      expect(p1.position).toBe(boardPosition(5));
    });

    it("emits PassedGo when player lands on GO", () => {
      // Arrange
      const state = makeState({
        players: [
          freePlayer({ position: boardPosition(BOARD_SIZE - 4) }),
          freePlayer({ id: P2 }),
        ],
      });

      const dice: Dice = { roll: () => [1, 3] };

      // Act
      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(BOARD_SIZE - 4),
          to: boardPosition(0),
        },
        { type: "PassedGo", playerId: P1 },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(currentPlayer(result.state));
      expect(p1.position).toBe(boardPosition(0));
    });

    it("emits LandedOnProperty when the player lands on a property", () => {
      // Arrange
      const state = makeState({});

      const dice: Dice = { roll: () => [1, 4] };

      // Act
      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        {
          type: "LandedOnProperty",
          playerId: P1,
          position: boardPosition(5),
        },
      ]);
    });

    it("emits LandedOnRailroad when landing on an unowned railroad", () => {
      const state = makeState({});

      const dice: Dice = { roll: () => [1, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(4),
        },
        {
          type: "LandedOnRailroad",
          playerId: P1,
          position: boardPosition(4),
        },
      ]);
    });
  });

  describe("Properties", () => {
    it("pays rent to the owner when landing on an owned property", () => {
      const tile = propertyTileAt(boardPosition(5));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: money(1000) }),
          freePlayer({ id: P2, balance: money(2000) }),
        ],
        ownership: new Map([[boardPosition(5), P2]]),
      });

      const dice: Dice = { roll: () => [2, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        { type: "RentPaid", from: P1, to: P2, amount: tile.rent },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.balance).toBe(1000 - tile.rent);
      expect(p2.balance).toBe(2000 + tile.rent);
    });

    it("charges no rent when landing on your own property", () => {
      const state = makeState({
        ownership: new Map([[boardPosition(5), P1]]),
      });

      const dice: Dice = { roll: () => [2, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(currentPlayer(result.state));
      expect(p1.balance).toBe(STARTING_BALANCE);
    });

    it("doubles rent when the owner holds the whole color group", () => {
      const tile = propertyTileAt(boardPosition(5));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: money(1000) }),
          freePlayer({ id: P2, balance: money(2000) }),
        ],
        ownership: new Map([
          [boardPosition(5), P2],
          [boardPosition(7), P2],
          [boardPosition(8), P2],
        ]),
      });

      const dice: Dice = { roll: () => [1, 4] };
      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      const doubled = tile.rent * 2;
      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        { type: "RentPaid", from: P1, to: P2, amount: doubled },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.balance).toBe(1000 - doubled);
      expect(p2.balance).toBe(2000 + doubled);
    });

    it("charges single rent when the owner holds only part of the color group", () => {
      const tile = propertyTileAt(boardPosition(5));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: money(1000) }),
          freePlayer({ id: P2, balance: money(2000) }),
        ],
        ownership: new Map([[boardPosition(5), P2]]),
      });

      const dice: Dice = { roll: () => [1, 4] };
      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        { type: "RentPaid", from: P1, to: P2, amount: tile.rent },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.balance).toBe(1000 - tile.rent);
      expect(p2.balance).toBe(2000 + tile.rent);
    });

    it("scales rent by improvement level", () => {
      const tile = propertyTileAt(boardPosition(5));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: money(1000) }),
          freePlayer({ id: P2, balance: money(2000) }),
        ],
        ownership: new Map([[boardPosition(5), P2]]),
        improvements: new Map([[boardPosition(5), improvementLevel(3)]]),
      });

      const dice: Dice = { roll: () => [2, 3] };
      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      const rent = tile.rent * 3;
      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        { type: "RentPaid", from: P1, to: P2, amount: rent },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.balance).toBe(1000 - rent);
      expect(p2.balance).toBe(2000 + rent);
    });

    it("scales rent by improvement level * monopolyFactor", () => {
      const tile = propertyTileAt(boardPosition(5));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: money(1000) }),
          freePlayer({ id: P2, balance: money(2000) }),
        ],
        ownership: new Map([
          [boardPosition(5), P2],
          [boardPosition(7), P2],
          [boardPosition(8), P2],
        ]),
        improvements: new Map([[boardPosition(5), improvementLevel(3)]]),
      });

      const dice: Dice = { roll: () => [2, 3] };
      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      const rent = tile.rent * 3 * 2;
      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        { type: "RentPaid", from: P1, to: P2, amount: rent },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.balance).toBe(1000 - rent);
      expect(p2.balance).toBe(2000 + rent);
    });

    it("sets Turn kind to purchase when the player lands on an unowned property", () => {
      const player1 = freePlayer({});
      const state = makeState({ players: [player1] });

      const dice: Dice = { roll: () => [2, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.state).toEqual({
        ...state,
        players: [{ ...player1, position: boardPosition(5) }],
        turn: turnPurchase(),
      });
    });
  });

  describe("Railroads", () => {
    it("charges no rent when landing on your own railroad", () => {
      expect(() => railroadTileAt(boardPosition(4))).not.toThrow();
      const state = makeState({
        ownership: new Map([[boardPosition(4), P1]]),
      });

      const dice: Dice = { roll: () => [1, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(4),
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(currentPlayer(result.state));
      expect(p1.balance).toBe(STARTING_BALANCE);
    });

    it("emits RentPaid when owned by other player", () => {
      expect(() => railroadTileAt(boardPosition(4))).not.toThrow();
      const state = makeState({
        players: [freePlayer({}), freePlayer({ id: P2 })],
        ownership: new Map([[boardPosition(4), P2]]),
      });

      const dice: Dice = { roll: () => [1, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(4),
        },
        { type: "RentPaid", from: P1, to: P2, amount: RAILROAD_RENT_BASE },
        { type: "TurnBegan", playerId: P2 },
      ]);
    });

    it("transfers rent when owned by other player", () => {
      expect(() => railroadTileAt(boardPosition(4))).not.toThrow();
      const state = makeState({
        players: [
          freePlayer({ balance: money(3000) }),
          freePlayer({ id: P2, balance: money(8000) }),
        ],
        ownership: new Map([[boardPosition(4), P2]]),
      });

      const dice: Dice = { roll: () => [1, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.balance).toBe(3000 - RAILROAD_RENT_BASE);
      expect(p2.balance).toBe(8000 + RAILROAD_RENT_BASE);
    });

    it("scales rent when owned owns more than 1", () => {
      expect(() => railroadTileAt(boardPosition(4))).not.toThrow();
      const state = makeState({
        players: [
          freePlayer({ balance: money(3000) }),
          freePlayer({ id: P2, balance: money(8000) }),
        ],
        ownership: new Map([
          [boardPosition(4), P2],
          [boardPosition(13), P2],
          [boardPosition(23), P2],
          [boardPosition(31), P2],
        ]),
      });

      const dice: Dice = { roll: () => [1, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.balance).toBe(3000 - 2000);
      expect(p2.balance).toBe(8000 + 2000);
    });

    it("does not bankrupt when balance exactly covers railroad rent", () => {
      expect(() => railroadTileAt(boardPosition(4))).not.toThrow();
      const state = makeState({
        players: [
          freePlayer({ balance: RAILROAD_RENT_BASE }),
          freePlayer({ id: P2 }),
        ],
        ownership: new Map([[boardPosition(4), P2]]),
      });

      const dice: Dice = { roll: () => [1, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(() => inPlay(playerById(result.state, P1))).not.toThrow();
    });

    it("bankrupts a player who can't afford rent", () => {
      expect(() => railroadTileAt(boardPosition(4))).not.toThrow();
      const state = makeState({
        players: [
          freePlayer({ balance: money(RAILROAD_RENT_BASE - 1) }),
          freePlayer({ id: P2, balance: money(8000) }),
          freePlayer({ id: P3 }),
        ],
        ownership: new Map([[boardPosition(4), P2]]),
      });

      const dice: Dice = { roll: () => [1, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(4),
        },
        {
          type: "WentBankrupt",
          playerId: P1,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = playerById(result.state, P1);
      expect(p1).toEqual({ id: P1, kind: "bankrupt" });
    });
    it("sets Turn kind to purchase when the player lands on an unowned railroad", () => {
      const player1 = freePlayer({});
      const state = makeState({ players: [player1], turn: turnRoll() });

      const dice: Dice = { roll: () => [1, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.state).toEqual({
        ...state,
        players: [{ ...player1, position: boardPosition(4) }],
        turn: turnPurchase(),
      });
    });
  });

  describe("Jail", () => {
    it("sends the player to jail when they land on the go-to-jail tile", () => {
      const state = makeState({
        players: [
          freePlayer({ position: boardPosition(20) }),
          freePlayer({ id: P2 }),
        ],
      });

      const dice: Dice = { roll: () => [3, 4] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(20),
          to: boardPosition(27),
        },
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(27),
          to: boardPosition(JAIL_POSITION),
        },
        { type: "SentToJail", playerId: P1 },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = playerById(result.state, P1);
      expect(p1).toEqual({
        id: P1,
        balance: STARTING_BALANCE,
        position: JAIL_POSITION,
        kind: "jailed",
        failedAttempts: 0,
      });
    });

    it("does not jail a player who is just visiting the jail tile", () => {
      const state = makeState({});

      const dice: Dice = { roll: () => [4, 5] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(9),
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = playerById(result.state, P1);
      expect(p1.kind).toBe("free");
    });

    it("keeps a jailed player when the roll is not doubles", () => {
      const state = makeState({
        players: [
          jailedPlayer({
            kind: "jailed",
            failedAttempts: 0,
            position: JAIL_POSITION,
          }),
          freePlayer({ id: P2 }),
        ],
      });

      const dice: Dice = { roll: () => [4, 5] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "RemainedInJail",
          playerId: P1,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = playerById(result.state, P1);
      expect(p1).toEqual({
        id: P1,
        position: JAIL_POSITION,
        balance: STARTING_BALANCE,
        kind: "jailed",
        failedAttempts: 1,
      });
    });

    it("frees a jailed player when the roll is doubles", () => {
      const state = makeState({
        players: [
          jailedPlayer({
            kind: "jailed",
            failedAttempts: 0,
            position: JAIL_POSITION,
          }),
          freePlayer({ id: P2 }),
        ],
      });

      const dice: Dice = { roll: () => [5, 5] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "FreedFromJail",
          playerId: P1,
        },
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(9),
          to: boardPosition(19),
        },
        {
          type: "LandedOnProperty",
          playerId: P1,
          position: boardPosition(19),
        },
      ]);

      const p1 = currentPlayer(result.state);
      expect(p1).toEqual({
        id: P1,
        position: boardPosition(19),
        balance: STARTING_BALANCE,
        kind: "free",
      });
    });

    it("frees a jailed player after its third failed roll", () => {
      const state = makeState({
        players: [
          jailedPlayer({
            kind: "jailed",
            failedAttempts: MAX_JAIL_ATTEMPTS - 1,
            position: JAIL_POSITION,
          }),
          freePlayer({ id: P2 }),
        ],
      });

      const dice: Dice = { roll: () => [4, 5] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "FreedFromJail",
          playerId: P1,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = playerById(result.state, P1);
      expect(p1).toEqual({
        id: P1,
        position: JAIL_POSITION,
        balance: STARTING_BALANCE,
        kind: "free",
      });
    });
  });

  describe("Free Parking", () => {
    it("draws a free player onto the tile", () => {
      const state = makeState({
        players: [
          freePlayer({ id: P1, position: boardPosition(11) }),
          freePlayer({ id: P2, position: boardPosition(5) }),
        ],
      });

      const dice: Dice = { roll: () => [3, 4] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(11),
          to: FREE_PARKING_POSITION,
        },
        {
          type: "Moved",
          playerId: P2,
          from: boardPosition(5),
          to: FREE_PARKING_POSITION,
        },
        { type: "DrawnToFreeParking", playerId: P2 },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.position).toEqual(FREE_PARKING_POSITION);
      expect(p2.position).toEqual(FREE_PARKING_POSITION);
    });

    it("draws every other free player onto the tile", () => {
      const state = makeState({
        players: [
          freePlayer({ id: P1, position: boardPosition(11) }),
          freePlayer({ id: P2, position: boardPosition(5) }),
          freePlayer({ id: P3, position: boardPosition(2) }),
          freePlayer({ id: P4, position: boardPosition(8) }),
        ],
      });

      const dice: Dice = { roll: () => [3, 4] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(11),
          to: FREE_PARKING_POSITION,
        },
        {
          type: "Moved",
          playerId: P2,
          from: boardPosition(5),
          to: FREE_PARKING_POSITION,
        },
        { type: "DrawnToFreeParking", playerId: P2 },
        {
          type: "Moved",
          playerId: P3,
          from: boardPosition(2),
          to: FREE_PARKING_POSITION,
        },
        { type: "DrawnToFreeParking", playerId: P3 },
        {
          type: "Moved",
          playerId: P4,
          from: boardPosition(8),
          to: FREE_PARKING_POSITION,
        },
        { type: "DrawnToFreeParking", playerId: P4 },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      const p3 = inPlay(playerById(result.state, P3));
      const p4 = inPlay(playerById(result.state, P4));
      expect(p1.position).toEqual(FREE_PARKING_POSITION);
      expect(p2.position).toEqual(FREE_PARKING_POSITION);
      expect(p3.position).toEqual(FREE_PARKING_POSITION);
      expect(p4.position).toEqual(FREE_PARKING_POSITION);
    });

    it("leaves a jailed player in jail", () => {
      const state = makeState({
        players: [
          freePlayer({ id: P1, position: boardPosition(11) }),
          jailedPlayer({
            id: P2,
            position: JAIL_POSITION,
            kind: "jailed",
            failedAttempts: 0,
          }),
        ],
      });

      const dice: Dice = { roll: () => [3, 4] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(11),
          to: FREE_PARKING_POSITION,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.position).toEqual(FREE_PARKING_POSITION);
      expect(p2.position).toEqual(JAIL_POSITION);
    });

    it("does not re-move a player already standing on Free Parking", () => {
      const state = makeState({
        players: [
          freePlayer({ id: P1, position: boardPosition(11) }),
          freePlayer({
            id: P2,
            position: FREE_PARKING_POSITION,
          }),
        ],
      });

      const dice: Dice = { roll: () => [3, 4] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(11),
          to: FREE_PARKING_POSITION,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.position).toEqual(FREE_PARKING_POSITION);
      expect(p2.position).toEqual(FREE_PARKING_POSITION);
    });

    it("collects no GO for a player drawn across a GO", () => {
      const state = makeState({
        players: [
          freePlayer({ id: P1, position: boardPosition(11) }),
          freePlayer({
            id: P2,
            position: boardPosition(30),
          }),
        ],
      });

      const dice: Dice = { roll: () => [3, 4] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(11),
          to: FREE_PARKING_POSITION,
        },
        {
          type: "Moved",
          playerId: P2,
          from: boardPosition(30),
          to: FREE_PARKING_POSITION,
        },
        { type: "DrawnToFreeParking", playerId: P2 },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1.position).toEqual(FREE_PARKING_POSITION);
      expect(p2.position).toEqual(FREE_PARKING_POSITION);
    });

    it("does not draw a bankrupt player to Free Parking", () => {
      const state = makeState({
        players: [
          freePlayer({ id: P1, position: boardPosition(9) }),
          freePlayer({ id: P2, position: boardPosition(9) }),
          bankruptPlayer({ id: P3 }),
        ],
      });

      const dice: Dice = { roll: () => [4, 5] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(9),
          to: FREE_PARKING_POSITION,
        },
        {
          type: "Moved",
          playerId: P2,
          from: boardPosition(9),
          to: FREE_PARKING_POSITION,
        },
        { type: "DrawnToFreeParking", playerId: P2 },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      expect(p1.position).toEqual(FREE_PARKING_POSITION);
    });
  });

  describe("Bankruptcy", () => {
    it("rejects any command from a bankrupt player", () => {
      const state = makeState({
        players: [bankruptPlayer()],
      });

      const result = reduce(state, { type: "RollDice" }, makeDeps({}));

      expect(result).toEqual({ status: "rejected", reason: "Bankrupt" });
    });

    it("bankrupts a player who can't afford rent, paying the owner nothing", () => {
      const tile = propertyTileAt(boardPosition(5));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: money(tile.rent - 1) }),
          freePlayer({ id: P2 }),
          freePlayer({ id: P3 }),
        ],
        ownership: new Map([[boardPosition(5), P2]]),
      });

      const dice: Dice = { roll: () => [2, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        {
          type: "WentBankrupt",
          playerId: P1,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = playerById(result.state, P1);
      const p2 = inPlay(playerById(result.state, P2));
      expect(p1).toEqual({ id: P1, kind: "bankrupt" });
      expect(p2.balance).toBe(STARTING_BALANCE);
    });

    it("does not bankrupt a player whose balance exactly covers the rent", () => {
      const tile = propertyTileAt(boardPosition(5));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: tile.rent }),
          freePlayer({ id: P2 }),
        ],
        ownership: new Map([[boardPosition(5), P2]]),
      });

      const dice: Dice = { roll: () => [2, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        { type: "RentPaid", from: P1, to: P2, amount: tile.rent },
        { type: "TurnBegan", playerId: P2 },
      ]);

      expect(() => inPlay(playerById(result.state, P1))).not.toThrow();
    });

    it("releases the bankrupt player's properties", () => {
      const tile = propertyTileAt(boardPosition(5));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: money(tile.rent - 1) }),
          freePlayer({ id: P2 }),
          freePlayer({ id: P3 }),
        ],
        ownership: new Map([
          [boardPosition(5), P2],
          [boardPosition(7), P1],
        ]),
      });

      const dice: Dice = { roll: () => [2, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        {
          type: "WentBankrupt",
          playerId: P1,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      expect(result.state.ownership.get(boardPosition(7))).toBe(undefined);
    });

    it("clears improvements on the released properties", () => {
      const tile = propertyTileAt(boardPosition(5));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: money(tile.rent - 1) }),
          freePlayer({ id: P2 }),
          freePlayer({ id: P3 }),
        ],
        ownership: new Map([
          [boardPosition(5), P2],
          [boardPosition(7), P1],
        ]),
        improvements: new Map([[boardPosition(7), improvementLevel(2)]]),
      });

      const dice: Dice = { roll: () => [2, 3] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(5),
        },
        {
          type: "WentBankrupt",
          playerId: P1,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      expect(result.state.improvements.get(boardPosition(7))).toBe(undefined);
    });
  });

  describe("Tax", () => {
    it("emits TaxPaid when landing on a tax tile", () => {
      const tile = taxTileAt(boardPosition(3));

      const state = makeState({});

      const dice: Dice = { roll: () => [1, 2] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(3),
        },
        {
          type: "TaxPaid",
          playerId: P1,
          amount: tile.amount,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);
    });

    it("deducts the tax amount from the lander's balance", () => {
      const tile = taxTileAt(boardPosition(3));

      const state = makeState();

      const dice: Dice = { roll: () => [1, 2] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      const p1 = inPlay(playerById(result.state, P1));
      expect(p1.balance).toBe(STARTING_BALANCE - tile.amount);
    });

    it("pays the tax to no one, no other balance changes", () => {
      expect(() => taxTileAt(boardPosition(3))).not.toThrow();

      const state = makeState({
        players: [freePlayer({ id: P1 }), freePlayer({ id: P2 })],
      });

      const dice: Dice = { roll: () => [1, 2] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      const p2 = inPlay(playerById(result.state, P2));
      expect(p2.balance).toBe(STARTING_BALANCE);
    });

    it("bankrupts a player who can't afford the tax", () => {
      const tile = taxTileAt(boardPosition(3));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: money(tile.amount - 1) }),
          freePlayer({ id: P2 }),
          freePlayer({ id: P3 }),
        ],
      });

      const dice: Dice = { roll: () => [1, 2] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(3),
        },
        {
          type: "WentBankrupt",
          playerId: P1,
        },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = playerById(result.state, P1);
      expect(p1).toEqual({ id: P1, kind: "bankrupt" });
    });

    it("does not bankrupt a player whose balance exactly covers the tax", () => {
      const tile = taxTileAt(boardPosition(3));

      const state = makeState({
        players: [
          freePlayer({ id: P1, balance: tile.amount }),
          freePlayer({ id: P2 }),
        ],
      });

      const dice: Dice = { roll: () => [1, 2] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      const p1 = inPlay(playerById(result.state, P1));
      expect(p1.balance).toBe(0);
    });
  });

  describe("Cards", () => {
    it("a credit card pays the lander from the bank", () => {
      expect(() => chanceTileAt(boardPosition(6))).not.toThrow();

      const state = makeState({});

      const dice: Dice = { roll: () => [4, 2] };
      const amount = money(500);
      const card: Card = {
        id: CREDIT_CARD_1,
        kind: "credit",
        amount,
      };
      const deck: Deck = { draw: () => card };

      const result = reduce(
        state,
        { type: "RollDice" },
        makeDeps({ dice, deck }),
      );

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(6),
        },
        { type: "CardDrawn", playerId: P1, cardId: CREDIT_CARD_1 },
        { type: "ReceivedFromBank", playerId: P1, amount },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      expect(p1.balance).toBe(STARTING_BALANCE + amount);
    });

    it("a debit card charges the lander to the bank", () => {
      expect(() => chanceTileAt(boardPosition(6))).not.toThrow();

      const state = makeState({});

      const dice: Dice = { roll: () => [4, 2] };
      const amount = money(500);
      const card: Card = {
        id: DEBIT_CARD_1,
        kind: "debit",
        amount,
      };
      const deck: Deck = { draw: () => card };

      const result = reduce(
        state,
        { type: "RollDice" },
        makeDeps({ dice, deck }),
      );

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(6),
        },
        { type: "CardDrawn", playerId: P1, cardId: DEBIT_CARD_1 },
        { type: "PaidToBank", playerId: P1, amount },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      expect(p1.balance).toBe(STARTING_BALANCE - amount);
    });

    it("a debit card the lander can't afford bankrupts them", () => {
      expect(() => chanceTileAt(boardPosition(6))).not.toThrow();

      const amount = money(500);
      const state = makeState({
        players: [
          freePlayer({ balance: money(amount - 1) }),
          freePlayer({ id: P2 }),
          freePlayer({ id: P3 }),
        ],
      });

      const dice: Dice = { roll: () => [4, 2] };
      const card: Card = {
        id: DEBIT_CARD_1,
        kind: "debit",
        amount,
      };
      const deck: Deck = { draw: () => card };

      const result = reduce(
        state,
        { type: "RollDice" },
        makeDeps({ dice, deck }),
      );

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(6),
        },
        { type: "CardDrawn", playerId: P1, cardId: DEBIT_CARD_1 },
        { type: "WentBankrupt", playerId: P1 },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = playerById(result.state, P1);
      expect(p1).toEqual({ id: P1, kind: "bankrupt" });
    });

    it("does not bankrupt a lander whose balance exactly covers a debit card", () => {
      expect(() => chanceTileAt(boardPosition(6))).not.toThrow();

      const amount = money(500);
      const state = makeState({
        players: [
          freePlayer({ balance: money(amount) }),
          freePlayer({ id: P2 }),
        ],
      });

      const dice: Dice = { roll: () => [4, 2] };
      const card: Card = {
        id: DEBIT_CARD_1,
        kind: "debit",
        amount,
      };
      const deck: Deck = { draw: () => card };

      const result = reduce(
        state,
        { type: "RollDice" },
        makeDeps({ dice, deck }),
      );

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(6),
        },
        { type: "CardDrawn", playerId: P1, cardId: DEBIT_CARD_1 },
        { type: "PaidToBank", playerId: P1, amount },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      expect(p1.balance).toBe(0);
    });

    it("a repair card charges per owned property plus per improvement", () => {
      expect(() => chanceTileAt(boardPosition(6))).not.toThrow();

      const state = makeState({
        ownership: new Map([
          [boardPosition(1), P1],
          [boardPosition(35), P1],
        ]),
        improvements: new Map([[boardPosition(1), improvementLevel(4)]]),
      });

      const amount: Money = money(400 * 2 + 200 * 3);
      const dice: Dice = { roll: () => [4, 2] };
      const card: Card = {
        id: REPAIR_CARD,
        kind: "repair",
        perProperty: money(400),
        perImprovement: money(200),
      };
      const deck: Deck = { draw: () => card };

      const result = reduce(
        state,
        { type: "RollDice" },
        makeDeps({ dice, deck }),
      );

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(6),
        },
        { type: "CardDrawn", playerId: P1, cardId: REPAIR_CARD },
        { type: "PaidToBank", playerId: P1, amount },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      expect(p1.balance).toBe(STARTING_BALANCE - amount);
    });

    it("a repair card charges nothing when the lander holds nothing", () => {
      expect(() => chanceTileAt(boardPosition(6))).not.toThrow();

      const state = makeState({});

      const dice: Dice = { roll: () => [4, 2] };
      const card: Card = {
        id: REPAIR_CARD,
        kind: "repair",
        perProperty: money(400),
        perImprovement: money(200),
      };
      const deck: Deck = { draw: () => card };

      const result = reduce(
        state,
        { type: "RollDice" },
        makeDeps({ dice, deck }),
      );

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(6),
        },
        { type: "CardDrawn", playerId: P1, cardId: REPAIR_CARD },
        { type: "PaidToBank", playerId: P1, amount: 0 },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P2));
      expect(p1.balance).toBe(STARTING_BALANCE);
    });

    it("a repair card does not charge per railways", () => {
      expect(() => chanceTileAt(boardPosition(6))).not.toThrow();

      const state = makeState({
        ownership: new Map([
          [boardPosition(4), P1],
          [boardPosition(13), P1],
        ]),
        improvements: new Map([[boardPosition(1), improvementLevel(4)]]),
      });

      const dice: Dice = { roll: () => [4, 2] };
      const card: Card = {
        id: REPAIR_CARD,
        kind: "repair",
        perProperty: money(400),
        perImprovement: money(200),
      };
      const deck: Deck = { draw: () => card };

      const result = reduce(
        state,
        { type: "RollDice" },
        makeDeps({ dice, deck }),
      );

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(6),
        },
        { type: "CardDrawn", playerId: P1, cardId: REPAIR_CARD },
        { type: "PaidToBank", playerId: P1, amount: money(0) },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = inPlay(playerById(result.state, P1));
      expect(p1.balance).toBe(STARTING_BALANCE);
    });

    it("a repair card bankrupts a lander who can't afford the repair amount", () => {
      expect(() => chanceTileAt(boardPosition(6))).not.toThrow();

      const amount: Money = money(400 * 2 + 200 * 3);
      const state = makeState({
        players: [
          freePlayer({ balance: money(amount - 1) }),
          freePlayer({ id: P2 }),
          freePlayer({ id: P3 }),
        ],
        ownership: new Map([
          [boardPosition(1), P1],
          [boardPosition(35), P1],
        ]),
        improvements: new Map([[boardPosition(1), improvementLevel(4)]]),
      });

      const dice: Dice = { roll: () => [4, 2] };
      const card: Card = {
        id: REPAIR_CARD,
        kind: "repair",
        perProperty: money(400),
        perImprovement: money(200),
      };
      const deck: Deck = { draw: () => card };

      const result = reduce(
        state,
        { type: "RollDice" },
        makeDeps({ dice, deck }),
      );

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(6),
        },
        { type: "CardDrawn", playerId: P1, cardId: REPAIR_CARD },
        { type: "WentBankrupt", playerId: P1 },
        { type: "TurnBegan", playerId: P2 },
      ]);

      const p1 = playerById(result.state, P1);
      expect(p1).toEqual({ id: P1, kind: "bankrupt" });
    });
  });

  describe("Advance", () => {
    it("emits turnBegan for the player whose turn now begins", () => {
      const state = makeState();

      const dice: Dice = { roll: () => [4, 5] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(9),
        },
        {
          type: "TurnBegan",
          playerId: P2,
        },
      ]);
    });

    it("advances to the next player after a turn-ending roll", () => {
      const player1 = freePlayer({});
      const player2 = freePlayer({ id: P2 });
      const state = makeState({ players: [player1, player2] });

      const dice: Dice = { roll: () => [4, 5] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.state).toEqual({
        ...state,
        players: [{ ...player1, position: boardPosition(9) }, player2],
        currentPlayerId: P2,
      });
    });

    it("skips a bankrupt player when advancing", () => {
      const player1 = freePlayer({});
      const player2 = bankruptPlayer({ id: P2 });
      const player3 = freePlayer({ id: P3 });
      const state = makeState({ players: [player1, player2, player3] });

      const dice: Dice = { roll: () => [4, 5] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.state).toEqual({
        ...state,
        players: [{ ...player1, position: boardPosition(9) }, player2, player3],
        currentPlayerId: P3,
      });
    });

    it("wraps around to the first player after the last player's turn", () => {
      const state = makeState({ currentPlayerId: P2 });

      const dice: Dice = { roll: () => [4, 5] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P2,
          from: boardPosition(0),
          to: boardPosition(9),
        },
        { type: "TurnBegan", playerId: P1 },
      ]);
    });
  });

  describe("Win", () => {
    it("emits PlayerWon when a bankruptcy leaves one in play & does not emit TurnBegan", () => {
      const state = makeState({
        players: [freePlayer({ balance: money(0) }), freePlayer({ id: P2 })],
      });

      const dice: Dice = { roll: () => [1, 2] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.events).toEqual([
        {
          type: "Moved",
          playerId: P1,
          from: boardPosition(0),
          to: boardPosition(3),
        },
        {
          playerId: P1,
          type: "WentBankrupt",
        },
        {
          type: "PlayerWon",
          playerId: P2,
        },
      ]);
    });

    it("keeps currentPlayerId on the winner", () => {
      const player1 = freePlayer({ balance: money(0) });
      const player2 = freePlayer({ id: P2 });
      const state = makeState({
        players: [player1, player2],
      });

      const dice: Dice = { roll: () => [1, 2] };

      const result = reduce(state, { type: "RollDice" }, makeDeps({ dice }));

      assertAccepted(result);

      expect(result.state).toEqual({
        ...state,
        players: [bankruptPlayer(), player2],
        currentPlayerId: P2,
      });
    });
  });
});

describe("BuyProperty", () => {
  it("rejects BuyProperty when the player is not standing on a buyable tile", () => {
    const state = makeState({});

    const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

    expect(result).toEqual({ status: "rejected", reason: "NotBuyable" });
  });

  it("rejects BuyProperty when the turn kind is not purchase", () => {
    const state = makeState({
      players: [freePlayer({ position: boardPosition(1) })],
    });

    const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

    expect(result).toEqual({ status: "rejected", reason: "NoPendingPurchase" });
  });

  it("returns the turn to roll after buying", () => {
    const tile = propertyTileAt(boardPosition(1));
    const player1 = freePlayer({ position: boardPosition(1) });
    const state = makeState({
      players: [player1],
      turn: turnPurchase(),
    });

    const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

    assertAccepted(result);

    expect(result.state).toEqual({
      ...state,
      players: [{ ...player1, balance: player1.balance - tile.price }],
      ownership: new Map([[boardPosition(1), P1]]),
      turn: turnRoll(),
    });
  });

  describe("Properties", () => {
    it("buys the unowned property the player is standing on", () => {
      const state = makeState({
        players: [
          freePlayer({ position: boardPosition(1) }),
          freePlayer({ id: P2 }),
        ],
        turn: turnPurchase(),
      });

      const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

      assertAccepted(result);

      expect(result.events).toEqual([
        { type: "PropertyBought", playerId: P1, position: boardPosition(1) },
        { type: "TurnBegan", playerId: P2 },
      ]);
      expect(result.state.ownership.get(boardPosition(1))).toBe(P1);
    });

    it("deducts the property's price from the buyer's balance", () => {
      const tile = propertyTileAt(boardPosition(1));

      const state = makeState({
        players: [freePlayer({ position: boardPosition(1) })],
        turn: turnPurchase(),
      });

      const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

      assertAccepted(result);

      const buyer = inPlay(currentPlayer(result.state));
      expect(buyer.balance).toBe(STARTING_BALANCE - tile.price);
    });

    it("rejects BuyProperty when the player can't afford the property", () => {
      const tile = propertyTileAt(boardPosition(1));

      const state = makeState({
        players: [
          freePlayer({
            position: boardPosition(1),
            balance: money(tile.price - 1),
          }),
        ],
        turn: turnPurchase(),
      });

      const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

      expect(result).toEqual({
        status: "rejected",
        reason: "InsufficientFunds",
      });
    });

    it("rejects BuyProperty when the property is already owned", () => {
      const state = makeState({
        // balance: 0 because "AlreadyOwned" should be checked before "Insufficient balance"
        players: [
          freePlayer({ position: boardPosition(1), balance: money(0) }),
        ],
        ownership: new Map([[boardPosition(1), P2]]),
      });

      const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

      expect(result).toEqual({ status: "rejected", reason: "AlreadyOwned" });
    });
  });

  describe("Railroads", () => {
    it("emits PropertyBought", () => {
      expect(() => railroadTileAt(boardPosition(4))).not.toThrow();
      const state = makeState({
        players: [
          freePlayer({ position: boardPosition(4) }),
          freePlayer({ id: P2 }),
        ],
        turn: turnPurchase(),
      });

      const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

      assertAccepted(result);

      expect(result.events).toEqual([
        { type: "PropertyBought", playerId: P1, position: boardPosition(4) },
        { type: "TurnBegan", playerId: P2 },
      ]);
    });

    it("appends the railroad to the player's ownership", () => {
      expect(() => railroadTileAt(boardPosition(4))).not.toThrow();
      const state = makeState({
        players: [freePlayer({ position: boardPosition(4) })],
        turn: turnPurchase(),
      });

      const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

      assertAccepted(result);

      expect(result.state.ownership.get(boardPosition(4))).toBe(P1);
    });

    it("deducts the railroad's price from the player's balance ", () => {
      const railroad = railroadTileAt(boardPosition(4));
      const state = makeState({
        players: [freePlayer({ position: boardPosition(4) })],
        turn: turnPurchase(),
      });

      const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

      assertAccepted(result);

      const p1 = inPlay(playerById(result.state, P1));
      expect(p1.balance).toBe(STARTING_BALANCE - railroad.price);
    });

    it("rejects buying an already-owned railroad", () => {
      expect(() => railroadTileAt(boardPosition(4))).not.toThrow();
      const state = makeState({
        players: [
          freePlayer({ position: boardPosition(4) }),
          freePlayer({ id: P2 }),
        ],
        ownership: new Map([[boardPosition(4), P2]]),
      });

      const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

      expect(result).toEqual({ status: "rejected", reason: "AlreadyOwned" });
    });

    it("rejects buying a railroad you can't afford", () => {
      const railroad = railroadTileAt(boardPosition(4));
      const state = makeState({
        players: [
          freePlayer({
            position: boardPosition(4),
            balance: money(railroad.price - 1),
          }),
        ],
        turn: turnPurchase(),
      });

      const result = reduce(state, { type: "BuyProperty" }, makeDeps({}));

      expect(result).toEqual({
        status: "rejected",
        reason: "InsufficientFunds",
      });
    });
  });
});

describe("ImproveProperty", () => {
  it("rejects ImproveProperty when the turn kind not roll", () => {
    const state = makeState({
      ownership: new Map([[boardPosition(5), P1]]),
      turn: turnPurchase(),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      makeDeps({}),
    );

    expect(result).toEqual({
      status: "rejected",
      reason: "NoPendingRoll",
    });
  });

  it("raises an owned property to the requested level", () => {
    const state = makeState({
      ownership: new Map([[boardPosition(5), P1]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      makeDeps({}),
    );

    assertAccepted(result);

    expect(result.events).toEqual([
      {
        type: "PropertyImproved",
        playerId: P1,
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
      makeDeps({}),
    );

    expect(result).toEqual({ status: "rejected", reason: "NotAProperty" });
  });

  it("rejects improving a property the player does not own", () => {
    const state = makeState({
      ownership: new Map([[boardPosition(5), P2]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      makeDeps({}),
    );

    expect(result).toEqual({ status: "rejected", reason: "NotOwner" });
  });

  it("deducts the improvement cost from the player's balance", () => {
    const tile = propertyTileAt(boardPosition(5));

    const state = makeState({
      ownership: new Map([[boardPosition(5), P1]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      makeDeps({}),
    );

    assertAccepted(result);

    const cost = tile.costPerLevel * (4 - 1); // rate * levels added, from default 1
    const p1 = inPlay(playerById(result.state, P1));
    expect(p1.balance).toBe(STARTING_BALANCE - cost);
  });

  it("rejects improving not above the current level", () => {
    const state = makeState({
      ownership: new Map([[boardPosition(5), P1]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(1),
      },
      makeDeps({}),
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
      makeDeps({}),
    );

    expect(result).toEqual({ status: "rejected", reason: "NotAProperty" });
  });

  it("rejects improving when the player can't afford the cost", () => {
    const tile = propertyTileAt(boardPosition(5));

    const cost = tile.costPerLevel * (4 - 1);
    const state = makeState({
      players: [freePlayer({ balance: money(cost - 1) })],
      ownership: new Map([[boardPosition(5), P1]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      makeDeps({}),
    );

    expect(result).toEqual({ status: "rejected", reason: "InsufficientFunds" });
  });

  it("deducts the improvement cost from the player's balance with an already-improved property", () => {
    const tile = propertyTileAt(boardPosition(5));

    const state = makeState({
      ownership: new Map([[boardPosition(5), P1]]),
      improvements: new Map([[boardPosition(5), improvementLevel(2)]]),
    });

    const result = reduce(
      state,
      {
        type: "ImproveProperty",
        position: boardPosition(5),
        toLevel: improvementLevel(4),
      },
      makeDeps({}),
    );

    assertAccepted(result);

    const cost = tile.costPerLevel * (4 - 2);
    const p1 = inPlay(playerById(result.state, P1));
    expect(p1.balance).toBe(STARTING_BALANCE - cost);
  });
});

describe("PayJailFine", () => {
  it("rejects PayJailFine when the turn kind not roll", () => {
    const state = makeState({
      players: [
        jailedPlayer({
          kind: "jailed",
          failedAttempts: 0,
          position: JAIL_POSITION,
          balance: money(1000),
        }),
      ],
      turn: turnPurchase(),
    });

    const result = reduce(state, { type: "PayJailFine" }, makeDeps({}));

    expect(result).toEqual({
      status: "rejected",
      reason: "NoPendingRoll",
    });
  });

  it("frees a jailed player who pays the fine, charging 500", () => {
    const state = makeState({
      players: [
        jailedPlayer({
          kind: "jailed",
          failedAttempts: 0,
          position: JAIL_POSITION,
          balance: money(1000),
        }),
      ],
    });

    const result = reduce(state, { type: "PayJailFine" }, makeDeps({}));

    assertAccepted(result);

    expect(result.events).toEqual([
      { type: "JailFinePaid", playerId: P1, amount: JAIL_FINE },
    ]);

    const p1 = currentPlayer(result.state);
    expect(p1).toEqual({
      id: P1,
      position: JAIL_POSITION,
      balance: 1000 - JAIL_FINE,
      kind: "free",
    });
  });

  it("rejects a free player", () => {
    const state = makeState({
      players: [
        freePlayer({
          kind: "free",
          position: JAIL_POSITION,
          balance: money(1000),
        }),
      ],
    });

    const result = reduce(state, { type: "PayJailFine" }, makeDeps({}));

    expect(result).toEqual({ status: "rejected", reason: "NotInJail" });
  });

  it("rejects a player that doesn't have enough money in the balance", () => {
    const state = makeState({
      players: [
        jailedPlayer({
          kind: "jailed",
          failedAttempts: 0,
          position: JAIL_POSITION,
          balance: money(JAIL_FINE - 1),
        }),
      ],
    });

    const result = reduce(state, { type: "PayJailFine" }, makeDeps({}));

    expect(result).toEqual({ status: "rejected", reason: "InsufficientFunds" });
  });
});

describe("DeclinePurchase", () => {
  it("returns the turn to roll", () => {
    const state = makeState({ turn: turnPurchase() });

    const result = reduce(state, { type: "DeclinePurchase" }, makeDeps({}));

    assertAccepted(result);

    expect(result.state).toEqual({
      ...state,
      turn: turnRoll(),
      currentPlayerId: P2,
    });
  });

  it("emits PurchasedDeclined", () => {
    const player1 = freePlayer();
    const player2 = freePlayer();
    const state = makeState({
      players: [player1, player2],
      turn: turnPurchase(),
    });

    const result = reduce(state, { type: "DeclinePurchase" }, makeDeps({}));

    assertAccepted(result);

    expect(result.events).toEqual([
      { type: "PurchaseDeclined", playerId: player1.id },
      { type: "TurnBegan", playerId: player2.id },
    ]);
  });

  it("rejects when the turn kind is not purchase", () => {
    const state = makeState({});

    const result = reduce(state, { type: "DeclinePurchase" }, makeDeps({}));

    expect(result).toEqual({
      status: "rejected",
      reason: "NoPendingPurchase",
    });
  });
});

function freePlayer(overrides: Partial<FreePlayer> = {}): FreePlayer {
  return {
    id: P1,
    kind: "free",
    position: boardPosition(0),
    balance: STARTING_BALANCE,
    ...overrides,
  };
}

function jailedPlayer(overrides: Partial<JailedPlayer> = {}): JailedPlayer {
  return {
    id: P1,
    kind: "jailed",
    position: boardPosition(0),
    balance: STARTING_BALANCE,
    failedAttempts: 0,
    ...overrides,
  };
}

function bankruptPlayer(
  overrides: Partial<BankruptPlayer> = {},
): BankruptPlayer {
  return {
    id: P1,
    kind: "bankrupt",
    ...overrides,
  };
}

function inPlay(player: Player): InPlayPlayer {
  if (player.kind === "bankrupt") {
    throw new Error(`expected in play, got bankrupt: ${player.id}`);
  }
  return player;
}

function turnRoll(): TurnRoll {
  return {
    kind: "roll",
  };
}

function turnPurchase(): TurnPurchase {
  return {
    kind: "purchase",
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    players: [freePlayer({}), freePlayer({ id: P2 })],
    currentPlayerId: P1,
    ownership: new Map(),
    improvements: new Map(),
    turn: turnRoll(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<EngineDeps> = {}): EngineDeps {
  return {
    dice: noDice,
    deck: noDeck,
    ...overrides,
  };
}

function taxTileAt(position: BoardPosition): Tile & { kind: "tax" } {
  const tile = tileAt(boardPosition(position));
  if (tile.kind !== "tax") throw new Error(`expected a tax at ${position}`);
  return tile;
}

function propertyTileAt(position: BoardPosition): Tile & { kind: "property" } {
  const tile = tileAt(boardPosition(position));
  if (tile.kind !== "property")
    throw new Error(`expected a property at ${position}`);
  return tile;
}

function railroadTileAt(position: BoardPosition): Tile & { kind: "railroad" } {
  const tile = tileAt(boardPosition(position));
  if (tile.kind !== "railroad")
    throw new Error(`expected a railroad at ${position}`);
  return tile;
}

function chanceTileAt(position: BoardPosition): Tile & { kind: "chance" } {
  const tile = tileAt(boardPosition(position));
  if (tile.kind !== "chance")
    throw new Error(`expected a chance at ${position}`);
  return tile;
}

function assertAccepted(r: Reduction): asserts r is Accepted {
  if (r.status === "rejected") {
    throw new Error(`expected accepted, got rejected: ${r.reason}`);
  }
}

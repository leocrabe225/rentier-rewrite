import type { Command } from "./commands";
import type { GameEvent } from "./events";
import {
  type GameState,
  type Player,
  currentPlayer,
  getImprovementLevel,
  type FreePlayer,
  type JailedPlayer,
  type InPlayPlayer,
  type BankruptPlayer,
  type InPlayFields,
  inPlayPlayerById,
  type CommandOutcome,
} from "./domain/state";
import { type PlayerId } from "./domain/playerId";
import {
  BOARD_SIZE,
  boardPosition,
  type BoardPosition,
} from "./domain/position";
import type { PropertyColor, Tile } from "./domain/tiles";
import {
  FREE_PARKING_POSITION,
  groupPositions,
  JAIL_POSITION,
  propertyPositions,
  railroadPositions,
  tileAt,
} from "./domain/board";
import { type ImprovementLevel } from "./domain/improvementLevel";
import {
  JAIL_FINE,
  MAX_CONSECUTIVE_DOUBLES,
  MAX_JAIL_ATTEMPTS,
  RAILROAD_RENT_BASE,
} from "./domain/rules";
import { money, type Money } from "./domain/money";
import type { Card } from "./domain/card";

// Two dice, not one. Doubles matter for jail rules later.
export type DiceRoll = readonly [first: number, second: number];
export interface Dice {
  roll(): DiceRoll;
}
export interface Deck {
  draw(): Card;
}

export interface EngineDeps {
  readonly dice: Dice;
  readonly deck: Deck;
}

export interface EngineResult {
  readonly state: GameState;
  readonly events: ReadonlyArray<GameEvent>;
}

type LandingResult = EngineResult & {
  readonly outcome: CommandOutcome;
};

export type RejectionReason =
  | "NotBuyable"
  | "InsufficientFunds"
  | "AlreadyOwned"
  | "NotAProperty"
  | "NotOwner"
  | "NotAnUpgrade"
  | "NotInJail"
  | "Bankrupt"
  | "NoPendingPurchase"
  | "NoPendingRoll";

export interface Accepted extends EngineResult {
  readonly status: "accepted";
}
export interface Rejected {
  readonly status: "rejected";
  readonly reason: RejectionReason;
}

export type Reduction = Accepted | Rejected;

export function reduce(
  state: GameState,
  command: Command,
  deps: EngineDeps,
): Reduction {
  const player = currentPlayer(state);
  if (player.kind === "bankrupt") {
    return { status: "rejected", reason: "Bankrupt" };
  }

  switch (command.type) {
    case "RollDice":
      return rollDice(state, player, deps);
    case "BuyProperty":
      return buyProperty(state, player);
    case "ImproveProperty":
      return improveProperty(state, player, command);
    case "PayJailFine":
      return payJailFine(state, player);
    case "DeclinePurchase":
      return declinePurchase(state, player);
    default:
      return assertNever(command);
  }
}

function rollDice(
  state: GameState,
  player: InPlayPlayer,
  deps: EngineDeps,
): Reduction {
  if (state.turn.kind !== "roll") {
    return { status: "rejected", reason: "NoPendingRoll" };
  }

  if (player.kind === "jailed") {
    return rollForJail(state, player, deps);
  }

  return move(state, player, deps);
}

function buyProperty(state: GameState, player: InPlayPlayer): Reduction {
  const tile = tileAt(player.position);

  if (tile.kind !== "railroad" && tile.kind !== "property") {
    return { status: "rejected", reason: "NotBuyable" };
  }

  if (state.ownership.has(player.position)) {
    return { status: "rejected", reason: "AlreadyOwned" };
  }

  if (state.turn.kind !== "purchase") {
    return { status: "rejected", reason: "NoPendingPurchase" };
  }

  if (player.balance < tile.price) {
    return { status: "rejected", reason: "InsufficientFunds" };
  }

  const paidPlayer = overrideInPlayPlayer(player, {
    balance: money(player.balance - tile.price),
  });

  return finishTurn(
    withOwnership(
      replacePlayer(state, paidPlayer),
      paidPlayer.position,
      paidPlayer.id,
    ),
    [
      {
        type: "PropertyBought",
        playerId: paidPlayer.id,
        position: paidPlayer.position,
      },
    ],
    "canEnd",
  );
}

function improveProperty(
  state: GameState,
  player: InPlayPlayer,
  command: Extract<Command, { type: "ImproveProperty" }>,
): Reduction {
  const tile = tileAt(command.position);

  if (tile.kind !== "property") {
    return { status: "rejected", reason: "NotAProperty" };
  }

  if (state.ownership.get(command.position) !== player.id) {
    return { status: "rejected", reason: "NotOwner" };
  }

  const currentLevel = getImprovementLevel(state, command.position);
  if (command.toLevel <= currentLevel) {
    return { status: "rejected", reason: "NotAnUpgrade" };
  }

  if (state.turn.kind !== "roll") {
    return { status: "rejected", reason: "NoPendingRoll" };
  }

  const cost = money(tile.costPerLevel * (command.toLevel - currentLevel));

  if (cost > player.balance) {
    return { status: "rejected", reason: "InsufficientFunds" };
  }

  const paidPlayer = overrideInPlayPlayer(player, {
    balance: money(player.balance - cost),
  });

  return {
    status: "accepted",
    state: replacePlayer(
      withImprovement(state, command.position, command.toLevel),
      paidPlayer,
    ),
    events: [
      {
        type: "PropertyImproved",
        playerId: paidPlayer.id,
        position: command.position,
        level: command.toLevel,
      },
    ],
  };
}

function payJailFine(state: GameState, player: InPlayPlayer): Reduction {
  if (player.kind === "free") {
    return { status: "rejected", reason: "NotInJail" };
  }

  if (state.turn.kind !== "roll") {
    return { status: "rejected", reason: "NoPendingRoll" };
  }

  if (player.balance < JAIL_FINE) {
    return { status: "rejected", reason: "InsufficientFunds" };
  }

  const freePlayer = freeJailedPlayer(
    overrideJailedPlayer(player, {
      balance: money(player.balance - JAIL_FINE),
    }),
  );

  return {
    status: "accepted",
    state: replacePlayer(state, freePlayer),
    events: [{ type: "JailFinePaid", playerId: player.id, amount: JAIL_FINE }],
  };
}

function move(
  state: GameState,
  player: FreePlayer,
  deps: EngineDeps,
): Accepted {
  const [a, b] = deps.dice.roll();

  if (
    a === b &&
    state.turn.consecutiveDoubles + 1 === MAX_CONSECUTIVE_DOUBLES
  ) {
    const jailed = sendToJail(state, player);
    return finishTurn(jailed.state, [...jailed.events], "mustEnd");
  }

  const rolled = recordDoubles(state, [a, b]);

  const sum = a + b;

  const from = player.position;
  const raw = from + sum;
  const to = boardPosition(raw % BOARD_SIZE);

  const movedPlayer = overrideFreePlayer(player, { position: to });
  const moved = replacePlayer(rolled, movedPlayer);

  const events: GameEvent[] = [];

  events.push({ type: "Moved", playerId: movedPlayer.id, from, to });
  if (raw >= BOARD_SIZE) {
    events.push({ type: "PassedGo", playerId: movedPlayer.id });
  }

  const landing = applyLanding(moved, movedPlayer, deps);
  events.push(...landing.events);

  return finishTurn(landing.state, events, landing.outcome);
}

function declinePurchase(state: GameState, player: InPlayPlayer): Reduction {
  if (state.turn.kind !== "purchase") {
    return { status: "rejected", reason: "NoPendingPurchase" };
  }

  return finishTurn(
    state,
    [{ type: "PurchaseDeclined", playerId: player.id }],
    "canEnd",
  );
}

function rollForJail(
  state: GameState,
  player: JailedPlayer,
  deps: EngineDeps,
): Accepted {
  const [a, b] = deps.dice.roll();

  if (a === b) {
    const freedPlayer = freeJailedPlayer(player);
    const newState = replacePlayer(state, freedPlayer);
    const events: GameEvent[] = [
      { type: "FreedFromJail", playerId: freedPlayer.id },
    ];

    const moved = move(newState, freedPlayer, deps);
    events.push(...moved.events);
    return {
      state: moved.state,
      events: events,
      status: "accepted",
    };
  }

  const failedAttempts = player.failedAttempts + 1;

  if (failedAttempts < MAX_JAIL_ATTEMPTS) {
    const newPlayer = overrideJailedPlayer(player, {
      failedAttempts: failedAttempts,
    });

    return finishTurn(
      replacePlayer(state, newPlayer),
      [{ type: "RemainedInJail", playerId: player.id }],
      "mustEnd",
    );
  }

  return finishTurn(
    replacePlayer(state, freeJailedPlayer(player)),
    [{ type: "FreedFromJail", playerId: player.id }],
    "mustEnd",
  );
}

function replacePlayer(state: GameState, player: Player): GameState {
  const players = state.players.map((p) => (p.id === player.id ? player : p));

  return {
    ...state,
    players,
  };
}

function finishTurn(
  state: GameState,
  events: GameEvent[],
  outcome: CommandOutcome,
): Accepted {
  if (state.players.filter((p) => p.kind !== "bankrupt").length === 1) {
    const win = nextPlayerId(state);
    events.push({ type: "PlayerWon", playerId: win });
    return {
      status: "accepted",
      state: { ...state, currentPlayerId: win },
      events,
    };
  }

  switch (outcome) {
    case "canEnd": {
      if (state.turn.doubled) {
        return {
          status: "accepted",
          state: {
            ...state,
            turn: {
              kind: "roll",
              consecutiveDoubles: state.turn.consecutiveDoubles,
              doubled: false,
            },
          },
          events,
        };
      } else {
        return advanceTurn(state, events);
      }
    }
    case "mustWait": {
      return {
        status: "accepted",
        state,
        events,
      };
    }
    case "mustEnd": {
      return advanceTurn(state, events);
    }
    default:
      return assertNever(outcome);
  }
}

function advanceTurn(state: GameState, events: GameEvent[]): Accepted {
  const next = nextPlayerId(state);
  events.push({ type: "TurnBegan", playerId: next });
  return {
    status: "accepted",
    state: {
      ...state,
      turn: { kind: "roll", consecutiveDoubles: 0, doubled: false },
      currentPlayerId: next,
    },
    events,
  };
}

function recordDoubles(state: GameState, roll: DiceRoll): GameState {
  const doubled = roll[0] === roll[1];
  return {
    ...state,
    turn: {
      ...state.turn,
      doubled,
      consecutiveDoubles: doubled
        ? state.turn.consecutiveDoubles + 1
        : state.turn.consecutiveDoubles,
    },
  };
}

function overrideJailedPlayer(
  player: JailedPlayer,
  patch: Partial<Omit<JailedPlayer, "id">>,
): JailedPlayer {
  return {
    ...player,
    ...patch,
  };
}

function overrideInPlayPlayer(
  player: InPlayPlayer,
  patch: Partial<Omit<InPlayFields, "id">>,
): InPlayPlayer {
  return {
    ...player,
    ...patch,
  };
}

function overrideFreePlayer(
  player: FreePlayer,
  patch: Partial<Omit<FreePlayer, "id">>,
): FreePlayer {
  return {
    ...player,
    ...patch,
  };
}

function jailPlayer(player: FreePlayer): JailedPlayer {
  return {
    id: player.id,
    balance: player.balance,
    kind: "jailed",
    position: JAIL_POSITION,
    failedAttempts: 0,
  };
}

function freeJailedPlayer(player: JailedPlayer): FreePlayer {
  return {
    id: player.id,
    balance: player.balance,
    position: player.position,
    kind: "free",
  };
}

function bankruptInPlayPlayer(player: InPlayPlayer): BankruptPlayer {
  return {
    id: player.id,
    kind: "bankrupt",
  };
}

function withOwnership(
  state: GameState,
  position: BoardPosition,
  playerId: PlayerId,
): GameState {
  const ownership = new Map(state.ownership);

  ownership.set(position, playerId);
  return {
    ...state,
    ownership,
  };
}

function withImprovement(
  state: GameState,
  position: BoardPosition,
  toLevel: ImprovementLevel,
): GameState {
  const improvements = new Map(state.improvements);

  improvements.set(position, toLevel);
  return {
    ...state,
    improvements,
  };
}

function applyLanding(
  state: GameState,
  player: FreePlayer,
  deps: EngineDeps,
): LandingResult {
  const tile = tileAt(player.position);

  switch (tile.kind) {
    case "go":
      return {
        state,
        events: [],
        outcome: "canEnd",
      };
    case "property": {
      return landOnProperty(state, player, tile);
    }
    case "railroad": {
      return landOnRailroad(state, player);
    }
    case "go-to-jail": {
      return { ...sendToJail(state, player), outcome: "mustEnd" };
    }
    case "jail":
      return {
        state,
        events: [],
        outcome: "canEnd",
      };
    case "freeParking": {
      return { ...drawToFreeParking(state), outcome: "canEnd" };
    }
    case "tax": {
      return {
        ...chargeBank(state, player, tile.amount, {
          type: "TaxPaid",
          playerId: player.id,
          amount: tile.amount,
        }),
        outcome: "canEnd",
      };
    }
    case "chance": {
      return {
        ...applyCard(state, player, deps.deck.draw()),
        outcome: "canEnd",
      };
    }
    default:
      return assertNever(tile);
  }
}

function landOnProperty(
  state: GameState,
  player: FreePlayer,
  tile: Extract<Tile, { kind: "property" }>,
): LandingResult {
  const ownerId = state.ownership.get(player.position);

  if (ownerId === undefined) {
    return {
      state: { ...state, turn: { ...state.turn, kind: "purchase" } },
      events: [
        {
          type: "LandedOnProperty",
          playerId: player.id,
          position: player.position,
        },
      ],
      outcome: "mustWait",
    };
  }

  if (ownerId === player.id) {
    return {
      state,
      events: [],
      outcome: "canEnd",
    };
  }

  const owner = inPlayPlayerById(state, ownerId);

  const monopolyFactor = ownsWholeGroup(state, owner.id, tile.color) ? 2 : 1;
  const level = getImprovementLevel(state, player.position);
  const rent = money(tile.rent * level * monopolyFactor);

  return {
    ...chargeRent(state, player, owner, rent),
    outcome: "canEnd",
  };
}

function landOnRailroad(state: GameState, player: FreePlayer): LandingResult {
  const ownerId = state.ownership.get(player.position);

  if (ownerId === undefined) {
    return {
      state: { ...state, turn: { ...state.turn, kind: "purchase" } },
      events: [
        {
          type: "LandedOnRailroad",
          playerId: player.id,
          position: player.position,
        },
      ],
      outcome: "mustWait",
    };
  }

  if (ownerId === player.id) {
    return {
      state,
      events: [],
      outcome: "canEnd",
    };
  }

  const owner = inPlayPlayerById(state, ownerId);

  const railroadAmount = getOwnedRailroad(state, owner.id).length;

  const rent = money(RAILROAD_RENT_BASE * 2 ** (railroadAmount - 1));

  return {
    ...chargeRent(state, player, owner, rent),
    outcome: "canEnd",
  };
}

function sendToJail(state: GameState, player: FreePlayer): EngineResult {
  const jailedPlayer = jailPlayer(player);
  return {
    state: replacePlayer(state, jailedPlayer),
    events: [
      {
        type: "Moved",
        playerId: player.id,
        from: player.position,
        to: JAIL_POSITION,
      },
      { type: "SentToJail", playerId: player.id },
    ],
  };
}

function drawToFreeParking(state: GameState): EngineResult {
  const events: GameEvent[] = state.players.flatMap((p) =>
    p.kind === "free" && p.position !== FREE_PARKING_POSITION
      ? [
          {
            type: "Moved",
            playerId: p.id,
            from: p.position,
            to: FREE_PARKING_POSITION,
          },
          { type: "DrawnToFreeParking", playerId: p.id },
        ]
      : [],
  );

  const players: Player[] = state.players.map((p) =>
    p.kind === "free" && p.position !== FREE_PARKING_POSITION
      ? { ...p, position: FREE_PARKING_POSITION }
      : p,
  );

  return { events, state: { ...state, players } };
}

function applyCard(
  state: GameState,
  player: FreePlayer,
  card: Card,
): EngineResult {
  const events: GameEvent[] = [];

  events.push({ type: "CardDrawn", playerId: player.id, cardId: card.id });

  switch (card.kind) {
    case "credit": {
      const creditPlayer = overrideFreePlayer(player, {
        balance: money(player.balance + card.amount),
      });

      events.push({
        type: "ReceivedFromBank",
        playerId: player.id,
        amount: card.amount,
      });

      return {
        state: replacePlayer(state, creditPlayer),
        events,
      };
    }
    case "debit": {
      const result = chargeBank(state, player, card.amount, {
        type: "PaidToBank",
        playerId: player.id,
        amount: card.amount,
      });

      events.push(...result.events);

      return {
        state: result.state,
        events,
      };
    }
    case "repair": {
      const ownedProperties = getOwnedProperties(state, player.id);
      const sumImprovements = improvementsSumOwnedBy(state, player.id);

      const amount = money(
        ownedProperties.length * card.perProperty +
          sumImprovements * card.perImprovement,
      );

      const result = chargeBank(state, player, amount, {
        type: "PaidToBank",
        playerId: player.id,
        amount,
      });

      events.push(...result.events);

      return {
        state: result.state,
        events,
      };
    }
    default:
      return assertNever(card);
  }
}

function nextPlayerId(state: GameState): PlayerId {
  const count = state.players.length;
  const start = state.players.findIndex((p) => p.id === state.currentPlayerId);

  for (let step = 1; step <= count; step++) {
    const candidate = state.players[(start + step) % count];
    if (candidate && candidate.kind !== "bankrupt") return candidate.id;
  }

  throw new Error("no in-play player to advance to");
}

function bankrupt(state: GameState, player: FreePlayer): EngineResult {
  const bankruptPlayer = bankruptInPlayPlayer(player);

  const newState = releaseProperties(state, bankruptPlayer.id);

  return {
    state: replacePlayer(newState, bankruptPlayer),
    events: [{ type: "WentBankrupt", playerId: bankruptPlayer.id }],
  };
}

function transfer(
  state: GameState,
  from: InPlayPlayer,
  to: InPlayPlayer,
  amount: Money,
): GameState {
  const newFrom = overrideInPlayPlayer(from, {
    balance: money(from.balance - amount),
  });
  const newTo = overrideInPlayPlayer(to, {
    balance: money(to.balance + amount),
  });

  return replacePlayer(replacePlayer(state, newFrom), newTo);
}

function chargeBank(
  state: GameState,
  player: FreePlayer,
  amount: Money,
  paid: GameEvent,
): EngineResult {
  if (player.balance < amount) return bankrupt(state, player);
  const charged = overrideFreePlayer(player, {
    balance: money(player.balance - amount),
  });
  return { state: replacePlayer(state, charged), events: [paid] };
}

function chargeRent(
  state: GameState,
  from: FreePlayer,
  to: InPlayPlayer,
  rent: Money,
): EngineResult {
  if (from.balance < rent) {
    return bankrupt(state, from);
  }

  return {
    state: transfer(state, from, to, rent),
    events: [{ type: "RentPaid", from: from.id, to: to.id, amount: rent }],
  };
}

function releaseProperties(state: GameState, id: PlayerId): GameState {
  const ownership = new Map(
    [...state.ownership].filter(([, owner]) => owner !== id),
  );
  const improvements = new Map(
    [...state.improvements].filter(([pos]) => state.ownership.get(pos) !== id),
  );
  return { ...state, ownership, improvements };
}

function ownsWholeGroup(
  state: GameState,
  owner: PlayerId,
  color: PropertyColor,
): boolean {
  return groupPositions(color).every(
    (pos) => state.ownership.get(pos) === owner,
  );
}

function getOwnedRailroad(
  state: GameState,
  owner: PlayerId,
): readonly BoardPosition[] {
  return railroadPositions().filter(
    (pos) => state.ownership.get(pos) === owner,
  );
}

function getOwnedProperties(
  state: GameState,
  owner: PlayerId,
): readonly BoardPosition[] {
  return propertyPositions().filter(
    (pos) => state.ownership.get(pos) === owner,
  );
}

function improvementsSumOwnedBy(state: GameState, owner: PlayerId): number {
  return [...state.improvements]
    .filter((imp) => state.ownership.get(imp[0]) === owner)
    .reduce((sum, imp) => sum + (imp[1] - 1), 0);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled variant : ${JSON.stringify(value)}`);
}

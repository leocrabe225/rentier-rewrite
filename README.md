# Rentier

A ground-up TypeScript rewrite of the first real program I ever wrote: a four-player Monopoly variant, built in school, in 500 lines of Python, half of that in a single function.

## The legacy

One file holds a complete, playable game: four players, property purchase, rent with monopoly detection, railways, jail, chance cards, bankruptcy. It worked. It was also:

- A single ~500-line file, orchestrated by one god function
- All state in module-level globals, mutated from everywhere
- The entire domain in seven parallel arrays, indexed by convention board positions were 1-indexed, the arrays 0-indexed, and nothing enforced the `-1`. The issue tracker has two real off-by-one bugs born exactly there.
- UI bookkeeping by hand: every button manually shown and hidden at every state change, widgets touched from background `threading.Timer` loops re-arming themselves every 10 ms
- Board geometry as hand-derived magic offsets per edge (`xAjout2 = -11`), where one rotation transform would have done
- A chance card with a value of 200400, because it's never used, as a way to prevent the crash, and act as a remainder that this is the special card, as data
- A game with no ending: when one player remained, the window simply froze. Victory was implied.

This file taught me more than anything else I've written. This repo is the act of paying that debt.

## Design goals

**Commands in, events out.** Player intent enters as explicit commands (`RollDice`, `BuyProperty`, `ImproveProperty`); the engine validates them and returns events. Nothing mutates state from a distance, and nothing has to reconstruct _what happened_ from _how the state changed_. Replay, undo, and an honest audit trail fall out for free.

**A typed domain instead of parallel arrays.** Tiles are a discriminated union; the compiler enforces exhaustive handling of every tile type. A board position is a type, not a convention. The class of bug that produced the legacy's off-by-ones does not compile here.

**A pure core.** The engine knows nothing about rendering. Plain TypeScript, deterministic under a seeded RNG, fully testable without a DOM, a thread, or a single `sleep`.

**Tests as the spec.** Rent math, monopoly detection, jail rules, bankruptcy, written as tests first. The legacy's bugs survived for years because no verification existed beyond play; here, the rules are pinned down before the board exists.

## Status

In progress, domain core first, fully tested. A thin React board view comes after the engine is trustworthy, not before: the legacy spent half its lines manually showing and hiding widgets, and the rewrite's UI will be a function of state instead.

The issue tracker was seeded by an AI agent's code review of the legacy; the rewrite closes those issues one commit at a time.

## Running it

There's nothing to launch, for a pure engine, the test suite is the entry point.

```bash
npm install
npm test           # watch mode, the red/green dev loop
npm run test:run   # a single pass (e.g. CI)
npm run typecheck  # tsc --noEmit, the type gate
```

## How this was built

Every line of `rentier` is hand-written. The AI assistant I paired with was configured read-only. It could read the source and run the test suite, but never edit a file. The permission set that enforces that lives in [`.claude/settings.json`](.claude/settings.json).

## License

MIT

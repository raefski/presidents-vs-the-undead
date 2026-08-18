# PRESIDENTS vs. THE UNDEAD — working notes

**If you don't know what this game is, read [GAME.md](GAME.md) before touching
anything.** It covers the premise, every system, the win condition, and the
content boundaries that are deliberate and should hold.

## Files the developer owns. Do not edit without being asked.

**`js/data/balance-overrides.js`**

This holds hand-tuned president attributes, set deliberately through the dev
menu (F1) and exported to code. It is applied *after* `presidents.js` and wins
over it.

Treat the `BALANCE_OVERRIDES` block as authoritative:

- Never rewrite, reformat, or "rebalance" the numbers in it.
- Never clear it as part of a refactor, cleanup, or gameplay iteration.
- If a balance change seems to require touching it, **ask first** and say why.
- Changing defaults in `presidents.js` is fine — overrides layer on top and
  will simply keep winning, which is the intent.

If asked to rebalance a president, prefer changing `p.base` in
`presidents.js`. Only touch the overrides file on an explicit instruction.

## Balance model

Every president's stats are three layers:

```
BASE_STATS  →  p.base (presidents.js)  →  BALANCE_OVERRIDES  →  live dev tweaks
```

`rebuildPresidentStats()` reassembles all of it and can be re-run at any time.
Live dev tweaks live in browser localStorage under `pvu.balance.v1` and are a
working copy only — they are not in the repo.

**Attribute points** (`POINT_UNITS` in `presidents.js`) give every stat a
common currency so the roster can be compared. `p.points` is the total. As
measured on 2026-08-17 across all 16 presidents, the roster runs 4.2 (Lincoln)
to 25.1 (Teddy), average 11.6 — a gap the developer is tuning by hand. Do not
silently flatten it.

These numbers drift every time the overrides are touched, so treat them as a
snapshot and re-measure rather than trusting them.

## Testing

There is no test runner in the repo. Verification is done with a headless
harness in the session scratchpad that stubs DOM/canvas/audio and drives the
real simulation. If you need to verify changes, rebuild that harness rather
than adding test dependencies to the project.

The project must stay dependency-free and runnable by opening `index.html`
directly — no build step, no server, no external assets.

## House style

- Plain `<script>` tags, no modules, no bundler. Load order matters and is set
  in `index.html`.
- Every sprite and sound is generated at runtime. Do not add asset files.
- Comments explain *why*, especially where a number was tuned against
  measured behaviour rather than chosen freely.

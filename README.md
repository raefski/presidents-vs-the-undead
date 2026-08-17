# PRESIDENTS vs. THE UNDEAD

## A twelve-stage chronological campaign

A horde-survival game where you play one of twelve US Presidents retaking
Colonial Williamsburg from nine reanimated armies of American military history.

> **New here — human or AI?** Read **[GAME.md](GAME.md)** first. It explains
> what the game is, every system, the objectives, and how to win, assuming no
> prior knowledge. This file is the developer's reference.

You never press an attack button. Every weapon fires on its own timer — your
only decisions are where you stand and what you spend.

## Running it

Open `index.html` in a browser. That's it.

No build step, no `npm install`, no local server, no internet. Every sprite —
including all nine buildings — is drawn procedurally into an offscreen canvas
at startup, and every sound is synthesized with WebAudio. There are no asset
files.

## Controls

| | |
|---|---|
| Move | `WASD` / arrow keys / gamepad stick |
| Attack | never — all weapons are automatic |
| Upgrade | `Esc` (or `Tab`, or the UPGRADE button) |
| Pause | `P` |
| Mute / Fullscreen | `M` / `F` |

`Esc` opens the War Room because that's the thing you do constantly. `Tab` does
the same and is worth knowing: in fullscreen the browser keeps `Esc` for itself,
so it never reaches the game.

### On a phone or tablet

`js/touch.js` adds a touch layer when — and only when — the device reports a
touchscreen. It sets a `touch` class on `<body>`; every mobile CSS rule is
gated on that class, so a desktop browser renders exactly as it did before.

| | |
|---|---|
| Move | drag in the control band below the game (upright) or anywhere (sideways) |
| Upgrade | the UPGRADE button |
| Pause / Mute | the buttons in the status band |

**Portrait is the better orientation, and it reshapes the view.** Held upright
the HUD moves *off* the picture into a status band above it and a control band
below. Nothing overlaps the playfield and your thumb never covers it — which is
the whole reason to prefer it. Held sideways it behaves as before, HUD
overlaid, stick anywhere.

### Shape adapts, area does not

Desktop renders exactly 960x540, always. On a touch device the view is instead
shaped to the **device's own screen** so the picture reaches all four edges —
letterboxing a phone throws away a third of a small display.

What is held constant is `VIEW_AREA` (util.js): every device gets a view of the
same 518,400 world units², just in a different rectangle. Area is what governs
how many enemies are on screen at once, so holding it fixed is what keeps a
stage as hard on a tall phone as on a wide monitor. **Shape is presentation;
area is difficulty.** If you change `VIEW_AREA` you have changed the difficulty
of every stage on every device.

Because the view is no longer a fixed size, `VIEW_R` is recomputed with it and
`SPAWN_MIN`/`SPAWN_MAX` became `spawnMin()`/`spawnMax()` in `spawner.js` — spawn
distance is defined relative to the view edge ("just out of sight"), which is
what the original constants meant, so enemies arrive from off screen on every
device and orientation rather than at a distance captured at startup.

The stick is **direction only, never magnitude** — a half tilt moves you at the
same speed as a full one, exactly like a held arrow key. Analogue speed would
be a real balance change, since the whole game is tuned against one movement
rate.

iPhone Safari has no Fullscreen API — `requestFullscreen` is simply absent — so
the only way to lose the browser chrome is **Share → Add to Home Screen**. It
matters more than it sounds: Safari's own bars take roughly a third of the
height, which is what squeezes the playfield. The title screen says so when it
applies, and the fullscreen button removes itself where the API doesn't exist
rather than shipping a control that does nothing.

## The campaign

Twelve stages, 1781 to Mount Rushmore, defined entirely as data in
`js/data/stages.js`. Three layers keep them cheap:

- **PALETTES** — an era's ground and material colours. Every procedural draw
  reads the active palette, so an era switch recolours the world with no new
  sprites.
- **ARCHETYPES** — reusable structure templates (colonial house, tin shack,
  concrete bunker, mud compound). A stage's building says *which* archetype and
  *where*, not how to draw a roof.
- **STAGES** — layout, strongpoints, garrison factions, mini-boss pool, boss.

A new stage is about 40 lines of data. `World.loadStage()` repoints the world
globals, so the spawner, minimap and collision were untouched by the change.

Each stage's sprites are warmed on entry and the previous stage's are evicted,
so memory stays flat rather than accumulating across twelve eras.

## Stage one

Nine real Williamsburg buildings, laid out along Duke of Gloucester Street.
Each is a **strongpoint**: an undead army dug in around it, and a boss who
holds it and will not leave. Take all nine to clear the stage — about twenty
minutes.

| # | Strongpoint | Held by |
|---|---|---|
| 1 | The Wren Building | The Barrel Baron *(Whiskey Rebels)* |
| 2 | Bruton Parish Church | General Cornwallis *(Redcoats)* |
| 3 | The Courthouse | Santa Anna's Leg *(Santa Anna's Army)* |
| 4 | The Magazine | The Red Baron *(Kaiser's Stormtroopers)* |
| 5 | Peyton Randolph House | The Panzer Geist *(Wehrmacht)* |
| 6 | The Raleigh Tavern | The Zero *(Imperial Japanese Army)* |
| 7 | The Governor's Palace | The Ace of Spades *(Republican Guard)* |
| 8 | The Public Gaol | The Grand Marshal *(Revolutionary Guard)* |
| 9 | **The Capitol** | **KING GEORGE III** |

### Reading the danger before you walk into it

You have a **level**: simply the number of upgrades you've bought, shown top-left.
Every strongpoint has a **recommended level**, and the two are compared for you
in three places at once:

- the **minimap** (top of the bottom-right stack) shows all nine buildings with
  their level, colour-coded against yours — cleared ones turn blue with a tick
- the **bottom strip** names the nearest threat whenever you're within 850 units,
  well outside the aggro range, and states the verdict plainly
- the **boss nameplate** carries the same level badge in the same colour

| Verdict | Meaning |
|---|---|
| TRIVIAL | 12+ levels above it |
| READY | at or above its level |
| RISKY | up to 8 below |
| DANGEROUS | up to 22 below |
| **DEADLY** | more than 22 below — the strip pulses red |

Recommended levels run **6, 14, 22, 30, 40, 50, 60, 72, 88**. At level 1 the
Capitol reads DEADLY from across the map, which is the intent: King George
should never be a surprise.

**Garrisons are dormant until you come near.** Walk into one and the whole
post wakes up. Walk into one under-levelled and it will kill you — that's the
intended gate. Farm the streets first.

Bosses are **leashed** to their building, so you can always disengage and come
back later. Nothing chases you across town except the mini-bosses, and one of
those comes hunting roughly every eighty seconds.

The boss nameplate shows who they are and what they actually were, because
that is half the point.

## The arsenal

Each president has **three weapons, exclusive to them**. Nobody borrows.
Washington's axe is Washington's axe.

```
PRIMARY  ──(max all 8 ranks)──►  SECONDARY  ──(max both)──►  FUSION
```

The fusion is the two weapons welded together and turned up past good taste.
It costs a fortune, and the last two or three strongpoints are tuned assuming
you have it.

| President | Primary | Secondary | Fusion |
|---|---|---|---|
| Washington | Cherry Tree Axe | Continental Volley | THE DELAWARE CROSSING |
| Lincoln | Emancipation Beam | Rail-Splitter Logs | THE GETTYSBURG ADDRESS |
| Theodore Roosevelt | The Big Stick | Bull Moose Charge | THE BULLY PULPIT |
| FDR | Wheelchair of Destiny | Fireside Chat | THE FOUR FREEDOMS |
| JFK | PT-109 Ram | The Moonshot | THE NEW FRONTIER |
| Nixon | Secret Tape Trap | The 18½-Minute Gap | EXPLETIVE DELETED |
| Reagan | Jelly-Bean Barrage | Strategic Defense Initiative | THE STRATEGIC JELLY RESERVE |
| Clinton | Saxophone Shockwave | Big Mac Attack | THE THIRD WAY |
| George W. Bush | Mission Accomplished | Incoming Shoe | SHOCK AND AWE |
| Obama | The Hope Surge | Mic Drop | YES WE CAN |
| Trump | Executive Tee Time | You're Fired | THE GOLDEN ESCALATOR |
| Biden | Corvette Crush | Aviator Glare | THE AMTRAK EXPRESS |
| **Jefferson** *(hidden)* | The Declaration | The Louisiana Purchase | THE JEFFERSON BIBLE |

## The War Room

XP is **currency**, not a level track. There are no random upgrade cards. Bank
it, press `Esc`, and buy exactly what you want across five tabs:

- **ARSENAL** — weapon ranks, and the two gated unlocks
- **FIREPOWER** — damage, area, cooldown, projectile speed, duration
- **THE PRESIDENT** — move speed, health, armor, regen, a revive
- **ECONOMY** — XP gain, gold gain, luck, pickup range
- **STAFF** — your assistant, hired with **gold** rather than XP

Costs are geometric: rank 1 of anything is affordable in the first minute,
rank 5 costs a small fortune. A complete build is roughly a whole run.

## Staff

Gold hires one assistant, who follows you around and **finishes off wounded
enemies** — a job your own weapons are bad at, so they contribute steadily
without competing with you for targets. Around 10% of kills on average,
though it varies a lot: a president with short reach (Teddy) leaves their
assistant plenty to do, while one who blankets the field (Lincoln) leaves
almost none.

Every president gets their real VP or a real staffer: Lafayette, Hamlin, a
Rough Rider, Eleanor Roosevelt, LBJ, Agnew, Bush Senior, Al Gore, Cheney,
Biden, Pence (and the fly), and Harris.

## Dev menu (F1)

Press **`F1`** (or backtick, or DEV · BALANCE on the title screen) to open the
balance workbench. It works from anywhere, including mid-run.

- Edit every attribute of every president, with the **attribute point cost** of
  each change shown live
- The roster sorts by total points so outliers are obvious at a glance —
  currently 2.1 (Clinton) to 14.0 (Teddy), average 9.5
- Each president's full kit is listed with its **attack type**
- Changes apply immediately, even to a run already in progress

**Your edits persist in two layers.** They save to browser localStorage as you
work, so a refresh never loses them. **EXPORT TO CODE** then prints a
paste-ready block for `js/data/balance-overrides.js` — putting it there makes
it permanent, version-controlled, and safe from future gameplay iteration.
That file is marked developer-owned in `CLAUDE.md`; it won't be touched
without you asking.

## Attack types

Every weapon reports what kind of attack it is, on the character-select screen
and in the dev menu: MELEE, PROJECTILE, BEAM, CONE, SHOCKWAVE, AURA, ZONE,
TRAP, SPLASH, ORBITAL, BOOMERANG, RICOCHET, CHARGE — plus modifier tags for
what it does on top (SPLASH, BURN, SLOW, PINS, PIERCING, KNOCKBACK, BOUNCES,
LINGERS, SLICK, MULTI, TICKS).

So Washington's axe reads `MELEE · PIERCING`, Trump's secondary reads
`PROJECTILE · SPLASH · BURN`, and his fusion reads `SPLASH · LINGERS`.

## Code layout

Plain `<script>` tags, no modules, no bundler. Load order is set in `index.html`.

```
index.html          markup, HUD, and the War Room shell
css/style.css       HUD, menus, shop (DOM, so text stays crisp at any zoom)
js/
  util.js           math, seeded RNG, object pool, spatial hash grid
  input.js          keyboard + gamepad + touch, normalized to one direction vector
  touch.js          phones: floating thumbstick, touch HUD, rotate prompt
  audio.js          every sound synthesized at runtime with WebAudio
  art.js            every sprite drawn procedurally, cached offscreen
  data/
    balance-overrides.js  YOUR hand-tuned stats — see CLAUDE.md
    presidents.js   the 12 characters, their assistants, attribute points
    enemies.js      9 armies, 9 strongpoint bosses, 9 mini-bosses
    upgrades.js     the passive catalogue + stat recomputation
  weapons.js        all 36 attacks (12 primary, 12 secondary, 12 fusion)
  particles.js      damage numbers and VFX, pooled
  world.js          the Williamsburg map: buildings, collision, strongpoints
  entities.js       player, enemy AI, 13 shot behaviors, pickups
  companions.js     the hired assistant, and the Rushmore allied presidents
  shop.js           the upgrade catalogue, gating, and purchase logic
  spawner.js        the stage director
  ui.js             menus, HUD, character select, the War Room
  devmenu.js        the F1 balance workbench
  game.js           fixed-timestep loop, camera, renderer, state machine
  main.js           bootstrap and global keys
```

### Things worth knowing if you're reading the code

**Fixed timestep.** The simulation runs at exactly 1/60s per step with an
accumulator (`game.js`), so weapon timers behave identically on a 60Hz laptop
and a 165Hz monitor.

**Nothing allocates in the hot loop.** Enemies, shots, particles, damage
numbers and pickups all come from fixed-size pools that swap-remove in O(1).
Neighbour queries write into module-scope scratch arrays.

**Spatial hashing.** `Grid` buckets enemies into 48px cells so each shot only
tests the handful that could be touching it, instead of all ~700.

**Sprites are authored at 16x24 and emitted at 2x.** `px()` in `_drawPerson`
multiplies every block by `D`, so the original silhouettes are untouched while
there's room underneath for edge shading, a nose, lapels and buttons. Every
block gets a lit top-left and a shadowed bottom-right from a single light
direction — that consistency is most of what separates a 16-bit look from a
flat one. Sprite `scale` values in the data files are halved to keep the
on-screen footprint the same. Every figure then gets a dark contour, and
bosses a thicker coloured one, built by flattening to a silhouette and
smearing it underneath.

**Depth sorting includes buildings.** They carry an explicit `sortY` (the
bottom of their footprint) so walking north of one puts you behind it.

**Weapon levels are deltas.** A definition's numeric fields are its rank-1
values; `levels[n]` holds what *changes* at rank n. The `style` field is
documentation — the behaviour that actually runs is the `beh` passed to
`spawnShot()`, which isn't always the same.

**Stats are recomputed from scratch** on every purchase, never incrementally,
so modifier drift is impossible.

## Camera zoom

`VW` / `VH` at the top of `js/util.js` are the zoom control. The game renders
to a canvas of exactly that many world units and scales it up to the window,
so raising them shows **more world at the same pixel detail** rather than
shrinking the sprites.

| Setting | Effect |
|---|---|
| `640 x 360` | very close in; sprites ~3x on a 1080p display |
| **`960 x 540`** | **default** — exactly 2x on 1080p, 2.25x the visible area |
| `1120 x 630` | further out again; sprites start getting small |

Keep the 16:9 ratio. Spawn distance, enemy culling, the vignette and the
minimap viewport box all derive from these, so changing the two numbers is
the entire change — spawns can't drift back on screen by accident.

## Tuning notes

| Want | Change | Where |
|---|---|---|
| Faster / slower stage clear | `WEAPON_COST`, `FUSION_COST`, passive `costMul` | `shop.js`, `data/upgrades.js` |
| Fewer / more roaming enemies | `rate()` | `spawner.js` |
| Tougher / softer garrisons | `guardHp`, `bossHp` in `deployStrongpoint()` | `spawner.js` |
| Bigger / smaller aggro range | the `330 * 330` in `checkStrongpoints()` | `spawner.js` |
| Mini-boss frequency | `miniT` | `spawner.js` |
| Strongpoint difficulty labels | `lvl` on each building | `world.js` |
| Threat colour bands | `threatOf()` | `world.js` |
| Assistant strength | `assistDamage()` | `companions.js` |
| **Camera zoom** | **`VW` / `VH`** | **`util.js`** |
| Sprite detail level | `D` | `art.js` |

Cost curves have **low bases and steep multipliers** on purpose. Rank 1 of
anything must be reachable in the first minute or the opening is a powerless
slog; a finished build still has to cost most of a run. Flattening the
multiplier collapses the whole pacing.

Spawn points are **rejected and retried**, never clamped to the world bounds.
Clamping means a spawn aimed off-map from near an edge gets yanked back onto
the player. `World.spawnPoint()` fans outward from the requested angle and
returns null if nothing works, and the caller just skips that spawn.

Garrisons must stay dormant until aggroed. Without that gate, nine bosses
shell you from across the map from the first second — which is exactly what
happened the first time.

---

*A parody. The presidents are public figures depicted in an obviously absurd
fictional scenario; the enemies are historical military forces, not peoples.*

# What this game is

*A briefing for someone — or something — encountering this project cold.*

---

## The one-paragraph version

**PRESIDENTS vs. THE UNDEAD** is a horde-survival action game. You pick one of
twelve US Presidents and fight through a twelve-stage chronological campaign,
from Colonial Williamsburg in 1781 to the top of Mount Rushmore.
Every stage is occupied by reanimated armies that are still holding ground. You never
press an attack button — your weapons fire automatically on their own timers,
so the entire skill expression is *positioning* and *what you spend your
experience on*. Nine buildings are held by nine bosses. **Take all nine and you
win.** It takes about fifteen to twenty-five minutes.

It is a comedy. Abraham Lincoln fires an emancipation beam from his stovepipe
hat. Franklin Roosevelt rides a spiked wheelchair. Donald Trump drops a
gold-plated escalator on people. The joke is meant to land; the game underneath
it is meant to actually work.

## What it plays like

If you know the genre: it is a *Vampire Survivors*-like with a *Zelda*-ish
overworld bolted on. Hundreds of enemies on screen, automatic attacks, an
upgrade treadmill — but instead of surviving a twenty-minute timer on an empty
plain, you're clearing fixed objectives on a real map you can retreat from.

If you don't know the genre, the essential loop is:

1. Enemies stream toward you from off screen, continuously.
2. Your weapons fire by themselves at whatever is near.
3. Dead enemies drop XP gems. You walk over them to collect.
4. XP buys upgrades. Upgrades let you kill faster. Repeat.
5. Between farming, you assault fortified positions that would kill you if you
   attacked them too early.

The tension is that standing in a crowd is how you earn, and standing in a
crowd is how you die.

---

# The objective

## How you win

**Defeat all nine strongpoint bosses** to clear a stage. Clearing a stage
unlocks the next one and pays **prestige points**. Clear all twelve to finish
the campaign — the twelfth is the ending.

Every stage is a SELF-CONTAINED RUN: you start at level 1 with only your
primary weapon, every time. Stages differ in layout, era, enemies and look —
not in raw numbers — so stage 11 is not a wall, it's a different problem.
Prestige is the only thing that carries.

### The campaign

| # | Stage | Year | Era | Associated |
|---|---|---|---|---|
| 1 | Colonial Williamsburg | 1781 | Revolution | Washington |
| 2 | Gettysburg | 1863 | Civil War | Lincoln |
| 3 | The Expanding West | 1898 | Frontier | T. Roosevelt |
| 4 | The Western Front | 1944 | WWII | FDR |
| 5 | Dallas | 1962 | Missile Crisis | JFK |
| 6 | The Central Highlands | 1968 | Vietnam | Nixon |
| 7 | Berlin | 1987 | Cold War | Reagan |
| 8 | The Road to Baghdad | 2003 | Iraq | G. W. Bush |
| 9 | The Korengal | 2010 | Afghanistan | Obama |
| 10 | Wuhan | 2020 | Pandemic | Biden |
| 11 | The Strait | 2026 | Iran | Trump |
| 12 | **Mount Rushmore** | 1941 | **The finale** | Washington |

The "associated" president is the default pick and is highlighted on the
campaign map — but **any president can play any stage**. Forcing the pairing
would throw away the eleven other builds the arsenal system exists to create.

### Stage 12 — the finale

The last stage is the mountain itself, and it is the only one built
differently:

- **The last four strongpoints are the four faces.** Washington, Jefferson,
  Roosevelt and Lincoln are tiers 4–7 on the usual nine-rung ladder; the
  approach (the sculptor's studio, the Avenue of Flags, the talus slope, the
  hoist house) is tiers 0–3.
- **The ninth is the Hall of Records.** Borglum really did cut eighteen feet
  into the canyon wall behind Lincoln in 1938, meaning to fill it with the
  founding documents and an account of who these four were. He died in 1941
  and it stood open and empty until 1998. The final enemy, **THE UNFINISHED**,
  is what a monument becomes when nobody finishes writing down what it was for.
- **The other carved presidents fight beside you.** `stage.allies` puts
  Washington, Lincoln and Roosevelt on the field alongside whoever you brought
  (skipping a duplicate of your own pick). They are real weapon owners, not
  reskinned assistants — Lincoln's beam is Lincoln's beam.
- **The nine are held by the commanders of the first eight stages**, in the
  order you met them, then the last one. The whole war, on one hillside.
- **Clearing it ends the campaign** and shows the only ending screen in the
  game. Before this existed, finishing dropped you back on the map with a line
  of text.

The Black Hills are Lakota land, guaranteed by the 1868 Treaty of Fort Laramie
and taken in 1877. The Supreme Court held the taking unlawful in 1980 and the
compensation has never been accepted. The stage says so plainly in its `note`
field and then leaves it alone — it is not a plot, and it is not a joke.

### Prestige

Clearing a stage pays `3 + stage index`, plus 5 the first time. A full
campaign yields about 162 points; the entire prestige tree costs 132.

Three upgrades, all of which change a **rule** rather than a number — and all
bought with a **separate currency**, so they cannot shift the XP cost curve
the early game is tuned around:

- **CHIEF OF STAFF** — start each stage with your assistant already hired
- **CONTINUITY OF GOVERNMENT** — carry 15–60% of unspent XP and gold forward
- **EXECUTIVE PRIVILEGE** — the arsenal gates open at rank 6, 4 or 2 instead
  of 8. The unlocks still cost the same.

Each strongpoint is a real Colonial Williamsburg building held by one army and
one boss. The bosses will not leave their buildings, so every fight is one you
chose to start.

Stage 1's nine, as an example of the shape every stage takes:

| # | Building | Boss | Recommended level |
|---|---|---|---|
| 1 | The Wren Building | The Barrel Baron | **6** |
| 2 | Bruton Parish Church | General Cornwallis | **14** |
| 3 | The Courthouse | Santa Anna's Leg | **22** |
| 4 | The Magazine | The Red Baron | **30** |
| 5 | Peyton Randolph House | The Panzer Geist | **40** |
| 6 | The Raleigh Tavern | The Zero | **50** |
| 7 | The Governor's Palace | The Ace of Spades | **60** |
| 8 | The Public Gaol | The Grand Marshal | **72** |
| 9 | **The Capitol** | **KING GEORGE III** | **88** |

They can be taken in any order, but the recommended levels are a real
difficulty ladder, and attacking far below one is fatal.

## How you lose

Your health reaches zero and you have no revive banked. There is no timer
pressure and no fail state other than dying — you can farm as long as you like,
though the town gets harder as you clear it (see *Escalation*).

---

# Core systems

## 1. You do not aim, and you do not attack

Movement is the entire control scheme: `WASD` / arrows / gamepad stick. Every
weapon has its own cooldown and fires on its own, choosing targets by its own
rule (nearest enemy, densest cluster, the direction you're facing). This is
genre-standard and deliberate. Skill is expressed as:

- **Positioning** — staying at the edge of a crowd rather than inside it
- **Route** — which strongpoint to approach, and when to walk away
- **Spending** — what you buy, and in what order

## 2. Your level is what you bought

There is no XP bar and no automatic level-up. **Your level is literally the
number of upgrades you have purchased**, starting at 1.

This matters because every boss has a **recommended level**, and the game
compares the two for you constantly (see *Threat readout*). "Level 40" means
"someone who has made forty purchases", which is a real measure of power in a
way that a time-based level would not be.

## 3. XP is currency, not progress

Enemies drop gems; gems are XP; XP is money. Press **`Esc`** to open the **War
Room** and buy exactly what you want. Nothing is offered at random — there are
no upgrade cards to choose between.

Five tabs:

| Tab | What's in it |
|---|---|
| **ARSENAL** | Weapon ranks and the two gated unlocks |
| **FIREPOWER** | Damage, area, cooldown, projectile speed, duration, +projectiles |
| **THE PRESIDENT** | Move speed, max health, armor, health regen, revives |
| **ECONOMY** | XP gain, gold gain, luck, pickup radius |
| **STAFF** | Your assistant — bought with **gold**, not XP |

Costs are geometric: low bases, steep multipliers. Rank 1 of anything costs
around 55–130 XP and is affordable in the first minute. Rank 5 costs a small
fortune. A complete build is roughly a whole run's income.

**Gold** is a second, separate currency dropped by coins, mini-bosses and
cleared strongpoints. Its only use is hiring and promoting your assistant.

## 4. The arsenal is exclusive and gated

Each president has **three weapons that only they can ever have**. There is no
mixing — Washington's axe is Washington's axe. This is what makes the twelve
characters play differently rather than converging on the same build.

They unlock in a strict chain:

```
PRIMARY ──(max all 8 ranks)──► SECONDARY ──(max both)──► FUSION
```

- **PRIMARY** — available from the start, ranks 1–8
- **SECONDARY** — costs 5,600 XP, and is *locked* until the primary is maxed
- **FUSION** — costs 29,000 XP, locked until **both** are maxed, 5 ranks

The **fusion** is the two weapons welded together and turned up past good
taste. It measures roughly **2x** the parent weapons, and the last two or three
strongpoints are tuned assuming you have one. Rushing bosses without it is the
single most common way to stall a run.

### The roster

| President | Primary | Secondary | Fusion |
|---|---|---|---|
| Washington | Cherry Tree Axe | Continental Volley | THE DELAWARE CROSSING |
| Lincoln | Emancipation Beam | Rail-Splitter Logs | THE GETTYSBURG ADDRESS |
| T. Roosevelt | The Big Stick | Bull Moose Charge | THE BULLY PULPIT |
| FDR | Wheelchair of Destiny | Fireside Chat | THE FOUR FREEDOMS |
| JFK | PT-109 Ram | The Moonshot | THE NEW FRONTIER |
| Nixon | Secret Tape Trap | The 18½-Minute Gap | EXPLETIVE DELETED |
| Reagan | Jelly-Bean Barrage | Strategic Defense Initiative | THE STRATEGIC JELLY RESERVE |
| Clinton | Saxophone Shockwave | Big Mac Attack | THE THIRD WAY |
| G. W. Bush | Mission Accomplished | Incoming Shoe | SHOCK AND AWE |
| Obama | The Hope Surge | Mic Drop | YES WE CAN |
| Trump | Executive Tee Time | You're Fired | THE GOLDEN ESCALATOR |
| Biden | Corvette Crush | Aviator Glare | THE AMTRAK EXPRESS |

### Attack types

Every weapon reports its shape, plus modifier tags:

`MELEE` `PROJECTILE` `BEAM` `CONE` `SHOCKWAVE` `AURA` `ZONE` `TRAP` `SPLASH`
`ORBITAL` `BOOMERANG` `RICOCHET` `CHARGE`

…with `SPLASH`, `BURN`, `SLOW`, `PINS`, `PIERCING`, `KNOCKBACK`, `BOUNCES`,
`LINGERS`, `SLICK`, `MULTI`, `TICKS` layered on. So the Cherry Tree Axe reads
`MELEE · PIERCING`, and You're Fired reads `PROJECTILE · SPLASH · BURN`.

This matters strategically: a `MELEE` president has to stand in danger to deal
damage, while a `BEAM` or `ORBITAL` president does not.

## 5. Strongpoints are dormant until you approach

This is the central design decision and the thing most likely to be
misunderstood.

Each of the nine buildings has a **garrison** (13–29 troops with boosted health
and damage) and a **boss**. Both are asleep — they hold position and ignore you
entirely — until you come within 330 units. Then the whole post wakes up.

- Bosses are **leashed** to their building (250 units) and never pursue you
  across town. You can always walk away.
- Garrisons **rebuild** over time if you soften one and leave, so a half-hearted
  assault accomplishes nothing.
- Killing the boss **wipes its entire garrison** instantly and flies the US flag
  over the building.

The result is that the game is a series of decisions about which fight to pick,
rather than a treadmill you ride until it kills you.

## 6. Threat readout — the game tells you what will kill you

Because attacking too early is fatal, the danger is surfaced in three places
that all use the same scale:

- **The minimap** (bottom right) shows all nine buildings, each labelled with
  its recommended level and colour-coded against yours. Cleared ones turn blue
  with a tick.
- **The bottom strip** names the nearest threat whenever you're within 850
  units — well outside the 330-unit aggro range, so you get real warning.
- **The boss nameplate** carries the same level badge in the same colour.

| Verdict | Meaning |
|---|---|
| TRIVIAL | 12+ levels above it |
| READY | at or above its level |
| RISKY | up to 8 below |
| DANGEROUS | up to 22 below |
| **DEADLY** | more than 22 below |

At level 1 the Capitol reads DEADLY from across the map. King George is never
supposed to be a surprise.

## 6a. Enemies are period-accurate, not undead

The first four stages field **living historical soldiers**, not zombies.
A faction marked `living` has the undead treatment stripped from its
sprites at load — no green skin, no hollow eyes.

- **Williamsburg** — the 33rd Regiment of Foot, grenadiers, Hessian
  jäger and light dragoons, under the Union Jack.
- **Gettysburg** — the Army of Northern Virginia, with battle flags,
  cannon, stacked arms and tents marking every yard of held ground.
- **The Expanding West** — the Spanish colonial army in rayadillo blues
  and Mexican irregulars, plus **Comanche and Apache horse warriors**:
  deliberately fast, deliberately few, and treated as the superb light
  cavalry they were rather than as a mob.
- **The Western Front** — Waffen-SS and Wehrmacht. Insignia is the Iron
  Cross and SS-style bolts; the party symbol is omitted, as in every
  mainstream WWII game.

**All nine strongpoints on these stages are held by named historical
commanders** with a real reason to be there — Tarleton, Benedict Arnold,
Cornwallis and King George at Williamsburg; Heth, Ewell, Pickett,
Longstreet and Lee at Gettysburg; Weyler, Cervera, Quanah Parker and
Victorio in the West; Peiper, Rommel, Himmler and Hitler on the Western
Front. Stats come from the tier curve, so naming them changes the
flavour and not the ladder.

## 6b. Enemy behaviour is rationed and telegraphed

Two enemy types punish a player who cannot yet out-damage them, so both
are strictly limited and both are marked:

- **Runners** (chargers and swarms) sprint at you in bursts. Capped at
  **8% of the roaming horde**, marked with a red ground ring and a forward
  chevron, and they flash a warning ring the instant they wind up to
  charge. A dash also leaves a red dust trail.
- **Shooters** lob projectiles from range. Capped at **1%**, marked with an
  orange ring and a crosshair pip.

The composition is decided *before* the unit is — a class is rolled from a
fixed quota, then a unit of that class is found. Rolling a unit and then
vetoing it against a live census is a feedback loop that oscillates around
the cap and overshoots badly.

Boss summons obey the same quota, so a summoning boss can't quietly refill
the map with sprinters.

**Enemy speed is normalised per tier and per behaviour**, deliberately: an
enemy whose pace you can't learn is one you can't position against.

## 6c. Melee presidents are compensated

A president whose primary attack has no reach must stand inside the crowd to
deal damage, which is strictly more dangerous — and worst exactly when they
are weakest. Washington, Theodore Roosevelt and Clinton (reach 64, 64 and 74
units) automatically receive **+2 armor and +20–65 HP**, derived from their
weapon's actual reach rather than hand-typed, so it stays correct if the
weapon changes.

This makes their attribute-point totals read high in the dev menu. That is
the metric being honest about its limit: points measure *stats*, not *risk*.

## 7. Mini-bosses hunt you

Roughly every 80 seconds one roaming mini-boss spawns and comes after you. They
are not tied to buildings, they *do* chase, and they pay well in gold. Their
level gates when they can appear — you won't meet Comrade Ursa (a Red Army bear
in a ushanka, level 72) early.

The Town Crier (9), Sergeant Major Boot (18), El Cornetero (27), Feldwebel
Dräger (36), The Lobbyist (36, rare, pays enormous gold), The Iron Sergeant
(45), The Divine Wind (54), The Mother of All Sergeants (63), Comrade Ursa (72).

## 8. Assistants

Gold hires one assistant per president — their real Vice President or a real
staffer. They follow you and **finish off wounded enemies**, a job your own
weapons are bad at, so they contribute without competing for targets. Around
10% of kills on average, though it varies: a short-ranged president leaves
their assistant plenty to do, while one who blankets the field leaves almost
none.

Lafayette, Hannibal Hamlin, a Rough Rider, Eleanor Roosevelt, LBJ, Spiro Agnew,
Bush Senior, Al Gore, Dick Cheney, Joe Biden, Mike Pence, Kamala Harris.

## 9. Revives

The **Rose Garden Pardon** passive (up to 2 ranks) overturns a death: full
heal, six seconds of invulnerability, a screen clear, a hard shove on
everything nearby, and a burst of speed. It's designed to be enough to actually
walk out of a strongpoint, not just die again two seconds later. Remaining
revives show as a 🌹 on the HUD.

## 10. Escalation

Difficulty is driven mostly by **strongpoints cleared**, not by the clock:

- Enemy health scales with `1 + cleared × 0.42 + minutes × 0.05`
- Spawn rate scales with `3.2 + cleared × 2.4 + minutes × 0.40` per second
- The streets fill with units from every army you have already beaten

So clearing a building makes the whole town harder. Grinding is a legitimate
strategy but not a free one.

---

# The map

A bounded 3400 × 2300 stage laid out along **Duke of Gloucester Street**, with
Palace Green running north to the Governor's Palace, Nicholson and Francis
Streets running parallel, and Market Square in the middle. Buildings are solid
— you collide with them, and you can walk behind them.

You start at **(620, 1680)**, the quiet west end of Francis Street, deliberately
550+ units clear of every garrison. The opening minutes are yours to farm in.

---

# How to actually win

1. **Farm first.** Don't approach anything until you've bought a dozen or so
   upgrades. The opening area is safe by design.
2. **Rush your primary to max.** It's the cheapest damage in the game and it
   gates everything else. Spreading XP thinly across passives early is the most
   common way to stall out — you starve your own damage growth.
3. **Take the Wren Building (level 6) early.** It's the weakest and it starts
   the escalation gently.
4. **Buy the secondary as soon as it unlocks**, then max it too.
5. **Save for the fusion.** 29,000 XP is a lot and it will feel like a long
   drought. Do it anyway — strongpoints 7, 8 and 9 assume you have it.
6. **Hire your assistant** once gold allows. It's cheap and it compounds.
7. **Watch the bottom strip.** If it says DANGEROUS or DEADLY, walk away. The
   bosses cannot follow you.
8. **Clear in roughly level order.** The recommended levels are calibrated
   against real measured play, not guessed.
9. **Bank a Rose Garden Pardon before the Capitol.** King George is level 88
   and hits for 90.

A clean run clears all nine in roughly **15–25 minutes**.

---

# Tone and content boundaries

This is parody. The presidents are public figures being sent up in their
official capacity, doing absurd things with objects associated with them. That
is the whole joke and it should stay silly rather than mean.

Two deliberate lines, worth preserving:

**Enemies are named as military forces, never as peoples.** The nine armies are
the Whiskey Rebels, Redcoats, Santa Anna's Army, the Kaiser's Stormtroopers, the
Wehrmacht, the Imperial Japanese Army, the Republican Guard, the Revolutionary
Guard and the Red Army. They are all undead. The joke is the uniform, not the
people who wore it. Do not rename these after ethnic or national groups.

**No content degrading private individuals.** A request to add Monica Lewinsky
as a sidekick — defined by the blue dress, under a sexual pun on her name — was
declined and Al Gore used instead. She is a private person whose entire public
identity was forced on her by a scandal in which she was the far less powerful
party, which is a different thing from parodying elected officials in office.
That distinction is intentional and should hold.

## Stage 10, Wuhan — where those two lines were applied

Stage 10 is set in Wuhan in 2020 and its ninth strongpoint is **THE
INSTITUTE**, which makes the lab-leak reading the game's canon. That is a
contested real-world claim about a real organisation, so the same two lines
above were applied deliberately when it was built:

- The garrisons are **the virus**, not a nationality. The factions are THE
  VARIANTS and THE COMBINED HORDE — Spike Carriers, Aerosol Clouds, Long
  Haulers. No enemy on this stage is named after, or drawn as, Chinese people.
- The boss is **an institution, not a person**: an anonymous figure in a
  positive-pressure suit. No real researcher is named, depicted or caricatured.
  The joke is the biosafety hood, in exactly the way it is the uniform
  everywhere else.

The buildings are real places and real events (the market, Hankou station, the
ten-day hospital, the sealed residential blocks) and are written straight
rather than mocked — the people in that city had the worst of it.

If the framing here isn't the one you want, this is the section to change.

---

# For an AI working on this codebase

- Read **`CLAUDE.md`** first. It marks `js/data/balance-overrides.js` as
  developer-owned — hand-tuned numbers that must not be rewritten, reformatted,
  or "helpfully rebalanced" without being asked.
- Read **`README.md`** for the file layout, architecture notes, and the tuning
  knobs.
- The project is **dependency-free by design**: plain `<script>` tags, no
  modules, no bundler, no build step, no asset files. Every sprite is drawn
  procedurally and every sound is synthesized at runtime. It must stay
  runnable by opening `index.html` directly. Do not add a toolchain.
- Press **`F1`** in game for the balance workbench: edit every attribute live,
  see the attribute-point cost of each change, and export to code.
- Numbers in this project were tuned against **measured** behaviour using a
  headless harness, not chosen by feel. If you change a balance number, measure
  the result rather than assuming it.

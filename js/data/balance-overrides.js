/* ============================================================
   balance-overrides.js  —  YOUR FILE. HAND-TUNED BALANCE.
   ============================================================

   ┌────────────────────────────────────────────────────────┐
   │  THIS FILE IS OWNED BY THE DEVELOPER, NOT BY CLAUDE.   │
   │  Do not rewrite, reformat, or "helpfully rebalance"    │
   │  the numbers below without being asked explicitly.     │
   │  Everything here deliberately overrides the defaults   │
   │  in presidents.js and survives any gameplay iteration. │
   └────────────────────────────────────────────────────────┘

   HOW IT WORKS
     A president's final stats are built in three layers:

       BASE_STATS            the neutral baseline every president shares
         + p.base            the authored personality (in presidents.js)
         + BALANCE_OVERRIDES  <-- this file, applied last, wins

     Anything you don't list here simply falls through to the default,
     so it's safe to override a single stat and ignore the rest.

   HOW TO EDIT
     Either type values in directly, or open the DEV MENU in-game
     (`F1`, or the backtick key, or the DEV BALANCE button on the title
     screen), tune with the sliders, and press EXPORT TO CODE. That
     prints a ready-to-paste replacement for the block below.

     The dev menu keeps a working copy in browser localStorage so your
     tweaks survive a refresh. Exporting to this file is what makes them
     permanent and version-controlled.

   AVAILABLE STATS
     hp        health, baseline 100
     speed     movement in world units/sec, baseline 62
     might     damage multiplier, baseline 1.0
     area      size/reach multiplier, baseline 1.0
     cooldown  attack interval multiplier, baseline 1.0 (LOWER is faster)
     duration  effect lifetime multiplier, baseline 1.0
     projSpeed projectile speed multiplier, baseline 1.0
     amount    extra projectiles, baseline 0
     armor     flat damage reduction, baseline 0
     regen     HP per second, baseline 0
     magnet    pickup radius, baseline 42
     luck      drop/crit chance multiplier, baseline 1.0
     growth    XP gain multiplier, baseline 1.0
     greed     gold gain multiplier, baseline 1.0
     revives   free deaths, baseline 0
   ============================================================ */

const BALANCE_OVERRIDES = {
  // Empty by default — every president uses the values in presidents.js.
  // Example:
  //   trump: { might: 1.25, speed: 56 },
  //   clinton: { area: 0.95 },
};

/* Set to true to ignore the browser's working copy and use only the
   values committed above. Useful when you want to check what's actually
   in the file versus what you've been fiddling with live. */
const IGNORE_LOCAL_TWEAKS = false;

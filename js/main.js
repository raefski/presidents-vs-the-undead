/* ============================================================
   main.js — bootstrap, global keys, and the animation frame loop.
   ============================================================ */

(function () {
  'use strict';

  function boot() {
    Input.init();
    Prestige.load();  // meta-progression gates the shop, so it loads first
    Dev.load();       // hand-tuned balance before anything reads a stat block
    Game.init();      // pools + sprite warm-up must exist before UI draws portraits
    TouchUI.init();   // before UI.init: the first layout has to know it's a phone
    UI.init();
    UI.show('title');
    UI.showHud(false);

    // Audio can only start from a user gesture; latch onto the first one.
    // iOS needs touchend specifically — it doesn't count every gesture.
    const unlock = () => { Sound.init(); Sound.resume(); };
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchend', unlock, { once: true });

    // Losing focus mid-run pauses instead of letting the horde eat you.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Game.state === 'playing') Game.togglePause();
    });

    Game._last = performance.now();
    requestAnimationFrame(loop);
  }

  function handleKeys() {
    /* ---- global ---- */
    // The balance workbench is reachable from anywhere, including mid-run.
    if (Input.hit('f1') || Input.hit('`') || Input.hit('~')) Dev.toggle();
    if (Game.state === 'dev') { if (Input.hit('escape')) Dev.close(); return; }

    if (Input.hit('m')) {
      const muted = Sound.toggleMute();
      if (Game.state === 'playing') FX.say(Game.player.x, Game.player.y - 34, muted ? 'MUTED' : 'UNMUTED', '#7fd4ff', 10);
    }
    if (Input.hit('f')) {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
    }

    /* ---- per state ---- */
    // The browser owns Esc while fullscreen: it exits, and our handler fires
    // too. Without this guard one keypress would both leave fullscreen and
    // toggle the War Room.
    const inFullscreen = !!document.fullscreenElement;
    const shopKey = (Input.hit('escape') && !inFullscreen) || Input.hit('tab') || Input.hit('u');

    switch (Game.state) {
      case 'title':
        if (Input.hit('enter') || Input.hit(' ')) { Sound.ui(); UI.showCampaign(); }
        break;

      case 'campaign':
        if (Input.hit('escape')) { UI.show('title'); Game.state = 'title'; }
        break;

      case 'era':
        // Any key skips the beat once the minimum display time has passed.
        if (Input.hit('enter') || Input.hit(' ') || Input.hit('escape')) Game.dismissEra();
        break;

      case 'unlock':
        if (Input.hit('enter') || Input.hit(' ') || Input.hit('escape')) Game.dismissUnlock();
        break;

      case 'help':
        if (Input.hit('escape') || Input.hit('enter')) { Sound.ui(); UI.show('title'); Game.state = 'title'; }
        break;

      case 'select':
        if (Input.hit('arrowleft') || Input.hit('a')) UI.moveSelection(-1, 0);
        if (Input.hit('arrowright') || Input.hit('d')) UI.moveSelection(1, 0);
        if (Input.hit('arrowup') || Input.hit('w')) UI.moveSelection(0, -1);
        if (Input.hit('arrowdown') || Input.hit('s')) UI.moveSelection(0, 1);
        if (Input.hit('enter') || Input.hit(' ')) { if (UI.selected) Game.beginStage(UI.selected, UI.stageIndex || 0); }
        if (Input.hit('escape')) UI.showCampaign();
        break;

      case 'playing':
        // Esc is the War Room. It's the thing you reach for constantly, so
        // it gets the most reachable key; pausing moves to P.
        // Tab and U stay as aliases: browsers reserve Esc for leaving
        // fullscreen and won't let a page intercept it there.
        if (shopKey) Game.openShop();
        if (Input.hit('p')) Game.togglePause();
        break;

      case 'shop':
        if (shopKey) Game.closeShop();
        break;

      case 'paused':
        if (Input.hit('p') || Input.hit('escape') || Input.hit('enter')) Game.togglePause();
        break;

      case 'over':
        if (Input.hit('enter') || Input.hit(' ')) {
          if (Game.won && Game.stageIndex + 1 < STAGES.length) Game.nextStage();
          else Game.restart();
        }
        if (Input.hit('escape')) UI.showCampaign();
        break;
    }
  }

  function loop(now) {
    handleKeys();
    Game.tick(now);
    Input.consumeEdges();
    requestAnimationFrame(loop);
  }

  // The scripts are plain <script> tags at the end of <body>, so the DOM
  // is already parsed — but guard anyway in case the file moves.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

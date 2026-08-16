/* ============================================================
   touch.js — phones and tablets.

   Input only ever answers one question: "which way is the player
   pushing?" So the whole touch layer is a thumbstick that writes
   Input.tx / Input.ty, plus the two buttons a phone hasn't got
   keys for.

   The stick FLOATS — it materialises wherever the thumb lands
   rather than sitting in a fixed corner. A fixed stick makes you
   look down to find it, and this game is entirely about watching
   the crowd you are standing next to. A dim ghost rests in the
   lower left so it is still discoverable on the first run.

   Direction only, never magnitude: a half-tilted stick moves you
   at full speed, exactly like a held arrow key. Analogue speed
   would be a real balance change (the whole game is tuned against
   one movement rate) and it makes fine positioning worse, not
   better, on a screen your thumb is covering.

   Everything here is inert on a desktop — init() returns early
   unless the device reports a touchscreen, and every mobile CSS
   rule is gated on the `touch` class this file sets.
   ============================================================ */

const TouchUI = {
  active: false,
  id: null,               // identifier of the touch driving the stick
  ox: 0, oy: 0,           // stick origin, viewport px
  R: 52,                  // travel to full tilt, viewport px
  DEAD: 0.22,             // fraction of R that still reads as "not moving"

  wrap: null, knob: null,

  init() {
    // maxTouchPoints is the reliable half; ontouchstart covers older
    // iOS. A laptop with a touchscreen gets the touch layer too, which
    // is correct — it also keeps the keyboard.
    this.active = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    if (!this.active) return;

    document.body.classList.add('touch');
    this.wrap = $('#stick');
    this.knob = $('#stick-knob');

    const stage = $('#stage');
    stage.addEventListener('touchstart', (e) => this.onStart(e), { passive: false });
    stage.addEventListener('touchmove', (e) => this.onMove(e), { passive: false });
    stage.addEventListener('touchend', (e) => this.onEnd(e), { passive: false });
    stage.addEventListener('touchcancel', (e) => this.onEnd(e), { passive: false });

    // iOS reports the new size a beat after the rotation animation, so a
    // second pass catches what the first one measured too early.
    window.addEventListener('orientationchange', () => {
      setTimeout(() => UI.layout(), 120);
      setTimeout(() => UI.layout(), 450);
    });

    // iOS suspends the audio context when the app goes to the
    // background and does not resume it on its own.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) Sound.resume(); });

    this.showHomeScreenHint();
    this.setupFullscreen();
  },

  /**
   * Sized and parked against the current screen, so it has to follow
   * every relayout. UI.layout() calls this; there is no second resize
   * listener, so the two can never disagree about the geometry.
   */
  onLayout() {
    if (!this.active) return;
    const m = Math.min(window.innerWidth, window.innerHeight);
    this.R = clamp(m * 0.15, 42, 88);
    this.wrap.style.setProperty('--stick-r', this.R + 'px');
    if (this.id === null) this.rest();
  },

  portrait() { return document.body.classList.contains('portrait'); },

  /** Bottom edge of the playfield in viewport px. */
  playBottom() {
    const v = getComputedStyle(UI.hud).getPropertyValue('--play-bottom');
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n + UI.stage.getBoundingClientRect().top;
  },

  /* ------------------------------------------------------------
     The stick
     ------------------------------------------------------------ */

  /**
   * Park the ghost stick. In portrait that means the control band under
   * the playfield — the whole point of portrait is that your thumb is
   * not on the picture. In landscape there is no band to put it in, so
   * it sits in the lower left of the canvas as before.
   */
  rest() {
    const st = UI.stage.getBoundingClientRect();
    if (this.portrait()) {
      const band = st.bottom - this.playBottom();
      // Far enough left to clear the minimap and UPGRADE on a narrow
      // phone, where all three are competing for one strip.
      this.place(st.left + Math.max(this.R * 1.2, st.width * 0.22),
                 this.playBottom() + band / 2, false);
    } else {
      const r = UI.canvas.getBoundingClientRect();
      this.place(r.left + this.R * 1.6, r.bottom - this.R * 1.5, false);
    }
    this.tilt(0, 0);
  },

  place(x, y, on) {
    this.ox = x; this.oy = y;
    this.wrap.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    this.wrap.classList.toggle('on', !!on);
  },

  /** Move the knob and publish the direction. dx/dy are in px. */
  tilt(dx, dy) {
    const m = Math.hypot(dx, dy);
    if (m > this.R) { dx = dx / m * this.R; dy = dy / m * this.R; }
    this.knob.style.transform =
      'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    // Below the deadzone the player is resting their thumb, not steering.
    if (m < this.R * this.DEAD) { Input.tx = Input.ty = 0; }
    else { Input.tx = dx; Input.ty = dy; }
  },

  onStart(e) {
    if (Game.state !== 'playing') return;      // menus want ordinary taps
    if (this.id !== null) return;              // one steering finger is enough
    // Anything with a real button under it is a button press, not a stick.
    if (e.target.closest && e.target.closest('button,[data-act]')) return;

    const t = e.changedTouches[0];
    // In portrait the stick lives in the control band and nowhere else.
    // Ignoring the playfield is the point: it keeps the picture clear,
    // and it means a stray tap on the game can't yank you sideways.
    if (this.portrait() && t.clientY < this.playBottom()) return;

    this.id = t.identifier;
    this.place(t.clientX, t.clientY, true);
    this.tilt(0, 0);
    Sound.resume();
    e.preventDefault();
  },

  onMove(e) {
    if (this.id === null) return;
    if (Game.state !== 'playing') { this.release(); return; }
    const t = this.find(e);
    if (!t) return;
    this.tilt(t.clientX - this.ox, t.clientY - this.oy);
    e.preventDefault();
  },

  onEnd(e) {
    if (this.id === null) return;
    if (!this.find(e)) return;
    this.release();
    e.preventDefault();
  },

  release() {
    this.id = null;
    Input.tx = Input.ty = 0;
    this.rest();
  },

  /** The touch in this event that is driving the stick, if any. */
  find(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.id) return e.changedTouches[i];
    }
    return null;
  },

  /* ------------------------------------------------------------
     Housekeeping
     ------------------------------------------------------------ */

  /**
   * iPhone Safari has no Fullscreen API — requestFullscreen simply is
   * not there on iOS, only the video-element one. So the only way to
   * lose the browser chrome is Add to Home Screen, and that is worth
   * saying plainly rather than shipping a button that does nothing.
   *
   * It matters more than it sounds: Safari's chrome is what squeezes
   * the playfield, and standalone mode is the difference between the
   * game fitting the screen exactly and being pillarboxed.
   */
  showHomeScreenHint() {
    const installed = this.standalone();
    const iOS = /iP(hone|od|ad)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
    if (iOS && !installed) $('#ios-hint').classList.remove('hidden');
  },

  standalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  },

  /**
   * Real fullscreen where the platform has it (Android, desktop). The
   * button removes itself where it doesn't, rather than lying.
   */
  setupFullscreen() {
    const btn = $('#btn-full');
    const root = document.documentElement;
    const can = !!(root.requestFullscreen || root.webkitRequestFullscreen);
    if (!can || this.standalone()) { btn.remove(); return; }
    btn.classList.remove('hidden');
    btn.addEventListener('click', () => {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fs) (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    });
  }
};

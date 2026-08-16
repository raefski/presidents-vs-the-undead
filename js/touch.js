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

    // Scale the stick to the screen: a 52px throw is a comfortable
    // thumb arc on a phone and cramped on a tablet.
    const sizeStick = () => {
      const m = Math.min(window.innerWidth, window.innerHeight);
      this.R = clamp(m * 0.15, 42, 88);
      this.wrap.style.setProperty('--stick-r', this.R + 'px');
      if (this.id === null) this.rest();
    };
    sizeStick();
    window.addEventListener('resize', sizeStick);
    window.addEventListener('orientationchange', () => setTimeout(sizeStick, 250));

    // Turning the phone upright hides the game behind the rotate
    // prompt — so it must not also be quietly killing you.
    window.addEventListener('resize', () => {
      if (window.innerHeight > window.innerWidth && Game.state === 'playing') Game.togglePause();
    });

    // iOS suspends the audio context when the app goes to the
    // background and does not resume it on its own.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) Sound.resume(); });

    this.showHomeScreenHint();
  },

  /* ------------------------------------------------------------
     The stick
     ------------------------------------------------------------ */

  /**
   * Park the ghost stick in the lower left of the playfield. Measured
   * off the canvas rather than the stage, so it sits inside the picture
   * instead of straddling the letterbox pillar on a tall phone.
   */
  rest() {
    const r = UI.canvas.getBoundingClientRect();
    this.place(r.left + this.R * 1.6, r.bottom - this.R * 1.5, false);
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
   * iPhone Safari has no Fullscreen API, so the only way to lose the
   * address bar is Add to Home Screen. Say so, once, on the title
   * screen — and only when it would actually change anything.
   */
  showHomeScreenHint() {
    const iOS = /iP(hone|od|ad)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
    const installed = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (iOS && !installed) $('#ios-hint').classList.remove('hidden');
  }
};

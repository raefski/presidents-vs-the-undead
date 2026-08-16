/* ============================================================
   input.js — keyboard + gamepad + touch, normalized to one
   direction vector. The game only ever asks: "which way is the
   player pushing?"
   ============================================================ */

const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),   // edge-triggered: true for one frame only
  ax: 0, ay: 0,                   // analog stick, -1..1
  tx: 0, ty: 0,                   // thumbstick offset in px, written by touch.js
  usingPad: false,

  init() {
    window.addEventListener('keydown', (e) => {
      // Don't hijack browser shortcuts (ctrl/meta combos).
      if (e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (GAME_KEYS.has(k)) e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Releasing keys on blur prevents "stuck running left" after alt-tab.
    // The thumbstick goes with them: iOS can swallow the touchend when a
    // notification or the app switcher takes the page away mid-drag.
    window.addEventListener('blur', () => {
      this.keys = Object.create(null);
      this.ax = this.ay = 0;
      this.tx = this.ty = 0;
      if (typeof TouchUI !== 'undefined' && TouchUI.active) TouchUI.release();
    });

    window.addEventListener('gamepadconnected', () => { this.usingPad = true; });
  },

  /** Poll the pad each frame; call once per update. */
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.ax = this.ay = 0;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p) continue;
      let x = p.axes[0] || 0, y = p.axes[1] || 0;
      // D-pad on the standard mapping.
      if (p.buttons[14] && p.buttons[14].pressed) x = -1;
      if (p.buttons[15] && p.buttons[15].pressed) x = 1;
      if (p.buttons[12] && p.buttons[12].pressed) y = -1;
      if (p.buttons[13] && p.buttons[13].pressed) y = 1;
      if (Math.abs(x) > 0.22 || Math.abs(y) > 0.22) {   // deadzone
        this.ax = x; this.ay = y; this.usingPad = true;
      }
      break; // first connected pad wins
    }
  },

  /** Was this key pressed since the last consumeEdges()? */
  hit(k) { return !!this.pressed[k]; },

  down(k) { return !!this.keys[k]; },

  /** Clear edge-triggered state. Called at the end of each frame. */
  consumeEdges() { this.pressed = Object.create(null); },

  /**
   * Player movement direction, already normalized so diagonal movement
   * isn't 41% faster than cardinal movement (a classic beginner bug).
   * Returns the shared `_dir` object — do not hold a reference to it.
   */
  _dir: { x: 0, y: 0, mag: 0 },
  dir() {
    let x = 0, y = 0;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;
    if (this.keys['w'] || this.keys['arrowup']) y -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) y += 1;

    // Touch, then pad. Keys win over both so a Bluetooth keyboard on a
    // tablet still behaves, and a resting thumb can't fight an arrow key.
    if (x === 0 && y === 0) { x = this.tx; y = this.ty; }
    if (x === 0 && y === 0) { x = this.ax; y = this.ay; }

    const m = Math.hypot(x, y);
    if (m > 1e-4) { x /= m; y /= m; }
    else { x = 0; y = 0; }

    this._dir.x = x; this._dir.y = y; this._dir.mag = Math.min(1, m);
    return this._dir;
  }
};

/** Keys we swallow so the page doesn't scroll under the game. */
const GAME_KEYS = new Set([
  'w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown',
  ' ', 'escape', 'tab', 'u', 'p', 'm', 'f', 'enter', 'f1', '`', '~'
]);

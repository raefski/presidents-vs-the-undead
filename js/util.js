/* ============================================================
   util.js — math, RNG, pooling, and small helpers.
   Loaded first; everything else assumes these globals exist.
   ============================================================ */

const TAU = Math.PI * 2;

/* ============================================================
   THE VIEW — how much world fits on screen.

   This is the zoom control. The game renders to a canvas of exactly
   this many world units and then scales that canvas up to the window,
   so raising these numbers shows MORE WORLD at the same pixel detail
   rather than shrinking the sprites.

     640 x 360   very close in; sprites ~3x on a 1080p display
     960 x 540   the default: exactly 2x on 1080p, comfortably wider
    1120 x 630   further out again, sprites start getting small

   Keep the 16:9 ratio. Everything that cares — spawn distance, culling,
   the vignette, the minimap viewport box — derives from these, so
   changing them here is the whole change.
   ============================================================ */
const VW = 960, VH = 540;

/** Half-diagonal of the view: the radius at which something is off screen. */
const VIEW_R = Math.hypot(VW / 2, VH / 2);

/** Clamp v into [lo, hi]. */
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

/** Linear interpolate. */
function lerp(a, b, t) { return a + (b - a) * t; }

/** Frame-rate independent approach: moves a toward b, `rate` per second. */
function damp(a, b, rate, dt) { return lerp(a, b, 1 - Math.exp(-rate * dt)); }

/** Squared distance — use this for comparisons to avoid a sqrt. */
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }

/** Shortest signed angle from a to b. */
function angDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/* ------------------------------------------------------------
   Deterministic RNG (mulberry32). A seeded generator means a run
   can be reproduced exactly, which makes bugs findable.
   ------------------------------------------------------------ */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Global run RNG — reseeded at the start of every run. */
let RNG = makeRng(12345);
function reseed(s) { RNG = makeRng(s); }

function rand(a, b) { return a + RNG() * (b - a); }
function randInt(a, b) { return Math.floor(a + RNG() * (b - a + 1)); }
function pick(arr) { return arr[(RNG() * arr.length) | 0]; }
function chance(p) { return RNG() < p; }

/** Fisher-Yates, in place. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (RNG() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/** Pick n distinct entries, weighted by `weightFn`. Used by the level-up roll. */
function weightedPickN(items, n, weightFn) {
  const pool = items.slice();
  const out = [];
  while (out.length < n && pool.length) {
    let total = 0;
    for (let i = 0; i < pool.length; i++) total += Math.max(0, weightFn(pool[i]));
    if (total <= 0) break;
    let r = RNG() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= Math.max(0, weightFn(pool[i]));
      if (r <= 0) { idx = i; break; }
    }
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

/* ------------------------------------------------------------
   Object pool.
   Hundreds of bullets and particles spawn every second. Allocating
   fresh objects for them would keep the garbage collector busy and
   cause visible hitches, so we recycle a fixed set instead.
   ------------------------------------------------------------ */
class Pool {
  constructor(factory, reset, size) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.active = [];
    for (let i = 0; i < size; i++) this.free.push(factory());
  }
  /** Take an object from the pool (grows if empty). */
  get() {
    const o = this.free.length ? this.free.pop() : this.factory();
    this.active.push(o);
    return o;
  }
  /** Return object at active-index i to the pool. Swap-remove: O(1). */
  releaseAt(i) {
    const o = this.active[i];
    this.reset(o);
    const last = this.active.length - 1;
    this.active[i] = this.active[last];
    this.active.pop();
    this.free.push(o);
  }
  releaseAll() {
    for (let i = this.active.length - 1; i >= 0; i--) this.releaseAt(i);
  }
  get count() { return this.active.length; }
}

/* ------------------------------------------------------------
   Spatial hash grid.
   With ~700 enemies on screen, checking every bullet against every
   enemy is 700 x 300 = 210k checks per frame. Bucketing entities by
   cell lets us test only the handful that could actually be touching.
   ------------------------------------------------------------ */
class Grid {
  constructor(cell) {
    this.cell = cell;
    this.map = new Map();   // key -> array of entities
    this._keys = [];        // keys touched this frame, so clear() is cheap
  }
  _key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }

  clear() {
    // Emptying the arrays (rather than dropping them) keeps them allocated.
    for (let i = 0; i < this._keys.length; i++) {
      const a = this.map.get(this._keys[i]);
      if (a) a.length = 0;
    }
    this._keys.length = 0;
  }

  insert(e) {
    const cx = Math.floor(e.x / this.cell), cy = Math.floor(e.y / this.cell);
    const k = this._key(cx, cy);
    let a = this.map.get(k);
    if (!a) { a = []; this.map.set(k, a); }
    if (a.length === 0) this._keys.push(k);
    a.push(e);
  }

  /**
   * Fill `out` with everything in the cells overlapping (x,y,r).
   * Allocation-free version of query() for use inside hot loops.
   * Returns the number written (capped at `max`).
   */
  queryInto(x, y, r, out, max) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const a = this.map.get(this._key(cx, cy));
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          if (n >= max) { out.length = n; return n; }
          out[n++] = a[i];
        }
      }
    }
    out.length = n;
    return n;
  }

  /**
   * Call fn(entity) for everything within `r` of (x,y).
   * Overscans slightly — callers still do a precise distance test.
   */
  query(x, y, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const a = this.map.get(this._key(cx, cy));
        if (!a) continue;
        for (let i = 0; i < a.length; i++) fn(a[i]);
      }
    }
  }
}

/* ------------------------------------------------------------
   Formatting helpers
   ------------------------------------------------------------ */
function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.floor(n));
}
function pct(x) { return Math.round(x * 100) + '%'; }

/** Tiny DOM helpers. */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

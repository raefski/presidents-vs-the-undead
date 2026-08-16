/* ============================================================
   particles.js — visual feedback.

   Two pools: generic particles (dust, ash, glitter, sparks, rings)
   and floating damage numbers. Both are fixed-size and recycled, so
   a 500-enemy screen clear allocates nothing.

   Everything here is cosmetic. Nothing in this file affects gameplay,
   which means it can be throttled freely when the frame budget is tight.
   ============================================================ */

const FX = {
  parts: null,
  nums: null,
  quality: 1,        // scaled down automatically if the frame rate drops

  init() {
    this.parts = new Pool(
      () => ({
        x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, col: '#fff',
        kind: 'dot', grav: 0, drag: 0, ang: 0, spin: 0, fade: 1, r0: 0, r1: 0
      }),
      (o) => { o.life = 0; },
      900
    );
    this.nums = new Pool(
      () => ({ x: 0, y: 0, vy: 0, life: 0, max: 1, txt: '', col: '#fff', size: 8 }),
      (o) => { o.life = 0; o.txt = ''; },
      160
    );
  },

  clear() { this.parts.releaseAll(); this.nums.releaseAll(); },

  /* ---------------- spawning ---------------- */

  add(x, y, vx, vy, life, col, size, kind, grav, drag, spin) {
    // Under load, drop the least important effects instead of dropping frames.
    if (this.quality < 1 && RNG() > this.quality) return null;
    if (this.parts.count > 860) return null;
    const p = this.parts.get();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = p.max = life;
    p.col = col; p.size = size || 2; p.kind = kind || 'dot';
    p.grav = grav || 0; p.drag = drag == null ? 1.2 : drag;
    p.ang = 0; p.spin = spin || 0; p.fade = 1;
    return p;
  },

  /** Radial burst of n particles. */
  burst(x, y, n, col, speed, life, size, kind, grav) {
    n = Math.max(1, Math.round(n * this.quality));
    for (let i = 0; i < n; i++) {
      const a = RNG() * TAU, s = speed * rand(0.35, 1);
      this.add(x, y, Math.cos(a) * s, Math.sin(a) * s,
        life * rand(0.7, 1.25), col, size, kind, grav, 1.4, rand(-8, 8));
    }
  },

  /** An expanding outlined circle — used for shockwaves and boss tells. */
  ring(x, y, r0, r1, life, col, width) {
    const p = this.add(x, y, 0, 0, life, col, width || 2, 'ring', 0, 0, 0);
    if (p) { p.r0 = r0; p.r1 = r1; }
    return p;
  },

  /** Generic enemy-hit spray. */
  hitSpark(x, y, col) {
    this.burst(x, y, 4, col || '#ffe9a8', 90, 0.24, 2, 'square', 120);
  },

  /** Death effect: a puff of ash plus a few chunks. */
  death(x, y, col, big) {
    const n = big ? 16 : 7;
    this.burst(x, y, n, col || '#9aa88a', big ? 130 : 90, 0.55, big ? 3 : 2, 'square', 160);
    this.burst(x, y, big ? 10 : 4, '#5a5f4a', 60, 0.75, 2, 'dot', 40);
    if (big) this.ring(x, y, 4, 34, 0.35, 'rgba(255,255,255,.5)', 2);
  },

  /** Big explosion: fireball, smoke, and a shockwave ring. */
  boom(x, y, r, col) {
    this.ring(x, y, r * 0.25, r * 1.15, 0.34, col || '#ffd66a', 3);
    this.ring(x, y, r * 0.1, r * 0.7, 0.22, 'rgba(255,255,255,.75)', 2);
    this.burst(x, y, 18, col || '#ffb84a', r * 3.4, 0.42, 3, 'square', 220);
    this.burst(x, y, 12, '#6a6258', r * 1.6, 0.9, 4, 'dot', -20);
  },

  /** Glitter, for the escalator. Falls slowly and sparkles. */
  glitter(x, y, n) {
    n = Math.max(1, Math.round(n * this.quality));
    for (let i = 0; i < n; i++) {
      const a = RNG() * TAU, s = rand(20, 120);
      this.add(x, y, Math.cos(a) * s, Math.sin(a) * s - rand(20, 70),
        rand(0.6, 1.4), chance(0.5) ? '#f2c14e' : '#fff3cf', 2, 'square', 190, 0.8, rand(-12, 12));
    }
  },

  /** Trail dust behind fast movers. */
  dust(x, y, col) {
    this.add(x + rand(-3, 3), y + rand(-2, 2), rand(-16, 16), rand(-26, -6),
      rand(0.25, 0.5), col || 'rgba(190,180,150,.55)', 2, 'dot', -14, 1.6, 0);
  },

  /** Floating damage number. */
  num(x, y, amount, col, big) {
    if (this.nums.count > 140) return;
    const n = this.nums.get();
    n.x = x + rand(-4, 4); n.y = y - 6;
    n.vy = big ? -46 : -34;
    n.life = n.max = big ? 0.85 : 0.6;
    n.txt = amount >= 1000 ? fmtNum(amount) : String(Math.max(1, Math.round(amount)));
    n.col = col || '#fff';
    n.size = big ? 11 : 8;
  },

  /** Floating word — "LEVEL UP", "MISSION ACCOMPLISHED", boss names. */
  say(x, y, txt, col, size) {
    const n = this.nums.get();
    n.x = x; n.y = y; n.vy = -18;
    n.life = n.max = 1.4;
    n.txt = txt; n.col = col || '#f2c14e'; n.size = size || 12;
  },

  /* ---------------- simulation ---------------- */

  update(dt) {
    const A = this.parts.active;
    for (let i = A.length - 1; i >= 0; i--) {
      const p = A[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.releaseAt(i); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      if (p.drag) {
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy *= d;
      }
      p.ang += p.spin * dt;
    }

    const N = this.nums.active;
    for (let i = N.length - 1; i >= 0; i--) {
      const n = N[i];
      n.life -= dt;
      if (n.life <= 0) { this.nums.releaseAt(i); continue; }
      n.y += n.vy * dt;
      n.vy += 46 * dt;      // gentle arc
    }
  },

  /* ---------------- rendering ---------------- */

  draw(ctx, cx, cy) {
    const A = this.parts.active;
    for (let i = 0; i < A.length; i++) {
      const p = A[i];
      const t = p.life / p.max;
      const x = p.x - cx, y = p.y - cy;

      if (p.kind === 'ring') {
        const r = lerp(p.r1, p.r0, t);
        ctx.globalAlpha = t;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.fillStyle = p.col;
        const s = p.size * (p.kind === 'square' ? (0.5 + t * 0.5) : 1);
        if (p.kind === 'square') ctx.fillRect(x - s / 2, y - s / 2, s, s);
        else { ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, TAU); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;
  },

  drawNums(ctx, cx, cy) {
    const N = this.nums.active;
    if (!N.length) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < N.length; i++) {
      const n = N[i];
      const t = n.life / n.max;
      ctx.globalAlpha = Math.min(1, t * 2.2);
      ctx.font = 'bold ' + n.size + 'px "Courier New", monospace';
      const x = Math.round(n.x - cx), y = Math.round(n.y - cy);
      ctx.fillStyle = '#000';
      ctx.fillText(n.txt, x + 1, y + 1);
      ctx.fillStyle = n.col;
      ctx.fillText(n.txt, x, y);
    }
    ctx.globalAlpha = 1;
  }
};

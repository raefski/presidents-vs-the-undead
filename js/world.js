/* ============================================================
   world.js — the active stage.

   REFACTOR NOTE
     This file used to hardcode one map: fixed WORLD_W/WORLD_H, one
     GROUND_ZONES array, one BUILDINGS array, all module constants that
     the spawner, minimap and collision read directly.

     Those globals still exist and still have the same names — but they
     are now `let` bindings that World.loadStage() repoints at the
     active record in data/stages.js. Every consumer downstream is
     unchanged; only the source of the data moved. That kept the
     eleven-stage change from rippling into spawner.js, game.js and
     entities.js.

   THE SPATIAL HASH IS UNAFFECTED
     Grid hashes cell coordinates (cx * 73856093 ^ cy * 19349663) into a
     Map. It never allocates a WxH array and never bounds-checks against
     the world, so a 3800x2600 stage costs exactly what a 3000x2200 one
     does. The 48px cell stays correct because it is tuned to ENTITY
     size, not to map size. No per-stage retuning.
   ============================================================ */

/* Repointed by loadStage(). Declared with let, not const, so the rest
   of the codebase can keep reading them as plain globals. */
let WORLD_W = 3400, WORLD_H = 2300;
let START_X = 620, START_Y = 1680;
let GROUND_ZONES = [];
let BUILDINGS = [];

/**
 * The player's level is how many upgrades they've bought — the one
 * number that tracks real power, and what every boss level is
 * calibrated against. Starts at 1 so "LVL 0" never appears.
 */
function playerLevel(g) { return 1 + ((g.player && g.player.purchases) || 0); }

/**
 * How dangerous is a level-`lvl` fight for a level-`plvl` player?
 * Shared by the minimap, the boss nameplate and the warning strip so
 * they can never disagree with each other.
 */
function threatOf(plvl, lvl) {
  const d = plvl - lvl;
  if (d >= 12) return { label: 'TRIVIAL', col: '#7fd4ff', dim: 'rgba(127,212,255,.20)' };
  if (d >= 0) return { label: 'READY', col: '#5ec26a', dim: 'rgba(94,194,106,.22)' };
  if (d >= -8) return { label: 'RISKY', col: '#f2c14e', dim: 'rgba(242,193,78,.22)' };
  if (d >= -22) return { label: 'DANGEROUS', col: '#ff8a3a', dim: 'rgba(255,138,58,.22)' };
  return { label: 'DEADLY', col: '#d8324a', dim: 'rgba(216,50,74,.26)' };
}

const World = {
  stage: null,
  buildings: [],
  props: [],
  palette: PALETTES.colonial,
  cleared: 0,

  /* ------------------------------------------------------------
     Stage loading
     ------------------------------------------------------------ */

  /**
   * Make `index` the active stage. Repoints the world globals, resets
   * every strongpoint, and warms exactly the sprites this stage needs.
   */
  loadStage(index) {
    // palette changes with the stage, so the cached patterns must go
    this._pats = null; this._epats = null;
    const st = STAGES[clamp(index, 0, STAGES.length - 1)];
    this.stage = st;
    this.palette = PALETTES[st.palette] || PALETTES.colonial;

    WORLD_W = st.w; WORLD_H = st.h;
    GROUND_ZONES = st.zones;
    BUILDINGS = st.buildings;
    this.buildings = st.buildings;
    this.props = st.props || [];

    // Authored start points are a hand-placed guess; this makes them safe
    // by construction so a laid-out stage can never open with an ambush.
    const safe = this.resolveStart(st);
    START_X = safe.x; START_Y = safe.y;

    this.reset();
    Art.warmStage(st);
    return st;
  },

  /**
   * A start point clear of every garrison.
   *
   * The opening minutes have to be yours to farm in, which means being
   * outside both the 330u aggro radius and the 250u boss leash, with
   * margin. Hand-placing eleven of these by eye got nine of them wrong,
   * so the authored `start` is treated as a HINT: it's used if it
   * qualifies, and otherwise the nearest qualifying point is found by
   * spiralling outward from it.
   */
  /* 380 was only about five seconds of walking from a strongpoint, and
     the threat strip warns from 850 — so you spawned already inside the
     warning radius, which made the warning useless as an approach cue.
     620 gives a real buffer and lets the warning mean something. */
  MIN_START_CLEARANCE: 620,

  startClearance(st, x, y) {
    let worst = Infinity;
    for (const b of st.buildings) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d < worst) worst = d;
    }
    return worst;
  },

  resolveStart(st) {
    const want = this.MIN_START_CLEARANCE;
    const inBounds = (x, y) => x > 120 && x < st.w - 120 && y > 120 && y < st.h - 120;
    const okAt = (x, y) => inBounds(x, y) && !this.blockedIn(st, x, y, 30) &&
                           this.startClearance(st, x, y) >= want;

    if (okAt(st.start.x, st.start.y)) return { x: st.start.x, y: st.start.y };

    // Spiral out from the hint, keeping the author's intended area.
    for (let ring = 1; ring <= 26; ring++) {
      const r = ring * 90;
      const steps = 8 + ring * 4;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * TAU;
        const x = st.start.x + Math.cos(a) * r;
        const y = st.start.y + Math.sin(a) * r;
        if (okAt(x, y)) return { x, y };
      }
    }

    // Nothing qualifies (a very cramped stage): take the roomiest point
    // on a coarse grid rather than failing.
    let best = { x: st.start.x, y: st.start.y }, bestD = -1;
    for (let x = 160; x < st.w - 160; x += 120) {
      for (let y = 160; y < st.h - 160; y += 120) {
        if (this.blockedIn(st, x, y, 30)) continue;
        const d = this.startClearance(st, x, y);
        if (d > bestD) { bestD = d; best = { x, y }; }
      }
    }
    return best;
  },

  /** blocked(), but against an arbitrary stage rather than the active one. */
  blockedIn(st, x, y, pad) {
    pad = pad || 0;
    for (const b of st.buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
    }
    return false;
  },

  /** Clear per-run strongpoint state. Safe to call repeatedly. */
  reset() {
    this.cleared = 0;
    // Props sort by their base, like everything else, so you walk behind
    // a flagpole rather than through it.
    for (const pr of this.props) { pr.kind2 = 'prop'; pr.sortY = pr.y; }
    for (const b of this.buildings) {
      b.stageId = this.stage ? this.stage.id : 'x';
      b.kind = 'building';
      b.sortY = b.y + b.h;  // depth key: the bottom of the footprint
      b.taken = false;
      b.bossEnt = null;
      b.aggro = false;
    }
  },

  /* ------------------------------------------------------------
     Collision — unchanged logic, stage-scoped data
     ------------------------------------------------------------ */
  collide(e, r) {
    const B = this.buildings;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (e.x + r < b.x || e.x - r > b.x + b.w || e.y + r < b.y || e.y - r > b.y + b.h) continue;

      const cx = clamp(e.x, b.x, b.x + b.w);
      const cy = clamp(e.y, b.y, b.y + b.h);
      const dx = e.x - cx, dy = e.y - cy;
      const d2 = dx * dx + dy * dy;

      if (d2 > 1e-6) {
        if (d2 >= r * r) continue;
        const d = Math.sqrt(d2);
        e.x = cx + (dx / d) * r;
        e.y = cy + (dy / d) * r;
      } else {
        const left = e.x - b.x, right = b.x + b.w - e.x;
        const top = e.y - b.y, bottom = b.y + b.h - e.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) e.x = b.x - r;
        else if (m === right) e.x = b.x + b.w + r;
        else if (m === top) e.y = b.y - r;
        else e.y = b.y + b.h + r;
      }
    }
  },

  clampToWorld(e, r) {
    e.x = clamp(e.x, r, WORLD_W - r);
    e.y = clamp(e.y, r, WORLD_H - r);
  },

  blocked(x, y, pad) {
    pad = pad || 0;
    const B = this.buildings;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
    }
    return false;
  },

  /**
   * A point to spawn an enemy at: at least `rMin` away, inside the
   * stage, and not inside a building. Fans outward from the requested
   * angle rather than clamping to the bounds — clamping meant a spawn
   * aimed off-map from near an edge landed on the player.
   */
  spawnPoint(px, py, rMin, rMax, ang) {
    for (let i = 0; i < 18; i++) {
      const a = ang + (i === 0 ? 0 : (i % 2 ? 1 : -1) * 0.4 * Math.ceil(i / 2));
      const r = rMin + RNG() * (rMax - rMin);
      const x = px + Math.cos(a) * r;
      const y = py + Math.sin(a) * r;
      if (x < 26 || x > WORLD_W - 26 || y < 26 || y > WORLD_H - 26) continue;
      if (this.blocked(x, y, 14)) continue;
      return { x, y };
    }
    return null;
  },

  freeSpot(x, y, pad) {
    if (!this.blocked(x, y, pad)) return { x, y };
    for (let i = 0; i < 12; i++) {
      const a = RNG() * TAU, d = 60 + i * 34;
      const nx = clamp(x + Math.cos(a) * d, 30, WORLD_W - 30);
      const ny = clamp(y + Math.sin(a) * d, 30, WORLD_H - 30);
      if (!this.blocked(nx, ny, pad)) return { x: nx, y: ny };
    }
    return { x: clamp(x, 30, WORLD_W - 30), y: clamp(y, 30, WORLD_H - 30) };
  },

  centre(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; },
  rally(b) { return { x: b.x + b.w / 2, y: b.y + b.h + 60 }; },

  nearestActive(x, y) {
    let best = null, bd = Infinity;
    for (const b of this.buildings) {
      if (b.taken) continue;
      const c = this.centre(b);
      const d = dist2(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  },

  /* ------------------------------------------------------------
     Rendering — every colour comes from the active palette
     ------------------------------------------------------------ */
  /* CanvasPattern objects are tied to the palette, so they are cached
     per loaded stage and dropped when the stage changes. */
  _zonePat(kind) {
    const pal = this.stage ? this.stage.palette : 'colonial';
    this._pats = this._pats || {};
    const k = pal + ':' + kind;
    if (this._pats[k] === undefined) {
      const img = Art.makeZone(pal, kind);
      this._pats[k] = img ? Game.ctx.createPattern(img, 'repeat') : null;
    }
    return this._pats[k];
  },

  _zoneEdgePat(kind) {
    const pal = this.stage ? this.stage.palette : 'colonial';
    this._epats = this._epats || {};
    const k = pal + ':' + kind;
    if (this._epats[k] === undefined) {
      const img = Art.makeZoneEdge(pal, kind);
      this._epats[k] = img ? Game.ctx.createPattern(img, 'repeat') : null;
    }
    return this._epats[k];
  },

  drawGround(ctx, cx, cy, pattern) {
    const P = this.palette;

    ctx.save();
    const ox = -(((cx % 128) + 128) % 128);
    const oy = -(((cy % 128) + 128) % 128);
    ctx.translate(ox, oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, VW + 128, VH + 128);
    ctx.restore();

    for (let i = 0; i < GROUND_ZONES.length; i++) {
      const z = GROUND_ZONES[i];
      const x = z.x - cx, y = z.y - cy;
      if (x > VW || y > VH || x + z.w < 0 || y + z.h < 0) continue;

      /* Zones carry material now instead of being flat colour over the
         largest area of the screen. The tile is baked once per palette
         per kind, and a pattern fillRect costs what a solid fillRect
         costs — so this is free per frame. The scatter pass across the
         boundary is what stops the edge reading as a rendering seam
         where noise meets flat. */
      const pat = this._zonePat(z.kind);
      if (pat) {
        ctx.save();
        ctx.translate(-cx, -cy);
        ctx.fillStyle = pat;
        ctx.fillRect(z.x, z.y, z.w, z.h);
        const edge = this._zoneEdgePat(z.kind);
        if (edge) {
          ctx.fillStyle = edge;
          const m = 7;
          ctx.fillRect(z.x - m, z.y - m, z.w + m * 2, m * 2);
          ctx.fillRect(z.x - m, z.y + z.h - m, z.w + m * 2, m * 2);
          ctx.fillRect(z.x - m, z.y - m, m * 2, z.h + m * 2);
          ctx.fillRect(z.x + z.w - m, z.y - m, m * 2, z.h + m * 2);
        }
        ctx.restore();
      } else {
        ctx.fillStyle = z.kind === 'street' ? P.street : (z.kind === 'green' ? P.green : P.dirt);
        ctx.fillRect(x, y, z.w, z.h);
      }

      // Ruts stay on top of the texture: they say "road" better than
      // material does, and they are the cue for the direction of travel.
      if (z.kind === 'street') {
        ctx.fillStyle = P.rut;
        ctx.fillRect(x, y + z.h * 0.34, z.w, 5);
        ctx.fillRect(x, y + z.h * 0.62, z.w, 5);
      } else if (z.kind === 'green') {
        ctx.fillStyle = 'rgba(255,255,255,.045)';
        ctx.fillRect(x, y, z.w, 4);
      }
    }

    // Era wash over the whole view — a cheap, strong period cue.
    if (P.sky && P.sky !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = P.sky;
      ctx.fillRect(0, 0, VW, VH);
    }

    ctx.strokeStyle = P.fence;
    ctx.lineWidth = 6;
    ctx.strokeRect(-cx, -cy, WORLD_W, WORLD_H);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-cx, -cy, WORLD_W, WORLD_H);
  },

  drawBuilding(ctx, b, cx, cy) {
    const spr = Art.building(b);
    const pad = spr.padTop || 0;
    const x = Math.round(b.x - cx);
    const y = Math.round(b.y + b.h - cy - (b.h + b.elev) - pad);

    /* The sprite is anchored at b.y + b.h and covers everything above
       it, so a 12px bar starting 8px higher had two thirds of itself
       painted over and the surviving sliver read as a plinth. Start it
       at the base line and step the alpha down so the lower edge is
       soft instead of a hard bar. */
    const by = Math.round(b.y + b.h - cy);
    ctx.fillStyle = 'rgba(0,0,0,.30)';
    ctx.fillRect(x + 6, by, b.w, 5);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(x + 9, by + 5, b.w - 4, 4);
    ctx.fillStyle = 'rgba(0,0,0,.09)';
    ctx.fillRect(x + 13, by + 9, b.w - 12, 3);

    ctx.drawImage(spr, x, y);

    const fx = x + Math.round(b.w * 0.5) - 1;
    const fy = y + pad + 4;
    ctx.fillStyle = '#6a5238';
    ctx.fillRect(fx, fy - 26, 2, 30);
    if (b.taken) {
      ctx.fillStyle = '#efe4cf'; ctx.fillRect(fx + 2, fy - 26, 18, 11);
      ctx.fillStyle = '#d8324a';
      for (let i = 0; i < 3; i++) ctx.fillRect(fx + 2, fy - 24 + i * 4, 18, 2);
      ctx.fillStyle = '#3f6fd8'; ctx.fillRect(fx + 2, fy - 26, 8, 6);
    } else {
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(fx + 2, fy - 26, 18, 11);
      ctx.fillStyle = '#d8324a'; ctx.fillRect(fx + 5, fy - 23, 12, 5);
    }
  },

  /** One piece of scenery, anchored at its base. */
  drawProp(ctx, pr, cx, cy) {
    const spr = Art.prop(pr.kind);
    ctx.drawImage(spr,
      Math.round(pr.x - cx - spr.width / 2),
      Math.round(pr.y - cy - spr.height));
  },

  drawMinimap(mx, g) {
    const W = mx.canvas.width, H = mx.canvas.height;
    const s = Math.min(W / WORLD_W, H / WORLD_H);
    const ox = (W - WORLD_W * s) / 2;
    const oy = (H - WORLD_H * s) / 2;
    const X = (wx) => ox + wx * s;
    const Y = (wy) => oy + wy * s;
    const P = this.palette;

    mx.clearRect(0, 0, W, H);
    mx.fillStyle = '#0d1226';
    mx.fillRect(0, 0, W, H);

    for (let i = 0; i < GROUND_ZONES.length; i++) {
      const z = GROUND_ZONES[i];
      mx.fillStyle = z.kind === 'green' ? shade(P.green, -0.3)
        : (z.kind === 'dirt' ? shade(P.dirt, -0.35) : shade(P.street, -0.35));
      mx.fillRect(X(z.x), Y(z.y), z.w * s, z.h * s);
    }

    mx.strokeStyle = 'rgba(242,193,78,.25)';
    mx.lineWidth = 1;
    mx.strokeRect(ox + 0.5, oy + 0.5, WORLD_W * s - 1, WORLD_H * s - 1);

    mx.strokeStyle = 'rgba(255,255,255,.22)';
    mx.strokeRect(X(g.camX), Y(g.camY), VW * s, VH * s);

    const plvl = playerLevel(g);
    mx.font = 'bold 9px "Courier New", monospace';
    mx.textAlign = 'center';
    mx.textBaseline = 'middle';

    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      const bx = X(b.x), by = Y(b.y);
      const bw = Math.max(6, b.w * s), bh = Math.max(5, b.h * s);
      const t = threatOf(plvl, b.lvl);

      if (b.taken) {
        mx.fillStyle = 'rgba(90,110,140,.55)';
        mx.fillRect(bx, by, bw, bh);
        mx.strokeStyle = 'rgba(150,175,210,.8)';
        mx.lineWidth = 1;
        mx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        mx.fillStyle = '#7fd4ff';
        mx.fillText('✓', bx + bw / 2, by + bh / 2 + 1);
      } else {
        mx.fillStyle = t.dim;
        mx.fillRect(bx, by, bw, bh);
        mx.strokeStyle = t.col;
        mx.lineWidth = 1.5;
        mx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        const lx = bx + bw / 2, ly = by - 5;
        mx.fillStyle = '#000';
        mx.fillText(String(b.lvl), lx + 1, ly + 1);
        mx.fillStyle = t.col;
        mx.fillText(String(b.lvl), lx, ly);
      }
    }

    const mini = (typeof Spawner !== 'undefined') ? Spawner.mini : null;
    if (mini && !mini.dead) {
      const pulse = 3 + Math.sin(g.time * 6) * 1.2;
      mx.fillStyle = '#d8324a';
      mx.beginPath(); mx.arc(X(mini.x), Y(mini.y), pulse, 0, TAU); mx.fill();
      mx.strokeStyle = '#000'; mx.lineWidth = 1; mx.stroke();
    }

    const px = X(g.player.x), py = Y(g.player.y);
    mx.fillStyle = '#000';
    mx.beginPath(); mx.arc(px, py, 4, 0, TAU); mx.fill();
    mx.fillStyle = '#f4efe2';
    mx.beginPath(); mx.arc(px, py, 2.8, 0, TAU); mx.fill();
  },

  drawObjective(ctx, px, py, cx, cy) {
    const b = this.nearestActive(px, py);
    if (!b) return;
    const c = this.centre(b);
    const x = c.x - cx, y = c.y - cy;
    if (x > 30 && x < VW - 30 && y > 40 && y < VH - 30) return;

    const mx = clamp(x, 22, VW - 22), my = clamp(y, 46, VH - 22);
    const a = Math.atan2(y - VH / 2, x - VW / 2);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(242,193,78,.9)';
    ctx.beginPath();
    ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 7px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(b.name, mx + 1, my + 15);
    ctx.fillStyle = '#f2c14e';
    ctx.fillText(b.name, mx, my + 14);
  }
};

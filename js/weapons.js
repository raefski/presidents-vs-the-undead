/* ============================================================
   weapons.js — every attack in the game.

   Weapons never fire on input. Each one owns a timer; when the timer
   expires, fire() runs and spawns one or more "shots". A shot's `beh`
   (behavior) string tells the engine how it moves and how it decides
   what it's touching — see updateShots() and shotHits() in entities.js.

   The `style` field on a definition is documentation for the reader.
   The behavior that actually runs is the `beh` passed to spawnShot(),
   which is not always the same: the moose and the Corvette read as
   line sweeps but are implemented as long-lived piercing projectiles.

   HOW A WEAPON LEVELS
     Numeric fields on the definition are the level-1 values.
     levels[n] holds the *deltas* applied on reaching level n, plus a
     `t` string shown on the upgrade card. Everything is additive, so
     effective(level) = base + sum(levels[2..level]).

   Player stats then multiply in: might->damage, area->area/radius,
   cooldown->interval, amount->count, duration->duration.
   ============================================================ */

/* ------------------------------------------------------------
   Targeting helpers. All of these tolerate an empty battlefield.
   ------------------------------------------------------------ */

/** Closest living enemy within maxR, or null. */
function nearestEnemy(g, x, y, maxR) {
  const list = g.enemies.active;
  let best = null, bestD = (maxR || 1e9) * (maxR || 1e9);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/**
 * Find a good place to drop an area attack: sample up to 14 enemies and
 * pick whichever has the most neighbors within `r`. Cheap, and much
 * better than "nearest" for weapons that want to hit a crowd.
 */
function bestCluster(g, x, y, r, maxR) {
  const list = g.enemies.active;
  if (!list.length) return null;
  const maxR2 = (maxR || 340) * (maxR || 340);
  const r2 = r * r;

  // Gather candidates in range, capped so this stays O(1)-ish.
  const cand = [];
  const step = Math.max(1, (list.length / 40) | 0);
  for (let i = 0; i < list.length; i += step) {
    const e = list[i];
    if (e.dead) continue;
    if (dist2(x, y, e.x, e.y) > maxR2) continue;
    cand.push(e);
    if (cand.length >= 14) break;
  }
  if (!cand.length) return nearestEnemy(g, x, y, maxR);

  let best = cand[0], bestN = -1;
  for (let i = 0; i < cand.length; i++) {
    const c = cand[i];
    let n = 0;
    // Weight bosses heavily — dropping the escalator on a boss is correct.
    for (let j = 0; j < cand.length; j++) {
      if (dist2(c.x, c.y, cand[j].x, cand[j].y) < r2) n += cand[j].isBoss ? 6 : 1;
    }
    if (n > bestN) { bestN = n; best = c; }
  }
  return best;
}

/** A random living enemy, or null. */
function anyEnemy(g) {
  const list = g.enemies.active;
  if (!list.length) return null;
  return list[(RNG() * list.length) | 0];
}

/** Direction the player is "pointing": movement first, then nearest enemy. */
function aimAngle(g, p) {
  if (p.face.x !== 0 || p.face.y !== 0) return Math.atan2(p.face.y, p.face.x);
  const e = nearestEnemy(g, p.x, p.y);
  return e ? Math.atan2(e.y - p.y, e.x - p.x) : 0;
}

/** Angle toward the nearest enemy, falling back to the facing direction. */
function autoAngle(g, p, maxR) {
  const e = nearestEnemy(g, p.x, p.y, maxR);
  return e ? Math.atan2(e.y - p.y, e.x - p.x) : aimAngle(g, p);
}

/* ------------------------------------------------------------
   Effective stats for a weapon instance.
   ------------------------------------------------------------ */
const PLAYER_MULT = {
  damage: 'might', area: 'area', interval: 'cooldown',
  duration: 'duration', speed: 'projSpeed'
};

function wstats(w, p) {
  const d = w.def;
  const out = w._s || (w._s = {});
  // Reset from the base definition (numeric fields only).
  for (const k in d) if (typeof d[k] === 'number') out[k] = d[k];
  // Apply per-level deltas.
  for (let i = 2; i <= w.level; i++) {
    const up = d.levels[i];
    if (!up) continue;
    for (const k in up) {
      if (k === 't') continue;
      out[k] = (out[k] || 0) + up[k];
    }
  }
  // Fold in the player's global modifiers.
  const st = p.stats;
  for (const k in PLAYER_MULT) if (out[k] !== undefined) out[k] *= st[PLAYER_MULT[k]];
  if (out.count !== undefined) out.count = Math.max(1, out.count + st.amount);
  if (out.interval !== undefined) out.interval = Math.max(0.06, out.interval);
  return out;
}

/* ============================================================
   THE ARSENAL
   ============================================================ */
const WEAPONS = {

  /* ========== GEORGE WASHINGTON ========== */
  axe: {
    id: 'axe', name: 'Cherry Tree Axe', icon: '🪓', owner: 'washington',
    desc: 'One honest swing. The undead admit they should not exist, then agree to stop.',
    style: 'arc', maxLevel: 8,
    // Shortest range in the game, so it pays the highest damage per hit.
    interval: 1.05, damage: 60, area: 1, count: 1, pierce: 999,
    knockback: 230, duration: 0.34, reach: 42, radius: 22, sweep: 3.6,
    levels: [null, null,
      { count: 1, t: 'A second swing, equally honest.' },
      { damage: 30, radius: 5, t: '+30 damage, wider blade.' },
      { interval: -0.18, reach: 8, t: 'Swings faster, reaches further.' },
      { count: 1, damage: 26, t: '+1 swing, +26 damage.' },
      { reach: 8, radius: 6, knockback: 90, t: 'Longer reach, harder shove.' },
      { damage: 44, interval: -0.14, t: '+44 damage, faster.' },
      { count: 1, damage: 66, radius: 5, sweep: 1.4, t: 'MAX: +1 swing, +66 damage, a full 286° arc.' }
    ],
    fire(g, p, w, s) {
      const base = aimAngle(g, p);
      Sound.swing();
      for (let i = 0; i < s.count; i++) {
        // Spread the swings evenly around him so extra ranks add coverage
        // instead of overlapping each other.
        const off = i * (TAU / Math.max(2, s.count));
        g.spawnShot({
          beh: 'arc', follow: 1, ang: base + off - s.sweep / 2, angVel: s.sweep / s.duration,
          orbR: s.reach * s.area, r: s.radius * s.area, dmg: s.damage, pierce: s.pierce,
          life: s.duration, knock: s.knockback, art: Art.fx('axe'), artScale: 1.6 * s.area,
          spin: 22, color: '#e8eef8'
        });
      }
    }
  },

  volley: {
    id: 'volley', name: 'Continental Volley', icon: '🔫', owner: 'washington',
    desc: 'A rank of ghostly Continentals materializes, fires once, and politely dissolves.',
    style: 'proj', maxLevel: 8,
    interval: 1.25, damage: 34, area: 1, count: 4, pierce: 6, speed: 320,
    knockback: 60, duration: 1.4, spacing: 21,
    levels: [null, null,
      { count: 1, pierce: 2, t: '+1 musket in the rank, +2 pierce.' },
      { damage: 38, t: '+38 damage.' },
      { interval: -0.22, count: 1, t: '+1 musket, reloads faster.' },
      { count: 2, pierce: 3, t: '+2 muskets, +3 pierce.' },
      { damage: 52, speed: 60, t: '+52 damage, faster shot.' },
      { count: 2, pierce: 3, t: '+2 muskets, +3 pierce.' },
      { count: 2, damage: 88, pierce: 4, interval: -0.25, t: 'MAX: +2 muskets. A full firing line.' }
    ],
    fire(g, p, w, s) {
      // A rank, not a fan: the muskets line up shoulder to shoulder and all
      // fire the same direction, so the volley sweeps a wide lane.
      const a = autoAngle(g, p, 400);
      const px = -Math.sin(a), py = Math.cos(a);
      const vx = Math.cos(a) * s.speed, vy = Math.sin(a) * s.speed;
      Sound.shoot();
      for (let i = 0; i < s.count; i++) {
        const t = s.count === 1 ? 0 : (i / (s.count - 1) - 0.5);
        const off = t * s.spacing * s.count * s.area;
        g.spawnShot({
          beh: 'proj', x: p.x + px * off, y: p.y + py * off, vx, vy,
          r: 5 * s.area, dmg: s.damage, pierce: s.pierce, life: s.duration,
          knock: s.knockback, color: '#ffe9a8', glow: '#ffb84a', trail: 1, ang: a
        });
      }
    }
  },

  /* ========== ABRAHAM LINCOLN ========== */
  beam: {
    id: 'beam', name: 'Emancipation Beam', icon: '🎩', owner: 'lincoln',
    desc: 'He tips the hat and frees the undead from their bodies. They look relieved about it.',
    style: 'beam', maxLevel: 8,
    interval: 1.9, damage: 56, area: 1, count: 1, pierce: 999,
    knockback: 40, duration: 0.28, len: 230, width: 20,
    levels: [null, null,
      { damage: 20, t: '+20 damage.' },
      { width: 8, len: 40, t: 'Wider, longer beam.' },
      { count: 1, t: '+1 beam (fires at a second target).' },
      { interval: -0.4, damage: 15, t: 'Faster, +15 damage.' },
      { len: 70, width: 6, t: 'Much longer reach.' },
      { count: 1, damage: 25, t: '+1 beam, +25 damage.' },
      { count: 1, damage: 52, width: 16, interval: -0.35, t: 'MAX: +1 beam, +40 damage, enormous.' }
    ],
    fire(g, p, w, s) {
      Sound.beam();
      const used = [];
      for (let i = 0; i < s.count; i++) {
        // Each extra beam picks a different target so they don't stack.
        let ang;
        const e = pickUnusedEnemy(g, p, used, s.len * s.area * 1.4);
        if (e) { used.push(e); ang = Math.atan2(e.y - p.y, e.x - p.x); }
        else ang = aimAngle(g, p) + (i ? rand(-0.7, 0.7) : 0);
        g.spawnShot({
          beh: 'beam', x: p.x, y: p.y, follow: 1, ang,
          len: s.len * s.area, wid: s.width * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, color: '#ffe9a8', glow: '#ffd24a'
        });
      }
      g.shake(3);
    }
  },

  log: {
    id: 'log', name: 'Rail-Splitter Logs', icon: '🪵', owner: 'lincoln',
    desc: 'Honest Abe splits rails the old-fashioned way: by rolling them through a crowd.',
    style: 'proj', maxLevel: 8,
    interval: 2.1, damage: 48, area: 1, count: 1, pierce: 999, speed: 165,
    knockback: 300, duration: 2.6,
    levels: [null, null,
      { count: 1, t: '+1 log, rolled the other way.' },
      { damage: 26, t: '+26 damage.' },
      { interval: -0.45, t: 'Splits rails faster.' },
      { count: 1, area: 0.25, t: '+1 log, bigger logs.' },
      { damage: 36, knockback: 120, t: '+36 damage, more shove.' },
      { count: 1, duration: 0.8, t: '+1 log, rolls further.' },
      { count: 2, damage: 58, area: 0.3, t: 'MAX: +2 logs, +58 damage, enormous timber.' }
    ],
    fire(g, p, w, s) {
      const a0 = aimAngle(g, p);
      Sound.throttled('log', 120, () => Sound.noise(0.2, 0.13, 420, 160, 0.7));
      for (let i = 0; i < s.count; i++) {
        const ang = a0 + (i % 2 ? Math.PI : 0) + (((i / 2) | 0) * 0.5) * (i % 2 ? -1 : 1);
        g.spawnShot({
          beh: 'proj', x: p.x, y: p.y, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          r: 13 * s.area, dmg: s.damage, pierce: 999, life: s.duration, knock: s.knockback,
          art: Art.fx('log'), artScale: 1.5 * s.area, spin: 6, hitCd: 0.5, ang
        });
      }
    }
  },

  /* ========== THEODORE ROOSEVELT ========== */
  stick: {
    id: 'stick', name: 'The Big Stick', icon: '🏏', owner: 'teddy',
    desc: 'No rockets. No extras. Just the stick, and the historical mulch it produces.',
    style: 'arc', maxLevel: 8,
    interval: 0.85, damage: 48, area: 1, count: 1, pierce: 999,
    knockback: 480, duration: 0.26, reach: 38, radius: 26, sweep: 3.2,
    levels: [null, null,
      { damage: 26, t: '+26 damage. Speak softly.' },
      { count: 1, t: '+1 swing.' },
      { interval: -0.16, knockback: 120, t: 'Faster, harder.' },
      { radius: 7, reach: 10, t: 'Bigger stick.' },
      { count: 1, damage: 32, t: '+1 swing, +32 damage.' },
      { interval: -0.14, damage: 38, t: 'Faster, +38 damage.' },
      { count: 1, damage: 62, radius: 6, knockback: 240, sweep: 1.4, t: 'MAX: +1 swing, +62 damage, sends them to orbit.' }
    ],
    fire(g, p, w, s) {
      const base = aimAngle(g, p);
      Sound.swing();
      for (let i = 0; i < s.count; i++) {
        const off = i * (TAU / Math.max(2, s.count));
        g.spawnShot({
          beh: 'arc', follow: 1, ang: base + off - s.sweep / 2, angVel: s.sweep / s.duration,
          orbR: s.reach * s.area, r: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, color: '#c9a878', bar: 1, barLen: 26 * s.area
        });
      }
    }
  },

  moose: {
    id: 'moose', name: 'Bull Moose Charge', icon: '🫎', owner: 'teddy',
    desc: 'A third-party candidate with antlers arrives and refuses to concede.',
    style: 'sweep', maxLevel: 8,
    interval: 5.0, damage: 90, area: 1, count: 1, pierce: 999, speed: 340,
    knockback: 520, duration: 2.6,
    levels: [null, null,
      { damage: 30, t: '+30 damage.' },
      { damage: 45, t: '+45 damage.' },
      { interval: -0.9, t: 'The herd arrives sooner.' },
      { count: 1, area: 0.2, t: '+1 moose, larger moose.' },
      { damage: 60, speed: 60, t: '+60 damage, faster charge.' },
      { count: 1, interval: -0.8, t: '+1 moose, faster.' },
      { count: 1, damage: 155, area: 0.25, t: 'MAX: +1 moose, +155 damage. It will not concede.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('moose', 200, () => { Sound.tone(150, 0.5, 'sawtooth', 0.16, 90); Sound.noise(0.4, 0.13, 300, 120); });
      for (let i = 0; i < s.count; i++) sweepAcross(g, p, s, Art.vehicle('moose'), 1.5, '#4a3626', i);
    }
  },

  /* ========== FRANKLIN D. ROOSEVELT ========== */
  chair: {
    id: 'chair', name: 'Wheelchair of Destiny', icon: '♿', owner: 'fdr',
    desc: 'Unstoppable momentum, spiked wheels, and a man who is completely unbothered.',
    style: 'proj', maxLevel: 8,
    interval: 1.5, damage: 58, area: 1, count: 2, pierce: 999, speed: 330,
    knockback: 360, duration: 0.85,
    levels: [null, null,
      { count: 1, t: '+1 chair, launched backward.' },
      { damage: 32, t: '+32 damage.' },
      { interval: -0.3, t: 'Rolls out faster.' },
      { count: 1, area: 0.2, t: '+1 chair, wider wheels.' },
      { damage: 42, duration: 0.25, t: '+42 damage, rolls further.' },
      { count: 1, knockback: 160, t: '+1 chair, more launch.' },
      { count: 2, damage: 70, area: 0.3, interval: -0.25, t: 'MAX: +2 chairs. Nothing in the New Deal covers this.' }
    ],
    fire(g, p, w, s) {
      const a0 = aimAngle(g, p);
      Sound.throttled('chair', 120, () => Sound.noise(0.22, 0.12, 900, 300, 1.2));
      for (let i = 0; i < s.count; i++) {
        const ang = a0 + (i === 0 ? 0 : (i % 2 ? Math.PI : Math.PI / 2) + ((i / 2) | 0) * 0.6);
        g.spawnShot({
          beh: 'proj', x: p.x, y: p.y, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          r: 14 * s.area, dmg: s.damage, pierce: 999, life: s.duration, knock: s.knockback,
          art: Art.vehicle('chair'), artScale: 1.15 * s.area, spin: 9, hitCd: 0.35, ang, drag: 0.4
        });
      }
    }
  },

  fireside: {
    id: 'fireside', name: 'Fireside Chat', icon: '📻', owner: 'fdr',
    desc: 'A warm, reassuring broadcast. Reassuring enough to liquefy nearby organs.',
    style: 'aura', maxLevel: 8,
    interval: 5.2, damage: 16, area: 1, count: 1, radius: 62,
    knockback: 30, duration: 3.2, hitCd: 0.5,
    levels: [null, null,
      { radius: 14, t: 'Broadcast reaches further.' },
      { damage: 8, t: '+8 damage per tick.' },
      { duration: 1.2, t: 'Longer broadcast.' },
      { radius: 16, hitCd: -0.1, t: 'Bigger, ticks faster.' },
      { damage: 12, interval: -0.8, t: '+12 damage, more often.' },
      { radius: 18, duration: 1.0, t: 'Much bigger and longer.' },
      { damage: 20, radius: 24, hitCd: -0.12, interval: -1.0, t: 'MAX: nationwide address.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('fire', 300, () => Sound.tone(300, 0.4, 'sine', 0.1, 200));
      g.spawnShot({
        beh: 'aura', follow: 1, r: s.radius * s.area, dmg: s.damage, pierce: 999,
        life: s.duration, knock: s.knockback, hitCd: Math.max(0.15, s.hitCd),
        color: '#ffb84a', ring: 1, pulse: 1
      });
    }
  },

  /* ========== JOHN F. KENNEDY ========== */
  pt109: {
    id: 'pt109', name: 'PT-109 Ram', icon: '🚤', owner: 'jfk',
    desc: 'The limo becomes a patrol boat. Nobody questions it. There is no time.',
    style: 'proj', maxLevel: 8,
    interval: 2.3, damage: 62, area: 1, count: 1, pierce: 999, speed: 290,
    knockback: 340, duration: 1.3,
    levels: [null, null,
      { damage: 30, t: '+30 damage.' },
      { count: 1, t: '+1 boat.' },
      { interval: -0.45, t: 'Faster launch.' },
      { damage: 34, area: 0.2, t: '+34 damage, bigger boat.' },
      { count: 1, duration: 0.3, t: '+1 boat, longer run.' },
      { damage: 40, interval: -0.35, t: '+40 damage, faster.' },
      { damage: 95, area: 0.25, t: 'MAX: +95 damage. Barely seaworthy, wholly lethal.' }
    ],
    fire(g, p, w, s) {
      const tgt = bestCluster(g, p.x, p.y, 60, 380);
      const a0 = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : aimAngle(g, p);
      Sound.throttled('boat', 150, () => { Sound.tone(120, 0.35, 'sawtooth', 0.15, 200); Sound.noise(0.3, 0.1, 500, 200); });
      for (let i = 0; i < s.count; i++) {
        const ang = a0 + (i === 0 ? 0 : rand(-0.8, 0.8) + (i % 2 ? Math.PI : 0));
        g.spawnShot({
          beh: 'proj', x: p.x, y: p.y, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          r: 17 * s.area, dmg: s.damage, pierce: 999, life: s.duration, knock: s.knockback,
          art: Art.vehicle('boat'), artScale: 1.05 * s.area, faceVel: 1, hitCd: 0.4, ang, wake: 1
        });
      }
    }
  },

  moonshot: {
    id: 'moonshot', name: 'The Moonshot', icon: '🚀', owner: 'jfk',
    desc: 'We choose to do this not because it is easy, but because it removes the horde.',
    style: 'drop', maxLevel: 8,
    interval: 3.4, damage: 130, area: 1, count: 1, radius: 62, delay: 0.95,
    knockback: 300, duration: 0.4,
    levels: [null, null,
      { count: 1, t: '+1 rocket.' },
      { damage: 60, t: '+60 damage.' },
      { radius: 16, t: 'Larger blast.' },
      { interval: -0.6, count: 1, t: '+1 rocket, fired sooner.' },
      { damage: 80, radius: 12, t: '+80 damage, larger blast.' },
      { count: 1, delay: -0.3, t: '+1 rocket, faster descent.' },
      { count: 2, damage: 130, radius: 22, t: 'MAX: +2 rockets. Full Apollo program.' }
    ],
    fire(g, p, w, s) {
      for (let i = 0; i < s.count; i++) {
        const t = bestCluster(g, p.x, p.y, s.radius * s.area, 330) || { x: p.x + rand(-100, 100), y: p.y + rand(-100, 100) };
        g.spawnShot({
          beh: 'drop', x: t.x + rand(-24, 24), y: t.y + rand(-24, 24),
          r: s.radius * s.area, dmg: s.damage, pierce: 999, life: s.duration,
          knock: s.knockback, delay: s.delay, art: Art.fx('moon'), artScale: 1.5 * s.area,
          fallH: 220, boom: '#ffd66a', color: '#e8e8f0'
        });
      }
    }
  },

  /* ========== RICHARD NIXON ========== */
  tape: {
    id: 'tape', name: 'Secret Tape Trap', icon: '📼', owner: 'nixon',
    desc: 'Recording devices erupt from the ground, wrap the undead tight, and file them away.',
    style: 'trap', maxLevel: 8,
    interval: 2.6, damage: 22, area: 1, count: 2, radius: 30,
    knockback: 0, duration: 5.0, hitCd: 0.4, slow: 0.12,
    levels: [null, null,
      { count: 1, t: '+1 reel.' },
      { damage: 14, t: '+14 damage per tick.' },
      { radius: 8, duration: 1.2, t: 'Bigger, lasts longer.' },
      { count: 1, hitCd: -0.08, t: '+1 reel, reels faster.' },
      { damage: 18, radius: 6, t: '+18 damage, bigger.' },
      { count: 2, interval: -0.5, t: '+2 reels, deployed sooner.' },
      { count: 1, damage: 24, radius: 10, duration: 2.0, t: 'MAX: the entire White House taping system.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('tape', 200, () => { Sound.tone(220, 0.16, 'square', 0.09, 420); Sound.noise(0.14, 0.08, 1600, 600); });
      for (let i = 0; i < s.count; i++) {
        const e = anyEnemy(g);
        const ax = e ? e.x + rand(-30, 30) : p.x + rand(-110, 110);
        const ay = e ? e.y + rand(-30, 30) : p.y + rand(-110, 110);
        g.spawnShot({
          beh: 'trap', x: ax, y: ay, r: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: 0, hitCd: Math.max(0.12, s.hitCd), slow: s.slow,
          art: Art.fx('reel'), artScale: 1.2 * s.area, spin: 4, color: '#6a5a3a'
        });
      }
    }
  },

  gap: {
    id: 'gap', name: 'The 18½-Minute Gap', icon: '🕳️', owner: 'nixon',
    desc: 'A hole in the record. Anything inside it is simply no longer part of the record.',
    style: 'zone', maxLevel: 8,
    interval: 4.4, damage: 46, area: 1, count: 1, radius: 44,
    knockback: -140, duration: 3.0, hitCd: 0.32,
    levels: [null, null,
      { radius: 12, t: 'A larger gap.' },
      { damage: 26, t: '+26 damage per tick.' },
      { duration: 1.0, t: 'The gap persists.' },
      { count: 1, t: '+1 gap.' },
      { damage: 34, hitCd: -0.08, t: '+34 damage, erases faster.' },
      { radius: 16, interval: -0.8, t: 'Bigger, more frequent.' },
      { count: 1, damage: 50, radius: 18, t: 'MAX: +1 gap. Nothing was ever said.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('gap', 250, () => Sound.tone(90, 0.5, 'sine', 0.14, 40));
      for (let i = 0; i < s.count; i++) {
        const t = bestCluster(g, p.x, p.y, s.radius * s.area, 300) || { x: p.x + rand(-90, 90), y: p.y + rand(-90, 90) };
        g.spawnShot({
          beh: 'zone', x: t.x, y: t.y, r: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, hitCd: Math.max(0.12, s.hitCd),
          color: '#1a0f22', void: 1
        });
      }
    }
  },

  /* ========== RONALD REAGAN ========== */
  beans: {
    id: 'beans', name: 'Jelly-Bean Barrage', icon: '🍬', owner: 'reagan',
    desc: 'An endless supply, from pockets that should not hold this many. They explode.',
    style: 'proj', maxLevel: 8,
    interval: 0.9, damage: 19, area: 1, count: 5, pierce: 0, speed: 250,
    knockback: 70, duration: 0.85, spread: 0.95, splash: 20, splashDmg: 9,
    levels: [null, null,
      { count: 2, t: '+2 beans.' },
      { damage: 8, splashDmg: 5, t: '+8 damage, bigger pop.' },
      { count: 2, spread: 0.2, t: '+2 beans.' },
      { interval: -0.2, t: 'Reaches into pocket faster.' },
      { count: 3, damage: 7, t: '+3 beans, +7 damage.' },
      { splash: 10, splashDmg: 9, pierce: 1, t: 'Bigger splash, +1 pierce.' },
      { count: 4, damage: 20, interval: -0.18, t: 'MAX: +4 beans. The pocket is a portal.' }
    ],
    fire(g, p, w, s) {
      const a = autoAngle(g, p, 360);
      Sound.shoot();
      for (let i = 0; i < s.count; i++) {
        const ang = a + rand(-s.spread, s.spread) * 0.5;
        const sp = s.speed * rand(0.85, 1.15);
        // One pre-tinted sprite per flavor — recoloring at draw time would
        // composite against the background, not the sprite.
        const col = BEAN_COLORS[(RNG() * BEAN_COLORS.length) | 0];
        g.spawnShot({
          beh: 'proj', x: p.x, y: p.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          r: 5 * s.area, dmg: s.damage, pierce: s.pierce, life: s.duration * rand(0.85, 1.15),
          knock: s.knockback, art: Art.fx('bean', col), artScale: 1.1 * s.area, spin: rand(-10, 10),
          glow: col, splash: s.splash * s.area, splashDmg: s.splashDmg, ang
        });
      }
    }
  },

  sdi: {
    id: 'sdi', name: 'Strategic Defense Initiative', icon: '🛰️', owner: 'reagan',
    desc: 'Orbital platforms nobody funded, doing a job nobody authorized. Flawlessly.',
    style: 'orbit', maxLevel: 8,
    interval: 8.0, damage: 62, area: 1, count: 3, radius: 62,
    knockback: 90, duration: 7.6, hitCd: 0.4, spinRate: 2.3,
    levels: [null, null,
      { count: 1, t: '+1 satellite.' },
      { damage: 32, t: '+32 damage.' },
      { radius: 16, spinRate: 0.5, t: 'Wider, faster orbit.' },
      { count: 1, duration: 1.4, hitCd: -0.06, t: '+1 satellite, longer uptime, faster fire.' },
      { damage: 44, hitCd: -0.06, t: '+44 damage, fires faster.' },
      { count: 1, radius: 14, t: '+1 satellite, wider orbit.' },
      { count: 2, damage: 78, duration: 3.0, t: 'MAX: +2 satellites. Permanent coverage.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('sdi', 300, () => { Sound.tone(880, 0.14, 'sine', 0.08, 1400); Sound.tone(1320, 0.1, 'sine', 0.05, 1900, 0.05); });
      const n = Math.max(1, Math.round(s.count));
      for (let i = 0; i < n; i++) {
        g.spawnShot({
          beh: 'orbit', follow: 1, ang: (i / n) * TAU, angVel: s.spinRate,
          orbR: s.radius * s.area, r: 13 * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, hitCd: Math.max(0.15, s.hitCd),
          art: Art.fx('sat'), artScale: 1.1 * s.area, zap: 1, color: '#7fd4ff'
        });
      }
    }
  },

  /* ========== BILL CLINTON ========== */
  sax: {
    id: 'sax', name: 'Saxophone Shockwave', icon: '🎷', owner: 'clinton',
    desc: 'Pure notes. No lyrics. The undead come apart at the seams anyway.',
    style: 'wave', maxLevel: 8,
    interval: 1.9, damage: 40, area: 1, count: 1, radius: 74,
    knockback: 340, duration: 0.62,
    levels: [null, null,
      { damage: 20, t: '+20 damage.' },
      { radius: 30, t: 'The note carries further.' },
      { count: 1, t: '+1 wave (a second chorus).' },
      { interval: -0.35, damage: 16, t: 'Faster, +16 damage.' },
      { radius: 38, knockback: 120, t: 'Bigger wave, more force.' },
      { count: 1, damage: 26, t: '+1 wave, +26 damage.' },
      { count: 1, damage: 44, radius: 52, interval: -0.3, t: 'MAX: an entire set.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('sax', 140, () => {
        Sound.tone(392, 0.26, 'sawtooth', 0.13, 587);
        Sound.tone(587, 0.22, 'square', 0.07, 784, 0.07);
      });
      for (let i = 0; i < s.count; i++) {
        g.spawnShot({
          beh: 'wave', x: p.x, y: p.y, follow: i === 0 ? 1 : 0,
          r: 12, rMax: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, delay: i * 0.18,
          color: '#ffd35e', ring: 1
        });
      }
      g.shake(2);
    }
  },

  bigmac: {
    id: 'bigmac', name: 'Big Mac Attack', icon: '🍔', owner: 'clinton',
    desc: 'Lobbed from a jog. Leaves a grease slick that the undead find genuinely upsetting.',
    style: 'drop', maxLevel: 8,
    interval: 3.0, damage: 52, area: 1, count: 1, radius: 42, delay: 0.55,
    knockback: 90, duration: 0.3, puddle: 3.2, puddleDmg: 13, slow: 0.5,
    levels: [null, null,
      { count: 1, t: '+1 burger.' },
      { damage: 26, puddleDmg: 6, t: '+26 damage, greasier.' },
      { radius: 12, puddle: 1.0, t: 'Wider splat, longer slick.' },
      { count: 1, interval: -0.4, t: '+1 burger, thrown sooner.' },
      { damage: 32, puddleDmg: 9, t: '+32 damage, much greasier.' },
      { count: 1, radius: 10, t: '+1 burger, wider splat.' },
      { count: 2, damage: 44, puddle: 1.6, t: 'MAX: +2 burgers. Supersized.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('mac', 200, () => Sound.noise(0.18, 0.12, 700, 220, 0.8));
      for (let i = 0; i < s.count; i++) {
        const t = bestCluster(g, p.x, p.y, s.radius * s.area, 280) || { x: p.x + rand(-80, 80), y: p.y + rand(-80, 80) };
        g.spawnShot({
          beh: 'drop', x: t.x + rand(-18, 18), y: t.y + rand(-18, 18),
          r: s.radius * s.area, dmg: s.damage, pierce: 999, life: s.duration,
          knock: s.knockback, delay: s.delay, art: Art.fx('burger'), artScale: 1.4 * s.area,
          fallH: 120, boom: '#f2c14e',
          // The splat leaves a lingering slow-field behind.
          leave: { beh: 'zone', r: s.radius * s.area * 0.9, dmg: s.puddleDmg, life: s.puddle, hitCd: 0.45, slow: s.slow, color: '#8a6a2a', grease: 1 },
          dropFood: 1
        });
      }
    }
  },

  /* ========== GEORGE W. BUSH ========== */
  banner: {
    id: 'banner', name: 'Mission Accomplished', icon: '🪧', owner: 'bush43',
    desc: 'Declares victory ahead of schedule. The banner falls like a weighted tarp anyway.',
    style: 'drop', maxLevel: 8,
    interval: 3.6, damage: 70, area: 1, count: 1, radius: 58, delay: 0.7,
    knockback: 60, duration: 0.3, pin: 3.6, pinDmg: 15,
    levels: [null, null,
      { radius: 14, t: 'A larger banner.' },
      { damage: 34, pinDmg: 7, t: '+34 damage, heavier fabric.' },
      { pin: 1.2, t: 'Pins for longer.' },
      { count: 1, t: '+1 banner.' },
      { damage: 42, radius: 12, t: '+42 damage, larger.' },
      { count: 1, interval: -0.7, t: '+1 banner, sooner.' },
      { count: 1, damage: 66, radius: 20, pin: 1.6, t: 'MAX: the banner is now most of the sky.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('ban', 220, () => Sound.noise(0.3, 0.14, 380, 140, 0.6));
      for (let i = 0; i < s.count; i++) {
        const t = bestCluster(g, p.x, p.y, s.radius * s.area, 320) || { x: p.x + rand(-90, 90), y: p.y + rand(-90, 90) };
        g.spawnShot({
          beh: 'drop', x: t.x, y: t.y, r: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, delay: s.delay,
          art: Art.banner(), artScale: 1.15 * s.area, fallH: 190, boom: '#efe4cf', flat: 1,
          leave: { beh: 'zone', r: s.radius * s.area, dmg: s.pinDmg, life: s.pin, hitCd: 0.5, slow: 0.08, color: '#efe4cf', cloth: 1 }
        });
      }
      g.shake(4);
    }
  },

  shoe: {
    id: 'shoe', name: 'Incoming Shoe', icon: '👞', owner: 'bush43',
    desc: 'He ducks it, catches it, and throws it back. It keeps coming back. It is his now.',
    style: 'boomerang', maxLevel: 8,
    interval: 2.0, damage: 38, area: 1, count: 1, pierce: 999, speed: 330,
    knockback: 130, duration: 1.5,
    levels: [null, null,
      { count: 1, t: '+1 shoe (a matching pair).' },
      { damage: 20, t: '+20 damage.' },
      { speed: 70, duration: 0.3, t: 'Faster, travels further.' },
      { count: 1, interval: -0.35, t: '+1 shoe, thrown sooner.' },
      { damage: 26, area: 0.2, t: '+26 damage, bigger shoe.' },
      { count: 1, duration: 0.35, t: '+1 shoe, longer flight.' },
      { count: 2, damage: 42, speed: 60, t: 'MAX: +2 shoes. A whole press conference.' }
    ],
    fire(g, p, w, s) {
      const a0 = autoAngle(g, p, 420);
      Sound.throttled('shoe', 130, () => Sound.noise(0.12, 0.1, 2400, 800, 1.4));
      for (let i = 0; i < s.count; i++) {
        const ang = a0 + (i * TAU / Math.max(1, s.count)) * (s.count > 1 ? 1 : 0);
        g.spawnShot({
          beh: 'boomerang', x: p.x, y: p.y, ang, sp: s.speed,
          r: 11 * s.area, dmg: s.damage, pierce: 999, life: s.duration, knock: s.knockback,
          art: Art.fx('shoe'), artScale: 1.3 * s.area, spin: 14, hitCd: 0.45
        });
      }
    }
  },

  /* ========== BARACK OBAMA ========== */
  hope: {
    id: 'hope', name: 'The Hope Surge', icon: '🌊', owner: 'obama',
    desc: 'The undead reorganize into neat, orderly lines, and then into neat, orderly dust.',
    style: 'wave', maxLevel: 8,
    interval: 2.6, damage: 58, area: 1, count: 1, radius: 155,
    knockback: 120, duration: 0.85, slow: 0.55, slowTime: 1.4,
    levels: [null, null,
      { radius: 30, t: 'The wave reaches further.' },
      { damage: 30, t: '+30 damage.' },
      { count: 1, t: '+1 wave.' },
      { interval: -0.5, slowTime: 0.6, t: 'More frequent, longer order.' },
      { damage: 40, radius: 26, t: '+40 damage, wider.' },
      { count: 1, damage: 30, t: '+1 wave, +30 damage.' },
      { count: 1, damage: 70, radius: 44, interval: -0.4, t: 'MAX: hope on a continental scale.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('hope', 160, () => {
        Sound.tone(523, 0.34, 'sine', 0.11, 1046);
        Sound.tone(784, 0.28, 'triangle', 0.07, 1568, 0.08);
      });
      for (let i = 0; i < s.count; i++) {
        g.spawnShot({
          beh: 'wave', x: p.x, y: p.y, follow: i === 0 ? 1 : 0,
          r: 14, rMax: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, delay: i * 0.22,
          slow: s.slow, slowTime: s.slowTime, color: '#7fd4ff', ring: 1, orderly: 1
        });
      }
    }
  },

  micdrop: {
    id: 'micdrop', name: 'Mic Drop', icon: '🎤', owner: 'obama',
    desc: 'Ends the correspondence. Permanently, and for everyone standing nearby.',
    style: 'drop', maxLevel: 8,
    interval: 3.2, damage: 115, area: 1, count: 1, radius: 66, delay: 0.45,
    knockback: 480, duration: 0.3,
    levels: [null, null,
      { damage: 55, t: '+55 damage.' },
      { radius: 16, t: 'Wider shockwave.' },
      { count: 1, t: '+1 mic.' },
      { interval: -0.55, knockback: 140, t: 'Faster, harder drop.' },
      { damage: 70, radius: 12, t: '+70 damage, wider.' },
      { count: 1, delay: -0.15, t: '+1 mic, drops faster.' },
      { count: 1, damage: 110, radius: 24, t: 'MAX: +1 mic. Out.' }
    ],
    fire(g, p, w, s) {
      for (let i = 0; i < s.count; i++) {
        const t = bestCluster(g, p.x, p.y, s.radius * s.area, 300) || { x: p.x + rand(-70, 70), y: p.y + rand(-70, 70) };
        g.spawnShot({
          beh: 'drop', x: t.x, y: t.y, r: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, delay: s.delay,
          art: Art.fx('mic'), artScale: 1.5 * s.area, fallH: 150, boom: '#c8ccd6', shakeAmt: 6
        });
      }
    }
  },

  /* ========== DONALD TRUMP ========== */
  /* Trump's FUSION — the original signature attack, now the payoff for
     maxing both the golf club and the terminations. */
  escalator: {
    id: 'escalator', name: 'THE GOLDEN ESCALATOR', icon: '🏆', owner: 'trump',
    desc: 'Enormous. Gold-plated. Descends onto the horde trailing fire and golf balls, scattering glitter and absolute confidence.',
    style: 'drop', maxLevel: 5,
    interval: 3.0, damage: 919, area: 1, count: 2, radius: 96, delay: 0.8,
    knockback: 320, duration: 0.4, glitter: 3.2, glitterDmg: 160, balls: 8,
    levels: [null, null,
      { damage: 424, radius: 14, t: '+240 damage, wider descent.' },
      { count: 1, balls: 4, t: '+1 escalator, +4 ricocheting golf balls.' },
      { interval: -0.5, glitterDmg: 97, t: 'Faster, and the glitter burns.' },
      { count: 1, damage: 671, radius: 22, balls: 6, t: 'MAX: solid gold, all the way down, forever.' }
    ],
    fire(g, p, w, s) {
      for (let i = 0; i < s.count; i++) {
        const t = bestCluster(g, p.x, p.y, s.radius * s.area, 380) || { x: p.x + rand(-110, 110), y: p.y + rand(-110, 110) };
        g.spawnShot({
          beh: 'drop', x: t.x, y: t.y, r: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, delay: s.delay,
          art: Art.escalator(), artScale: 1.7 * s.area, fallH: 300, boom: '#f2c14e', shakeAmt: 11,
          leave: { beh: 'zone', r: s.radius * s.area * 0.9, dmg: s.glitterDmg, life: s.glitter, hitCd: 0.35, color: '#f2c14e', glitter: 1 }
        });
      }
      // Every descent sprays golf balls and burning slips outward.
      const n = Math.round(s.balls);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(-0.2, 0.2);
        g.spawnShot({
          beh: 'ricochet', x: p.x, y: p.y, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
          r: 9 * s.area, dmg: s.damage * 0.22, pierce: 0, life: 2.4, knock: 160,
          art: Art.fx('golf'), artScale: 1.5 * s.area, spin: 20, bounces: 5, trail: 1
        });
        if (i % 2 === 0) {
          g.spawnShot({
            beh: 'proj', x: p.x, y: p.y, vx: Math.cos(a + 0.3) * 300, vy: Math.sin(a + 0.3) * 300,
            r: 9 * s.area, dmg: s.damage * 0.3, pierce: 1, life: 1.6, knock: 140,
            art: Art.fx('fireball'), artScale: 1.4 * s.area, glow: '#ff6a2a', trail: 1,
            splash: 36 * s.area, splashDmg: s.damage * 0.2, ang: a
          });
        }
      }
      Sound.throttled('esc', 200, () => { Sound.tone(160, 0.5, 'sawtooth', 0.18, 60); Sound.noise(0.4, 0.16, 700, 200); });
    }
  },

  golf: {
    id: 'golf', name: 'Executive Tee Time', icon: '⛳', owner: 'trump',
    desc: 'A perfect drive. Ricochets off skulls. Every single one is a hole in one, apparently.',
    style: 'ricochet', maxLevel: 8,
    interval: 1.2, damage: 62, area: 1, count: 2, speed: 420, bounces: 5,
    knockback: 150, duration: 2.4,
    levels: [null, null,
      { count: 1, t: '+1 ball.' },
      { damage: 34, t: '+34 damage.' },
      { bounces: 3, t: '+3 ricochets.' },
      { count: 1, interval: -0.25, t: '+1 ball, faster swing.' },
      { damage: 46, bounces: 3, t: '+46 damage, +3 ricochets.' },
      { count: 2, speed: 80, t: '+2 balls, faster drive.' },
      { count: 2, damage: 70, bounces: 6, t: 'MAX: +2 balls, +6 ricochets. Under par.' }
    ],
    fire(g, p, w, s) {
      const a0 = autoAngle(g, p, 460);
      Sound.throttled('golf', 90, () => { Sound.tone(1400, 0.05, 'square', 0.09, 500); Sound.noise(0.05, 0.07, 3000, 1200); });
      for (let i = 0; i < s.count; i++) {
        const ang = a0 + rand(-0.35, 0.35);
        g.spawnShot({
          beh: 'ricochet', x: p.x, y: p.y, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          r: 7 * s.area, dmg: s.damage, pierce: 0, life: s.duration, knock: s.knockback,
          art: Art.fx('golf'), artScale: 1.3 * s.area, spin: 20, bounces: Math.round(s.bounces), trail: 1
        });
      }
    }
  },

  fired: {
    id: 'fired', name: "You're Fired", icon: '🔥', owner: 'trump',
    desc: 'He points at one specific corpse and terminates it. A flaming pink slip does the rest.',
    style: 'proj', maxLevel: 8,
    interval: 1.15, damage: 78, area: 1, count: 2, pierce: 1, speed: 320,
    knockback: 130, duration: 1.6, splash: 34, splashDmg: 46, burn: 2.2, burnDmg: 20,
    levels: [null, null,
      { count: 1, t: '+1 termination.' },
      { damage: 34, splashDmg: 20, t: '+34 damage, bigger blast.' },
      { interval: -0.2, t: 'Fires people faster.' },
      { count: 1, splash: 10, t: '+1 termination, wider blast.' },
      { damage: 46, burnDmg: 12, t: '+46 damage, hotter fire.' },
      { count: 1, burn: 1.0, t: '+1 termination, fire lingers.' },
      { count: 1, damage: 70, splash: 14, splashDmg: 40, t: 'MAX: nobody in the building is safe.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('fired', 90, () => {
        Sound.tone(320, 0.16, 'sawtooth', 0.12, 90);
        Sound.noise(0.22, 0.13, 1500, 400, 0.8);
      });
      const used = [];
      for (let i = 0; i < s.count; i++) {
        // Each slip is addressed to a different individual.
        const e = pickUnusedEnemy(g, p, used, 420);
        let ang;
        if (e) { used.push(e); ang = Math.atan2(e.y - p.y, e.x - p.x); }
        else ang = aimAngle(g, p) + rand(-0.5, 0.5);
        g.spawnShot({
          beh: 'proj', x: p.x, y: p.y,
          vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          r: 8 * s.area, dmg: s.damage, pierce: s.pierce, life: s.duration,
          knock: s.knockback, art: Art.fx('pinkslip'), artScale: 1.3 * s.area,
          spin: 9, splash: s.splash * s.area, splashDmg: s.splashDmg,
          glow: '#ff6a2a', trail: 1, ang,
          // The blast leaves burning ground behind it.
          leave: { beh: 'zone', r: s.splash * s.area * 0.9, dmg: s.burnDmg, life: s.burn, hitCd: 0.35, color: '#ff6a2a', fire: 1 }
        });
      }
    }
  },

  /* ========== JOE BIDEN ========== */
  corvette: {
    id: 'corvette', name: 'Corvette Crush', icon: '🚗', owner: 'biden',
    desc: 'The \'67 enlarges, revs with pure dad energy, and mows a lane straight through.',
    style: 'sweep', maxLevel: 8,
    interval: 4.2, damage: 74, area: 1, count: 1, pierce: 999, speed: 430,
    knockback: 480, duration: 2.2,
    levels: [null, null,
      { damage: 38, t: '+38 damage.' },
      { interval: -0.5, t: 'Comes around sooner.' },
      { interval: -0.8, t: 'Comes around sooner.' },
      { damage: 46, area: 0.2, t: '+46 damage, bigger car.' },
      { count: 1, speed: 70, t: '+1 Corvette, faster.' },
      { damage: 56, interval: -0.7, t: '+56 damage, sooner.' },
      { count: 1, damage: 128, area: 0.2, t: 'MAX: +1 Corvette, +128 damage. Dad is furious.' }
    ],
    fire(g, p, w, s) {
      Sound.throttled('vette', 200, () => {
        Sound.tone(90, 0.5, 'sawtooth', 0.18, 190);
        Sound.tone(180, 0.4, 'square', 0.09, 300);
        Sound.noise(0.4, 0.1, 400, 180);
      });
      for (let i = 0; i < s.count; i++) sweepAcross(g, p, s, Art.vehicle('corvette'), 1.25, '#0f5aa8', i);
    }
  },

  aviators: {
    id: 'aviators', name: 'Aviator Glare', icon: '🕶️', owner: 'biden',
    desc: 'He lowers the sunglasses. A cone of pure "no malarkey" removes everything in it.',
    style: 'cone', maxLevel: 8,
    interval: 1.7, damage: 27, area: 1, count: 1, len: 150, half: 0.5,
    knockback: 100, duration: 0.5, hitCd: 0.22, slow: 0.55, slowTime: 1.0,
    levels: [null, null,
      { damage: 14, t: '+14 damage per tick.' },
      { len: 34, t: 'The glare reaches further.' },
      { half: 0.18, t: 'A wider cone.' },
      { count: 1, interval: -0.3, t: '+1 cone (behind him too).' },
      { damage: 19, hitCd: -0.05, t: '+19 damage, ticks faster.' },
      { len: 40, half: 0.14, t: 'Much wider and longer.' },
      { count: 1, damage: 27, len: 40, duration: 0.3, t: 'MAX: no malarkey in any direction.' }
    ],
    fire(g, p, w, s) {
      const a0 = autoAngle(g, p, 320);
      Sound.throttled('avi', 200, () => { Sound.tone(1200, 0.2, 'sine', 0.07, 2400); Sound.tone(600, 0.18, 'triangle', 0.05, 1200); });
      for (let i = 0; i < s.count; i++) {
        g.spawnShot({
          beh: 'cone', follow: 1, ang: a0 + i * (TAU / Math.max(1, s.count)),
          len: s.len * s.area, half: s.half, r: s.len * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, hitCd: Math.max(0.1, s.hitCd),
          slow: s.slow, slowTime: s.slowTime, color: '#bfe4ff'
        });
      }
    }
  },

  /* ============================================================
     FUSIONS

     One per president, unlocked only once BOTH their primary and
     secondary sit at max rank. Each one is the two parent weapons
     welded together and turned up past the point of good taste —
     which is the point. The late strongpoints are tuned assuming
     you have one.

     Trump's fusion is the Golden Escalator, defined up in his
     section because it reuses the escalator sprite.
     ============================================================ */

  fusion_washington: {
    id: 'fusion_washington', name: 'THE DELAWARE CROSSING', icon: '⚔️', owner: 'washington',
    desc: 'He stands in the boat. He should not stand in the boat. Axes orbit him and the whole Continental Army fires outward at once.',
    style: 'orbit', maxLevel: 5,
    interval: 3.4, damage: 372, area: 1, count: 5, radius: 74,
    knockback: 320, duration: 3.2, hitCd: 0.28, muskets: 14,
    levels: [null, null,
      { count: 2, damage: 160, t: '+2 orbiting axes, +90 damage.' },
      { muskets: 8, radius: 14, t: '+8 muskets in the ring, wider orbit.' },
      { interval: -0.7, hitCd: -0.06, t: 'Faster, hits more often.' },
      { count: 2, damage: 264, muskets: 10, t: 'MAX: an entire army, in a rowboat.' }
    ],
    fire(g, p, w, s) {
      const n = Math.round(s.count);
      for (let i = 0; i < n; i++) {
        g.spawnShot({
          beh: 'orbit', follow: 1, ang: (i / n) * TAU, angVel: 3.1,
          orbR: s.radius * s.area, r: 20 * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, hitCd: Math.max(0.12, s.hitCd),
          art: Art.fx('axe'), artScale: 2.0 * s.area, spin: 26
        });
      }
      const m = Math.round(s.muskets);
      for (let i = 0; i < m; i++) {
        const a = (i / m) * TAU;
        g.spawnShot({
          beh: 'proj', x: p.x, y: p.y, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360,
          r: 7 * s.area, dmg: s.damage * 0.55, pierce: 12, life: 1.6, knock: 90,
          color: '#ffe9a8', glow: '#ffb84a', trail: 1, ang: a
        });
      }
      Sound.swing(); Sound.shoot(); g.shake(4);
    }
  },

  fusion_lincoln: {
    id: 'fusion_lincoln', name: 'THE GETTYSBURG ADDRESS', icon: '📜', owner: 'lincoln',
    desc: 'Four score and seven beams, sweeping the field, while split rails roll out in every direction. Government of the people, by the people, aimed at the people.',
    style: 'beam', maxLevel: 5,
    interval: 3.2, damage: 530, area: 1, count: 5, len: 330, width: 30,
    knockback: 90, duration: 1.5, logs: 6, spin: 2.1,
    levels: [null, null,
      { count: 1, damage: 230, t: '+1 sweeping beam, +130 damage.' },
      { len: 70, width: 10, logs: 3, t: 'Longer beams, +3 logs.' },
      { interval: -0.6, spin: 0.7, t: 'Sweeps faster, more often.' },
      { count: 2, damage: 389, logs: 4, t: 'MAX: the field is entirely address.' }
    ],
    fire(g, p, w, s) {
      const n = Math.round(s.count);
      const base = aimAngle(g, p);
      for (let i = 0; i < n; i++) {
        // Beams are 'arc'-driven so they rotate: a sweeping searchlight of
        // emancipation rather than a single fixed lance.
        g.spawnShot({
          beh: 'beam', follow: 1, ang: base + (i / n) * TAU, sweepVel: s.spin,
          len: s.len * s.area, wid: s.width * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, hitCd: 0.3,
          color: '#ffe9a8', glow: '#ffd24a'
        });
      }
      const lg = Math.round(s.logs);
      for (let i = 0; i < lg; i++) {
        const a = (i / lg) * TAU + rand(-0.15, 0.15);
        g.spawnShot({
          beh: 'proj', x: p.x, y: p.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190,
          r: 18 * s.area, dmg: s.damage * 0.6, pierce: 999, life: 3.0, knock: 380,
          art: Art.fx('log'), artScale: 2.0 * s.area, spin: 6, hitCd: 0.45, ang: a
        });
      }
      Sound.beam(); g.shake(5);
    }
  },

  fusion_teddy: {
    id: 'fusion_teddy', name: 'THE BULLY PULPIT', icon: '🫎', owner: 'teddy',
    desc: 'Speak softly, and bring a stampede. The whole Bull Moose Party charges in from every direction while he clears the middle personally.',
    style: 'sweep', maxLevel: 5,
    interval: 4.4, damage: 742, area: 1, count: 5, speed: 380,
    knockback: 620, duration: 2.6, shock: 190, shockDmg: 459,
    levels: [null, null,
      { count: 2, damage: 301, t: '+2 moose, +170 damage.' },
      { shock: 44, shockDmg: 230, t: 'Wider shockwave, +130 damage.' },
      { interval: -0.9, speed: 60, t: 'Faster charges, more often.' },
      { count: 2, damage: 495, shock: 50, t: 'MAX: a genuine constitutional crisis.' }
    ],
    fire(g, p, w, s) {
      const n = Math.round(s.count);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + rand(-0.2, 0.2);
        const sx = p.x - Math.cos(ang) * 300, sy = p.y - Math.sin(ang) * 300;
        g.spawnShot({
          beh: 'proj', x: sx, y: sy, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          r: 26 * s.area, dmg: s.damage, pierce: 999, life: s.duration, knock: s.knockback,
          art: Art.vehicle('moose'), artScale: 2.0 * s.area, faceVel: 1, hitCd: 0.4, ang, dust: 1
        });
      }
      g.spawnShot({
        beh: 'wave', x: p.x, y: p.y, follow: 1, r: 16, rMax: s.shock * s.area,
        dmg: s.shockDmg, pierce: 999, life: 0.8, knock: 520, color: '#c9a878', ring: 1
      });
      Sound.bigHit(); g.shake(9);
    }
  },

  fusion_fdr: {
    id: 'fusion_fdr', name: 'THE FOUR FREEDOMS', icon: '♿', owner: 'fdr',
    desc: 'Freedom of speech, freedom of worship, freedom from want, and freedom from whatever is standing there. Four spiked chairs orbit him at speed.',
    style: 'orbit', maxLevel: 5,
    interval: 4.0, damage: 424, area: 1, count: 4, radius: 88,
    knockback: 420, duration: 4.0, hitCd: 0.26, pulse: 150, pulseDmg: 301,
    levels: [null, null,
      { count: 2, damage: 194, t: '+2 chairs, +110 damage.' },
      { radius: 20, pulse: 40, t: 'Wider orbit, wider broadcast.' },
      { interval: -0.8, duration: 1.2, hitCd: -0.05, t: 'Longer uptime, faster hits.' },
      { count: 2, damage: 318, pulseDmg: 247, t: 'MAX: an unprecedented fourth term.' }
    ],
    fire(g, p, w, s) {
      const n = Math.round(s.count);
      for (let i = 0; i < n; i++) {
        g.spawnShot({
          beh: 'orbit', follow: 1, ang: (i / n) * TAU, angVel: 3.6,
          orbR: s.radius * s.area, r: 22 * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, hitCd: Math.max(0.12, s.hitCd),
          art: Art.vehicle('chair'), artScale: 1.5 * s.area, spin: 11
        });
      }
      g.spawnShot({
        beh: 'wave', x: p.x, y: p.y, follow: 1, r: 14, rMax: s.pulse * s.area,
        dmg: s.pulseDmg, pierce: 999, life: 0.9, knock: 150, color: '#ffb84a', ring: 1
      });
      Sound.throttled('ff', 200, () => { Sound.tone(300, 0.45, 'sine', 0.13, 180); Sound.noise(0.3, 0.1, 800, 250); });
      g.shake(5);
    }
  },

  fusion_jfk: {
    id: 'fusion_jfk', name: 'THE NEW FRONTIER', icon: '🚀', owner: 'jfk',
    desc: 'We choose to do this. Not because it is easy, but because the entire Atlantic fleet and the entire space program arrive simultaneously.',
    style: 'drop', maxLevel: 5,
    interval: 3.6, damage: 707, area: 1, count: 5, radius: 84, delay: 0.75,
    knockback: 340, duration: 0.4, boats: 4, boatDmg: 459,
    levels: [null, null,
      { count: 2, damage: 318, t: '+2 rockets, +180 damage.' },
      { radius: 18, boats: 2, t: 'Bigger blasts, +2 boats.' },
      { interval: -0.7, delay: -0.2, t: 'Faster launches, faster descent.' },
      { count: 2, damage: 530, boats: 2, boatDmg: 318, t: 'MAX: the whole New Frontier at once.' }
    ],
    fire(g, p, w, s) {
      for (let i = 0; i < Math.round(s.count); i++) {
        const t = bestCluster(g, p.x, p.y, s.radius * s.area, 400) ||
                  { x: p.x + rand(-140, 140), y: p.y + rand(-140, 140) };
        g.spawnShot({
          beh: 'drop', x: t.x + rand(-40, 40), y: t.y + rand(-40, 40),
          r: s.radius * s.area, dmg: s.damage, pierce: 999, life: s.duration,
          knock: s.knockback, delay: s.delay + i * 0.12,
          art: Art.fx('moon'), artScale: 2.1 * s.area, fallH: 300, boom: '#ffd66a', shakeAmt: 7
        });
      }
      const b = Math.round(s.boats);
      for (let i = 0; i < b; i++) {
        const a = (i / b) * TAU + rand(-0.2, 0.2);
        g.spawnShot({
          beh: 'proj', x: p.x, y: p.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
          r: 22 * s.area, dmg: s.boatDmg, pierce: 999, life: 1.6, knock: 340,
          art: Art.vehicle('boat'), artScale: 1.5 * s.area, faceVel: 1, hitCd: 0.4, ang: a, wake: 1
        });
      }
      Sound.boom(); g.shake(6);
    }
  },

  fusion_nixon: {
    id: 'fusion_nixon', name: 'EXPLETIVE DELETED', icon: '🕳️', owner: 'nixon',
    desc: 'The tapes and the gap, at last, together. A hole opens in the historical record. Everything near it is redacted, sealed, and never spoken of again.',
    style: 'zone', maxLevel: 5,
    interval: 5.0, damage: 335, area: 1, count: 1, radius: 130,
    knockback: -280, duration: 4.2, hitCd: 0.22, reels: 8, reelDmg: 194,
    levels: [null, null,
      { radius: 26, damage: 160, t: 'A larger hole, +90 damage.' },
      { reels: 4, duration: 1.2, t: '+4 reels, lasts longer.' },
      { interval: -1.0, hitCd: -0.05, t: 'More frequent, erases faster.' },
      { count: 1, damage: 264, radius: 30, t: 'MAX: eighteen and a half minutes of absolutely nothing.' }
    ],
    fire(g, p, w, s) {
      for (let i = 0; i < Math.round(s.count); i++) {
        const t = bestCluster(g, p.x, p.y, s.radius * s.area, 320) ||
                  { x: p.x + rand(-90, 90), y: p.y + rand(-90, 90) };
        g.spawnShot({
          beh: 'zone', x: t.x, y: t.y, r: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, hitCd: Math.max(0.1, s.hitCd),
          color: '#1a0f22', void: 1
        });
        const n = Math.round(s.reels);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU;
          const rr = s.radius * s.area * 0.85;
          g.spawnShot({
            beh: 'trap', x: t.x + Math.cos(a) * rr, y: t.y + Math.sin(a) * rr,
            r: 40 * s.area, dmg: s.reelDmg, pierce: 999, life: s.duration,
            knock: 0, hitCd: 0.3, slow: 0.08,
            art: Art.fx('reel'), artScale: 1.5 * s.area, spin: 5, color: '#6a5a3a'
          });
        }
      }
      Sound.throttled('exp', 250, () => { Sound.tone(70, 0.7, 'sine', 0.18, 32); Sound.noise(0.5, 0.12, 300, 80); });
      g.shake(7);
    }
  },

  fusion_reagan: {
    id: 'fusion_reagan', name: 'THE STRATEGIC JELLY RESERVE', icon: '🍬', owner: 'reagan',
    desc: 'The orbital platforms were never for missiles. They were always for this. Confectionery rains from space at terminal velocity.',
    style: 'orbit', maxLevel: 5,
    interval: 4.6, damage: 264, area: 1, count: 8, radius: 96,
    knockback: 140, duration: 5.5, hitCd: 0.3, rain: 26, rainDmg: 301,
    levels: [null, null,
      { count: 3, damage: 123, t: '+3 satellites, +70 damage.' },
      { rain: 14, rainDmg: 160, t: '+14 beans per salvo, harder.' },
      { interval: -0.9, duration: 1.5, t: 'Longer coverage, more often.' },
      { count: 3, damage: 194, rain: 18, t: 'MAX: the reserve is fully deployed.' }
    ],
    fire(g, p, w, s) {
      const n = Math.round(s.count);
      for (let i = 0; i < n; i++) {
        g.spawnShot({
          beh: 'orbit', follow: 1, ang: (i / n) * TAU, angVel: 2.6,
          orbR: s.radius * s.area, r: 22 * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, hitCd: Math.max(0.12, s.hitCd),
          art: Art.fx('sat'), artScale: 1.5 * s.area, zap: 1, color: '#7fd4ff'
        });
      }
      const r = Math.round(s.rain);
      for (let i = 0; i < r; i++) {
        const a = RNG() * TAU, d = rand(30, 230) * s.area;
        g.spawnShot({
          beh: 'drop', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
          r: 30 * s.area, dmg: s.rainDmg, pierce: 999, life: 0.3,
          knock: 120, delay: 0.4 + RNG() * 0.7,
          art: Art.fx('bean', BEAN_COLORS[(RNG() * BEAN_COLORS.length) | 0]),
          artScale: 2.2 * s.area, fallH: 260, boom: '#ffd35e'
        });
      }
      Sound.throttled('sjr', 220, () => { Sound.tone(900, 0.16, 'sine', 0.08, 1500); Sound.noise(0.3, 0.1, 1800, 500); });
    }
  },

  fusion_clinton: {
    id: 'fusion_clinton', name: 'THE THIRD WAY', icon: '🎷', owner: 'clinton',
    desc: 'Triangulation, weaponized. Sonic waves in every direction, a grease slick underneath, and not one straight answer anywhere.',
    style: 'wave', maxLevel: 5,
    interval: 2.6, damage: 530, area: 1, count: 4, radius: 186,
    knockback: 420, duration: 1.0, grease: 4.0, greaseDmg: 212,
    levels: [null, null,
      { count: 1, damage: 230, t: '+1 wave, +130 damage.' },
      { radius: 50, greaseDmg: 123, t: 'Wider waves, greasier.' },
      { interval: -0.5, grease: 1.4, t: 'More frequent, slick lingers.' },
      { count: 2, damage: 372, radius: 60, t: 'MAX: the whole saxophone, all at once.' }
    ],
    fire(g, p, w, s) {
      for (let i = 0; i < Math.round(s.count); i++) {
        g.spawnShot({
          beh: 'wave', x: p.x, y: p.y, follow: i === 0 ? 1 : 0,
          r: 14, rMax: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, delay: i * 0.16,
          color: '#ffd35e', ring: 1
        });
      }
      g.spawnShot({
        beh: 'zone', x: p.x, y: p.y, r: s.radius * s.area * 0.62, dmg: s.greaseDmg,
        pierce: 999, life: s.grease, hitCd: 0.35, slow: 0.42, slowTime: 1.4,
        color: '#8a6a2a', grease: 1
      });
      Sound.throttled('t3', 150, () => {
        Sound.tone(392, 0.3, 'sawtooth', 0.14, 784);
        Sound.tone(587, 0.26, 'square', 0.09, 1175, 0.06);
      });
      g.shake(4);
    }
  },

  fusion_bush43: {
    id: 'fusion_bush43', name: 'SHOCK AND AWE', icon: '🪧', owner: 'bush43',
    desc: 'Victory is declared across the entire visible area simultaneously, and a great many shoes are returned to sender.',
    style: 'drop', maxLevel: 5,
    interval: 3.8, damage: 584, area: 1, count: 6, radius: 78, delay: 0.6,
    knockback: 120, duration: 0.4, pin: 4.0, pinDmg: 194, shoes: 8,
    levels: [null, null,
      { count: 2, damage: 247, t: '+2 banners, +140 damage.' },
      { radius: 16, shoes: 4, t: 'Bigger banners, +4 shoes.' },
      { interval: -0.7, pin: 1.2, t: 'More frequent, pins longer.' },
      { count: 2, damage: 424, shoes: 6, t: 'MAX: mission extremely accomplished.' }
    ],
    fire(g, p, w, s) {
      for (let i = 0; i < Math.round(s.count); i++) {
        const t = bestCluster(g, p.x, p.y, s.radius * s.area, 380) ||
                  { x: p.x + rand(-150, 150), y: p.y + rand(-150, 150) };
        g.spawnShot({
          beh: 'drop', x: t.x + rand(-50, 50), y: t.y + rand(-50, 50),
          r: s.radius * s.area, dmg: s.damage, pierce: 999, life: s.duration,
          knock: s.knockback, delay: s.delay + i * 0.09,
          art: Art.banner(), artScale: 1.6 * s.area, fallH: 240, boom: '#efe4cf', flat: 1, shakeAmt: 5,
          leave: { beh: 'zone', r: s.radius * s.area, dmg: s.pinDmg, life: s.pin, hitCd: 0.4, slow: 0.06, color: '#efe4cf', cloth: 1 }
        });
      }
      const sh = Math.round(s.shoes);
      for (let i = 0; i < sh; i++) {
        g.spawnShot({
          beh: 'boomerang', x: p.x, y: p.y, ang: (i / sh) * TAU, sp: 380,
          r: 15 * s.area, dmg: s.damage * 0.45, pierce: 999, life: 1.8, knock: 180,
          art: Art.fx('shoe'), artScale: 1.7 * s.area, spin: 16, hitCd: 0.4
        });
      }
      Sound.boom();
    }
  },

  fusion_obama: {
    id: 'fusion_obama', name: 'YES WE CAN', icon: '🎤', owner: 'obama',
    desc: 'Hope, at a scale the founders did not anticipate, punctuated by a ring of microphones hitting the ground in perfect unison.',
    style: 'wave', maxLevel: 5,
    interval: 3.0, damage: 671, area: 1, count: 3, radius: 300,
    knockback: 200, duration: 1.2, slow: 0.4, slowTime: 2.0, mics: 6, micDmg: 601,
    levels: [null, null,
      { count: 1, damage: 283, t: '+1 wave, +160 damage.' },
      { radius: 60, mics: 3, t: 'Wider hope, +3 microphones.' },
      { interval: -0.6, slowTime: 0.8, t: 'More frequent, longer order.' },
      { count: 2, damage: 495, radius: 70, micDmg: 389, t: 'MAX: hope on a hemispheric scale.' }
    ],
    fire(g, p, w, s) {
      for (let i = 0; i < Math.round(s.count); i++) {
        g.spawnShot({
          beh: 'wave', x: p.x, y: p.y, follow: i === 0 ? 1 : 0,
          r: 16, rMax: s.radius * s.area, dmg: s.damage, pierce: 999,
          life: s.duration, knock: s.knockback, delay: i * 0.24,
          slow: s.slow, slowTime: s.slowTime, color: '#7fd4ff', ring: 1, orderly: 1
        });
      }
      const m = Math.round(s.mics);
      for (let i = 0; i < m; i++) {
        const a = (i / m) * TAU;
        const d = s.radius * s.area * 0.55;
        g.spawnShot({
          beh: 'drop', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
          r: 76 * s.area, dmg: s.micDmg, pierce: 999, life: 0.35,
          knock: 520, delay: 0.4,
          art: Art.fx('mic'), artScale: 2.0 * s.area, fallH: 200, boom: '#c8ccd6', shakeAmt: 5
        });
      }
      Sound.throttled('ywc', 160, () => {
        Sound.tone(523, 0.4, 'sine', 0.13, 1046);
        Sound.tone(784, 0.34, 'triangle', 0.09, 1568, 0.1);
      });
      g.shake(6);
    }
  },

  fusion_biden: {
    id: 'fusion_biden', name: 'THE AMTRAK EXPRESS', icon: '🚆', owner: 'biden',
    desc: 'Forty years of commuting, and he kept the timetable. The 7:15 to Wilmington arrives directly through the horde, on schedule, doors not opening.',
    style: 'sweep', maxLevel: 5,
    interval: 4.6, damage: 1096, area: 1, count: 2, speed: 520,
    knockback: 640, duration: 2.4, cones: 3, coneDmg: 230, coneLen: 210,
    levels: [null, null,
      { count: 1, damage: 459, t: '+1 train, +260 damage.' },
      { coneLen: 50, cones: 1, t: 'Longer glare, +1 cone.' },
      { interval: -0.9, speed: 80, t: 'Faster service, more often.' },
      { count: 1, damage: 742, cones: 2, t: 'MAX: the entire Northeast Corridor.' }
    ],
    fire(g, p, w, s) {
      for (let i = 0; i < Math.round(s.count); i++) {
        const ang = (i === 0) ? aimAngle(g, p) + rand(-0.2, 0.2) : RNG() * TAU;
        const sx = p.x - Math.cos(ang) * 360, sy = p.y - Math.sin(ang) * 360;
        g.spawnShot({
          beh: 'proj', x: sx, y: sy, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          r: 30 * s.area, dmg: s.damage, pierce: 999, life: s.duration, knock: s.knockback,
          art: Art.fx('train'), artScale: 1.5 * s.area, faceVel: 1, hitCd: 0.4, ang, dust: 1
        });
      }
      const c = Math.round(s.cones);
      for (let i = 0; i < c; i++) {
        g.spawnShot({
          beh: 'cone', follow: 1, ang: (i / c) * TAU + aimAngle(g, p),
          len: s.coneLen * s.area, half: 0.62, r: s.coneLen * s.area,
          dmg: s.coneDmg, pierce: 999, life: 1.2, knock: 120, hitCd: 0.2,
          slow: 0.45, slowTime: 1.2, color: '#bfe4ff'
        });
      }
      Sound.throttled('amtrak', 220, () => {
        Sound.tone(180, 0.7, 'sawtooth', 0.18, 90);
        Sound.tone(90, 0.6, 'square', 0.12, 60);
        Sound.noise(0.6, 0.13, 420, 150);
      });
      g.shake(10);
    }
  }
};

/* ------------------------------------------------------------
   Shared helpers used by more than one weapon.
   ------------------------------------------------------------ */

/** Pick a target not already in `used` — keeps multi-beams from stacking. */
function pickUnusedEnemy(g, p, used, maxR) {
  const list = g.enemies.active;
  let best = null, bestD = maxR * maxR;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead || used.indexOf(e) >= 0) continue;
    const d = dist2(p.x, p.y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/**
 * Vehicle-style attacks (moose, Corvette) enter from off-screen and
 * drive clean through the player's position.
 */
function sweepAcross(g, p, s, art, artScale, color, i) {
  const ang = (i === 0) ? aimAngle(g, p) + rand(-0.25, 0.25) : rand(0, TAU);
  const startD = 240;
  const sx = p.x - Math.cos(ang) * startD;
  const sy = p.y - Math.sin(ang) * startD;
  g.spawnShot({
    beh: 'proj', x: sx, y: sy,
    vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
    r: 20 * s.area, dmg: s.damage, pierce: 999, life: s.duration,
    knock: s.knockback, art, artScale: artScale * s.area, faceVel: 1,
    hitCd: 0.45, ang, color, dust: 1
  });
}

/* ============================================================
   ATTACK TYPES

   `style` says how a weapon is built; this turns it into something a
   player can read at a glance, plus modifier tags for what it does on
   top of that (splash damage, burning ground, slows, and so on).
   ============================================================ */
const STYLE_LABELS = {
  arc:       'MELEE',
  proj:      'PROJECTILE',
  beam:      'BEAM',
  cone:      'CONE',
  wave:      'SHOCKWAVE',
  aura:      'AURA',
  zone:      'ZONE',
  trap:      'TRAP',
  drop:      'SPLASH',
  orbit:     'ORBITAL',
  boomerang: 'BOOMERANG',
  ricochet:  'RICOCHET',
  sweep:     'CHARGE'
};

/** Human-readable type + modifiers, e.g. "SPLASH · BURN · KNOCKBACK". */
function weaponType(def) {
  const parts = [STYLE_LABELS[def.style] || 'SPECIAL'];
  if (def.splash) parts.push('SPLASH');
  if (def.leave && def.leave.fire) parts.push('BURN');
  if (def.burn || def.burnDmg) parts.push('BURN');
  if (def.glitter || def.glitterDmg) parts.push('LINGERS');
  if (def.puddle || def.grease || def.greaseDmg) parts.push('SLICK');
  if (def.pin || def.pinDmg) parts.push('PINS');
  if (def.slow) parts.push('SLOW');
  if (def.pierce >= 999) parts.push('PIERCING');
  else if (def.pierce >= 3) parts.push('PIERCE ' + def.pierce);
  if (def.bounces) parts.push('BOUNCES');
  if (def.knockback >= 350) parts.push('KNOCKBACK');
  if (def.count >= 4) parts.push('MULTI');
  if (def.hitCd) parts.push('TICKS');
  return parts.join(' · ');
}

/** Short one-word type, for tight spaces. */
function weaponTypeShort(def) { return STYLE_LABELS[def.style] || 'SPECIAL'; }

/** Jelly-bean flavors. Pre-tinted at warm-up, one cached sprite each. */
const BEAN_COLORS = ['#ff6b6b', '#ffd35e', '#7ee88a', '#7fd4ff', '#d89aff', '#ffa04a'];

/** All weapon ids, in a stable order. */
const WEAPON_IDS = Object.keys(WEAPONS);

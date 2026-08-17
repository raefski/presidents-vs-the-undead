/* ============================================================
   entities.js — the player, the horde, and everything they throw.

   Three pooled entity types live here:
     PLAYER  — one of them, driven by Input, fires weapons on timers
     ENEMY   — up to ~700 at once, each running a small AI behavior
     SHOT    — every weapon effect, dispatched by its `beh` string
     PICKUP  — gems, food, chests

   The hot paths (enemy movement, shot/enemy overlap) are written to
   avoid allocation: no closures, no temporary objects, squared
   distances instead of sqrt wherever a comparison will do.
   ============================================================ */

let ENTITY_UID = 1;

/* Scratch arrays reused by the neighbor queries. Module-scope so the
   inner loops never allocate. */
const _near = [];
const _near2 = [];

/* ============================================================
   PLAYER
   ============================================================ */

function makePlayer(pres) {
  const p = {
    kind: 'player',
    pres,
    x: 0, y: 0, vx: 0, vy: 0,
    face: { x: 1, y: 0 },
    r: 8,
    stats: Object.assign({}, pres.stats),
    hp: pres.stats.hp, maxHp: pres.stats.hp,
    weapons: [], passives: {},
    purchases: 0, assistant: null, assistantRank: 0,
    invuln: 0, hurtFlash: 0, dead: 0,
    frame: 0, frameT: 0, moving: 0,
    dmgDealt: 0, revivesUsed: 0,
    boostT: 0
  };
  p.weapons.push(makeWeapon(WEAPONS[pres.weapon]));
  recomputeStats(p);
  p.hp = p.maxHp;
  return p;
}

function updatePlayer(g, dt) {
  const p = g.player;
  if (p.dead) return;

  /* ---- movement ---- */
  const d = Input.dir();
  const spd = p.stats.speed * (p.boostT > 0 ? 1.35 : 1);
  p.vx = d.x * spd;
  p.vy = d.y * spd;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  World.collide(p, p.r);
  World.clampToWorld(p, p.r);

  if (d.x !== 0 || d.y !== 0) {
    p.face.x = d.x; p.face.y = d.y;
    p.moving = 1;
    // Two-frame walk cycle, faster when moving faster.
    p.frameT += dt * (spd / 26);
    if (p.frameT >= 1) { p.frameT = 0; p.frame ^= 1; }
  } else {
    p.moving = 0; p.frame = 0; p.frameT = 0;
  }

  /* ---- timers ---- */
  if (p.invuln > 0) p.invuln -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (p.boostT > 0) p.boostT -= dt;
  if (p.stats.regen > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + p.stats.regen * dt);
  }

  /* ---- weapons fire themselves ---- */
  for (let i = 0; i < p.weapons.length; i++) {
    const w = p.weapons[i];
    const s = wstats(w, p);
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer += s.interval;
      if (w.timer < 0) w.timer = s.interval;   // catch up after a long pause
      w.def.fire(g, p, w, s);
    }
  }
}

/** Damage the player, respecting armor and the short global i-frame. */
function hurtPlayer(g, amount) {
  const p = g.player;
  if (p.dead || p.invuln > 0) return;
  // Armor is subtractive but capped at 75% reduction. Flat subtraction alone
  // made a stack of Secret Service into total immunity against early tiers,
  // since their hits were smaller than the armor value.
  const dmg = Math.max(1, Math.max(amount * 0.25, amount - p.stats.armor));
  p.hp -= dmg;
  p.invuln = 0.18;
  p.hurtFlash = 0.28;
  Sound.hurt();
  g.shake(Math.min(7, 2 + dmg * 0.06));
  FX.burst(p.x, p.y, 6, '#d8324a', 100, 0.35, 2, 'square', 180);

  if (p.hp <= 0) {
    // Rose Garden Pardon: overturn one death per rank.
    //
    // This has to be a real second chance, not a reprieve. At 50% health
    // and 2.5s of grace you simply died again to the same boss before you
    // could disengage, which reads as the revive not working at all. Full
    // heal, six seconds of invulnerability, a screen clear and a burst of
    // speed — enough to actually walk out of a strongpoint.
    if (p.revivesUsed < p.stats.revives) {
      p.revivesUsed++;
      p.hp = p.maxHp;
      p.invuln = 6.0;
      p.boostT = 4.0;
      g.nuke();
      // Shove everything still standing well clear.
      const A = g.enemies.active;
      for (let i = 0; i < A.length; i++) {
        const e = A[i];
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 300) { e.kx += (dx / d) * 900; e.ky += (dy / d) * 900; }
      }
      FX.ring(p.x, p.y, 10, 300, 0.9, 'rgba(255,143,208,.95)', 6);
      FX.ring(p.x, p.y, 10, 210, 1.3, 'rgba(255,255,255,.8)', 3);
      FX.say(p.x, p.y - 34, 'PARDONED', '#ff8fd0', 18);
      g.announce('ROSE GARDEN PARDON', 'Death overturned. ' +
        (p.stats.revives - p.revivesUsed) + ' remaining. Six seconds of immunity — use them.');
      g.flash(0.55, '255,143,208');
      g.shake(12);
      Sound.win();
      return;
    }
    p.hp = 0;
    p.dead = 1;
    g.onPlayerDeath();
  }
}

/* ============================================================
   ENEMIES
   ============================================================ */

function newEnemy() {
  return {
    kind: 'enemy', uid: 0, x: 0, y: 0, vx: 0, vy: 0,
    kx: 0, ky: 0,                 // knockback velocity, decays fast
    hp: 1, maxHp: 1, def: null, faction: null,
    r: 8, speed: 30, dmg: 5, xp: 1, scale: 1.6,
    dead: 0, isBoss: 0, flying: 0, elite: 0, knockRes: 0,
    slowT: 0, slowMul: 1, rootT: 0,
    touchCd: 0, hitFlash: 0, spawnT: 0, gold: 0,
    cvx: 0, cvy: 0,               // locked-in charge direction
    anchorX: 0, anchorY: 0, leash: 0, post: null, mini: 0, summoned: 0,
    frame: 0, frameT: 0, aiT: 0, state: 0, stateT: 0, shootT: 0,
    art: null, artScale: 1, drawScale: 1, sprite: null,
    sprA: null, sprB: null,       // pre-resolved walk frames
    abil: null, abilT: null, phase: 0
  };
}

function resetEnemy(e) {
  e.dead = 1; e.def = null; e.art = null; e.post = null; e.leash = 0;
  e.sprA = e.sprB = e.sprite = null;
  e.abil = null; e.abilT = null;
}

/**
 * Bring an enemy into the world.
 * `hpMul` is the spawner's global difficulty scaling.
 */
function spawnEnemy(g, def, faction, x, y, hpMul, elite) {
  // A missing def should cost one skipped spawn, never a crashed frame.
  if (!def) return null;

  // Bosses always get a slot; regular units recycle a distant straggler.
  if (g.enemies.count >= g.maxEnemies && !def.abilities) {
    // Hard cap: recycle the enemy furthest from the player instead of
    // refusing to spawn, so pressure keeps coming from where you're facing.
    let worst = -1, worstD = -1;
    const A = g.enemies.active;
    for (let i = 0; i < A.length; i += 3) {
      if (A[i].isBoss) continue;
      const dd = dist2(A[i].x, A[i].y, g.player.x, g.player.y);
      if (dd > worstD) { worstD = dd; worst = i; }
    }
    if (worst < 0) return null;
    g.enemies.releaseAt(worst);
  }

  const e = g.enemies.get();
  e.uid = ENTITY_UID++;
  e.def = def; e.faction = faction;
  e.x = x; e.y = y; e.vx = e.vy = e.kx = e.ky = 0;
  e.isBoss = !!def.abilities;
  e.elite = elite ? 1 : 0;

  const em = elite ? 4.5 : 1;
  e.maxHp = e.hp = def.hp * hpMul * em;
  e.r = def.r * (elite ? 1.35 : 1);
  e.speed = def.speed * (elite ? 0.88 : 1);
  e.dmg = def.dmg * (elite ? 1.5 : 1);
  e.xp = Math.round(def.xp * (elite ? 3.5 : 1));
  e.scale = (def.scale || def.sprite && def.sprite.scale || 1.6) * (elite ? 1.3 : 1);
  e.knockRes = def.knockRes || 0;
  e.flying = def.flying ? 1 : 0;
  e.dead = 0;
  e.slowT = 0; e.slowMul = 1; e.rootT = 0;
  e.touchCd = 0; e.hitFlash = 0;
  e.spawnT = e.isBoss ? 0 : 0.22;     // brief fade-in so pop-in is less jarring
  e.frame = (RNG() * 2) | 0; e.frameT = RNG();
  e.aiT = RNG() * 2; e.state = 0; e.stateT = 0; e.shootT = rand(0.5, 2);
  e.phase = 0;
  e.anchorX = 0; e.anchorY = 0; e.leash = 0; e.post = null; e.mini = 0; e.summoned = 0;

  // Resolve sprites once here rather than doing a cache lookup for every
  // enemy on every frame.
  e.drawScale = elite ? 1.28 : 1;
  if (def.fxArt) {
    e.art = Art.fx(def.fxArt, def.fxTint);
    e.artScale = (def.fxScale || 2) / 2;   // fx sprites are pre-rendered at 2x
    e.sprite = null; e.sprA = e.sprB = null;
  } else {
    e.art = null;
    e.sprite = def.sprite;
    e.sprA = Art.person(def.sprite, 0);
    e.sprB = Art.person(def.sprite, 1);
  }

  if (def.abilities) {
    e.abil = def.abilities;
    e.abilT = {};
    for (const a of def.abilities) e.abilT[a] = rand(2, 5);
  }
  return e;
}

/* ---- AI ------------------------------------------------------ */

function updateEnemies(g, dt) {
  const A = g.enemies.active;
  const p = g.player;
  const grid = g.grid;

  // Rebuild the spatial index once per frame.
  grid.clear();
  for (let i = 0; i < A.length; i++) if (!A[i].dead) grid.insert(A[i]);

  // Scaled to the view: a wider camera must keep more of the world alive
  // or enemies recycle while still visible at the edges.
  const cullR2 = (VIEW_R * 2.4) * (VIEW_R * 2.4);

  for (let i = A.length - 1; i >= 0; i--) {
    const e = A[i];
    if (e.dead) { g.enemies.releaseAt(i); continue; }

    if (e.spawnT > 0) e.spawnT -= dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.touchCd > 0) e.touchCd -= dt;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
    if (e.rootT > 0) e.rootT -= dt;

    const dx = p.x - e.x, dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;

    // Recycle stragglers so the pool keeps serving the action.
    if (d2 > cullR2 && !e.isBoss && !e.leash) { g.enemies.releaseAt(i); continue; }

    const d = Math.sqrt(d2) || 1;
    const nx = dx / d, ny = dy / d;

    let mx = 0, my = 0;
    const spd = e.speed * e.slowMul * (e.rootT > 0 ? 0 : 1);

    // A garrison is DORMANT until the player comes near its building.
    // Without this, every strongpoint boss in town shells you from the
    // far side of the map from the first second of the run.
    const dormant = e.post && !e.post.aggro;

    switch (dormant ? '_hold' : e.def.ai) {
      case '_hold': {
        // Drift back to the post and otherwise ignore the world.
        const ax = e.anchorX - e.x, ay = e.anchorY - e.y;
        const ad = Math.hypot(ax, ay);
        if (ad > 70) { mx = (ax / ad) * e.speed * 0.55; my = (ay / ad) * e.speed * 0.55; }
        else { e.aiT += dt; mx = Math.cos(e.aiT * 0.7 + e.uid) * e.speed * 0.18;
               my = Math.sin(e.aiT * 0.5 + e.uid) * e.speed * 0.18; }
        break;
      }

      case 'drunk': {
        // Wanders around the true heading — they are extremely drunk.
        e.aiT += dt;
        const wob = Math.sin(e.aiT * 2.4 + e.uid) * 0.75;
        const a = Math.atan2(ny, nx) + wob;
        mx = Math.cos(a) * spd; my = Math.sin(a) * spd;
        break;
      }
      case 'march': {
        // Stop-and-go, so formations bunch and gap like a real line.
        e.aiT += dt;
        const gate = (Math.sin(e.aiT * 1.6 + e.uid * 0.7) > -0.55) ? 1 : 0.25;
        mx = nx * spd * gate; my = ny * spd * gate;
        break;
      }
      case 'charger': {
        e.stateT -= dt;
        if (e.state === 0) {
          mx = nx * spd * 0.72; my = ny * spd * 0.72;
          if (e.stateT <= 0 && d < 190) {
            e.state = 1; e.stateT = 0.35; e.cvx = nx; e.cvy = ny;
            // Announce the wind-up: you should always get a beat to move.
            FX.ring(e.x, e.y, 4, e.r * 2.6, 0.3, 'rgba(216,50,74,.75)', 2);
          }
        } else if (e.state === 1) {           // wind-up
          mx = -nx * spd * 0.2; my = -ny * spd * 0.2;
          if (e.stateT <= 0) { e.state = 2; e.stateT = 0.55; }
        } else {                              // dash
          mx = e.cvx * spd * 3.1; my = e.cvy * spd * 3.1;
          // Speed lines, so a sprint reads as a sprint at a glance.
          if (RNG() < 0.5) FX.dust(e.x - e.cvx * 6, e.y - e.cvy * 6, 'rgba(216,50,74,.5)');
          if (e.stateT <= 0) { e.state = 0; e.stateT = rand(1.4, 2.6); }
        }
        break;
      }
      case 'swarm': {
        // Bursts of speed with brief rests; feels like a mob surging.
        e.aiT += dt;
        const burst = (Math.sin(e.aiT * 3.1 + e.uid) > 0) ? 1.5 : 0.45;
        mx = nx * spd * burst; my = ny * spd * burst;
        break;
      }
      case 'tank': {
        mx = nx * spd; my = ny * spd;
        break;
      }
      case 'shooter': {
        const want = e.def.shootRange || 200;
        if (d > want * 1.1) { mx = nx * spd; my = ny * spd; }
        else if (d < want * 0.7) { mx = -nx * spd * 0.8; my = -ny * spd * 0.8; }
        else { mx = -ny * spd * 0.4; my = nx * spd * 0.4; }   // strafe
        e.shootT -= dt;
        if (e.shootT <= 0 && d < want * 1.3) {
          e.shootT = e.def.shootRate || 2.5;
          enemyShoot(g, e, nx, ny);
        }
        break;
      }
      case 'boss_charge': {
        e.stateT -= dt;
        if (e.state === 2) {
          mx = e.cvx * e.speed * 3.4; my = e.cvy * e.speed * 3.4;
          if (e.stateT <= 0) { e.state = 0; e.stateT = rand(2.2, 3.6); }
        } else if (e.state === 1) {
          mx = 0; my = 0;
          if (e.stateT <= 0) { e.state = 2; e.stateT = 0.7; e.cvx = nx; e.cvy = ny; FX.ring(e.x, e.y, 10, e.r * 3, 0.3, 'rgba(255,80,80,.7)', 3); }
        } else {
          mx = nx * spd; my = ny * spd;
          if (e.stateT <= 0 && d < 260) { e.state = 1; e.stateT = 0.55; }
        }
        bossAbilities(g, e, dt, nx, ny, d);
        break;
      }
      case 'boss_tank': {
        mx = nx * spd * 0.8; my = ny * spd * 0.8;
        bossAbilities(g, e, dt, nx, ny, d);
        break;
      }
      case 'boss_flyer': {
        // Flies past on a straight line, loops around, comes back.
        e.stateT -= dt;
        if (e.state === 0) {
          e.cvx = nx; e.cvy = ny; e.state = 1; e.stateT = rand(1.5, 2.2);
        } else if (e.state === 1) {
          mx = e.cvx * e.speed; my = e.cvy * e.speed;
          if (e.stateT <= 0) { e.state = 2; e.stateT = 1.1; }
        } else {
          // Bank around for another pass.
          const a = Math.atan2(e.cvy, e.cvx) + dt * 2.6;
          e.cvx = Math.cos(a); e.cvy = Math.sin(a);
          mx = e.cvx * e.speed * 0.8; my = e.cvy * e.speed * 0.8;
          if (e.stateT <= 0 || d > 420) { e.state = 0; }
        }
        bossAbilities(g, e, dt, nx, ny, d);
        break;
      }
      case 'boss_final': {
        // Phases: gets faster and more aggressive as health drops.
        const frac = e.hp / e.maxHp;
        const ph = frac > 0.66 ? 0 : (frac > 0.33 ? 1 : 2);
        if (ph !== e.phase) {
          e.phase = ph;
          FX.ring(e.x, e.y, 10, 200, 0.7, 'rgba(242,193,78,.9)', 5);
          FX.say(e.x, e.y - 60, ph === 1 ? 'THE KING IS CROSS' : 'THE KING IS FURIOUS', '#f2c14e', 14);
          Sound.bossSpawn();
          g.shake(10);
        }
        e.stateT -= dt;
        const agg = 1 + ph * 0.3;
        if (e.state === 2) {
          mx = e.cvx * e.speed * 3.6 * agg; my = e.cvy * e.speed * 3.6 * agg;
          if (e.stateT <= 0) { e.state = 0; e.stateT = rand(1.6, 2.6) / agg; }
        } else if (e.state === 1) {
          if (e.stateT <= 0) { e.state = 2; e.stateT = 0.75; e.cvx = nx; e.cvy = ny; FX.ring(e.x, e.y, 10, e.r * 3.5, 0.3, 'rgba(255,80,80,.8)', 4); }
        } else {
          mx = nx * spd * agg; my = ny * spd * agg;
          if (e.stateT <= 0 && d < 300) { e.state = 1; e.stateT = 0.5; }
        }
        bossAbilities(g, e, dt, nx, ny, d);
        break;
      }
      default:
        mx = nx * spd; my = ny * spd;
    }

    /* ---- garrison: hold the post rather than chasing across town ---- */
    if (e.leash && !dormant) {
      const ax = e.anchorX - e.x, ay = e.anchorY - e.y;
      const ad = Math.hypot(ax, ay);
      if (ad > e.leash) {
        // Outside the leash, everything else is overridden: go back.
        mx = (ax / ad) * e.speed * 1.4;
        my = (ay / ad) * e.speed * 1.4;
        e.state = 0;
      }
    }

    e.vx = mx; e.vy = my;

    /* ---- knockback decays exponentially ---- */
    if (e.kx || e.ky) {
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      const k = Math.exp(-9 * dt);
      e.kx *= k; e.ky *= k;
      if (Math.abs(e.kx) < 2 && Math.abs(e.ky) < 2) e.kx = e.ky = 0;
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // Flyers pass over the rooftops; everyone else respects the town.
    if (!e.flying) World.collide(e, e.r);
    World.clampToWorld(e, e.r);

    /* ---- walk animation ---- */
    e.frameT += dt * (Math.abs(e.vx) + Math.abs(e.vy)) * 0.05;
    if (e.frameT >= 1) { e.frameT = 0; e.frame ^= 1; }

    /* ---- contact damage ---- */
    const touchR = e.r + p.r;
    if (!p.dead && d2 < touchR * touchR && e.touchCd <= 0 && e.spawnT <= 0) {
      e.touchCd = 0.55;
      hurtPlayer(g, e.dmg);
    }
  }

  /* ---- separation: keep the horde from stacking into one pixel ---- */
  separateEnemies(g, dt);
}

/**
 * Push overlapping enemies apart. Runs on a rotating subset each frame
 * (a third of the horde) — the result is visually identical and costs
 * a third as much.
 */
function separateEnemies(g, dt) {
  const A = g.enemies.active;
  const grid = g.grid;
  const slice = g.frameCount % 3;

  for (let i = slice; i < A.length; i += 3) {
    const e = A[i];
    if (e.dead || e.flying || e.isBoss) continue;

    const n = grid.queryInto(e.x, e.y, e.r * 2, _near, 10);
    let px = 0, py = 0, hits = 0;
    for (let j = 0; j < n; j++) {
      const o = _near[j];
      if (o === e || o.dead || o.flying) continue;
      const dx = e.x - o.x, dy = e.y - o.y;
      const rr = e.r + o.r;
      const dd = dx * dx + dy * dy;
      if (dd >= rr * rr || dd < 1e-6) continue;
      const dl = Math.sqrt(dd);
      const push = (rr - dl) / rr;
      px += (dx / dl) * push;
      py += (dy / dl) * push;
      if (++hits >= 5) break;
    }
    if (hits) {
      // x3 compensates for only running every third frame.
      const f = 62 * dt * 3;
      e.x += px * f;
      e.y += py * f;
    }
  }
}

/**
 * What a hostile projectile looks like on this stage.
 *
 * Most stages throw a plain energy bolt. A stage may name an fx sprite
 * instead (Wuhan throws virions). Flavour only — the caller still sets
 * speed, damage, radius and lifetime, so nothing about the fight moves.
 */
function hostileShotArt() {
  const st = World.stage;
  return st && st.shot ? Art.fx(st.shot) : null;
}

/** Ranged enemies lob a slow projectile at the player. */
function enemyShoot(g, e, nx, ny) {
  const sp = e.def.shotSpeed || 130;
  g.spawnShot({
    beh: 'eproj', x: e.x, y: e.y, vx: nx * sp, vy: ny * sp,
    r: 6, dmg: e.def.shotDmg || 15, life: 3.2, hostile: 1,
    color: '#ff8a4a', glow: '#ff4a2a', trail: 1,
    art: hostileShotArt(), artScale: 0.85, spin: 2.4
  });
  Sound.throttled('eshoot', 120, () => Sound.tone(240, 0.1, 'sawtooth', 0.07, 120));
}

/** Boss special moves, each on its own timer. */
function bossAbilities(g, e, dt, nx, ny, d) {
  if (!e.abil) return;
  if (e.post && !e.post.aggro) return;   // dormant garrison boss
  const T = e.abilT;
  const rage = e.hp / e.maxHp < 0.4 ? 0.65 : 1;   // fires faster when hurt

  for (let i = 0; i < e.abil.length; i++) {
    const a = e.abil[i];
    T[a] -= dt;
    if (T[a] > 0) continue;

    switch (a) {
      case 'summon': {
        T[a] = rand(5, 8) * rage;
        const f = e.faction || FACTIONS[0];
        const units = f.units.length ? f.units : ALL_UNIT_DEFS;
        const n = 4 + ((g.minute / 2) | 0);
        const p2 = g.player;
        /* Summons obey the same composition rule as the roaming horde.
           Without this a summoning boss quietly refills the map with
           sprinters and fireball-throwers, straight past the quota. */
        const plain = [];
        for (const u of units) {
          if (u.ai === 'shooter' || u.ai === 'charger' || u.ai === 'swarm') continue;
          plain.push(u);
        }
        const summonPool = plain.length ? plain : units;
        for (let k = 0; k < n; k++) {
          const ang = RNG() * TAU, rr = e.r + 20 + RNG() * 50;
          let sx = e.x + Math.cos(ang) * rr, sy = e.y + Math.sin(ang) * rr;
          // Summons emerge around their boss, but never inside the player —
          // materialising on top of someone is never fair, even mid-fight.
          const dx = sx - p2.x, dy = sy - p2.y;
          const d = Math.hypot(dx, dy);
          // 120, not 100: the separation pass runs after this and can nudge
          // a fresh summon a few units closer before the frame ends.
          if (d < 120) {
            const a2 = d < 1 ? RNG() * TAU : Math.atan2(dy, dx);
            sx = p2.x + Math.cos(a2) * 120;
            sy = p2.y + Math.sin(a2) * 120;
          }
          const se = spawnEnemy(g, pick(summonPool), f, sx, sy, g.hpMul, false);
          if (se) se.summoned = 1;
        }
        FX.ring(e.x, e.y, 8, e.r * 2.4, 0.4, 'rgba(160,90,220,.8)', 3);
        break;
      }
      case 'volley': {
        T[a] = rand(3.2, 5) * rage;
        const n = 10;
        const base = Math.atan2(ny, nx);
        for (let k = 0; k < n; k++) {
          const ang = base + (k / n) * TAU;
          g.spawnShot({
            beh: 'eproj', x: e.x, y: e.y, vx: Math.cos(ang) * 150, vy: Math.sin(ang) * 150,
            r: 7, dmg: e.dmg * 0.4, life: 3.4, hostile: 1, color: '#ffb84a', glow: '#ff5a2a', trail: 1,
            art: hostileShotArt(), artScale: 0.95, spin: 2.8
          });
        }
        Sound.throttled('bvolley', 200, () => Sound.noise(0.2, 0.16, 900, 300));
        break;
      }
      case 'shell': {
        T[a] = rand(2.4, 3.6) * rage;
        const lead = 0.55;
        const tx = g.player.x + g.player.vx * lead, ty = g.player.y + g.player.vy * lead;
        const ang = Math.atan2(ty - e.y, tx - e.x);
        g.spawnShot({
          beh: 'eproj', x: e.x, y: e.y, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210,
          r: 9, dmg: e.dmg * 0.6, life: 3, hostile: 1, splash: 42, color: '#ffd66a', glow: '#ff6a2a', trail: 1,
          art: hostileShotArt(), artScale: 1.15, spin: 3.4
        });
        Sound.throttled('shell', 200, () => { Sound.tone(140, 0.18, 'square', 0.14, 70); Sound.noise(0.16, 0.12, 600, 200); });
        break;
      }
      case 'slam': {
        T[a] = rand(4.5, 7) * rage;
        g.spawnShot({
          beh: 'wave', x: e.x, y: e.y, r: 12, rMax: 150, dmg: e.dmg * 0.7,
          life: 0.7, hostile: 1, color: '#ff6a6a', ring: 1
        });
        FX.boom(e.x, e.y, 26, '#ff8a5a');
        Sound.bigHit(); g.shake(7);
        break;
      }
      case 'charge2': {
        T[a] = rand(6, 9) * rage;
        e.state = 1; e.stateT = 0.45;
        break;
      }
      case 'strafe': {
        T[a] = rand(2.6, 4) * rage;
        for (let k = -1; k <= 1; k++) {
          const ang = Math.atan2(e.cvy || ny, e.cvx || nx) + k * 0.16;
          g.spawnShot({
            beh: 'eproj', x: e.x, y: e.y, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300,
            r: 5, dmg: e.dmg * 0.3, life: 1.8, hostile: 1, color: '#ffe9a8', glow: '#ff8a2a', trail: 1,
            art: hostileShotArt(), artScale: 0.7, spin: 4.2
          });
        }
        Sound.throttled('strafe', 150, () => Sound.noise(0.1, 0.1, 2400, 900, 1.4));
        break;
      }
      case 'bomb': {
        T[a] = rand(3.5, 5.5) * rage;
        g.spawnShot({
          beh: 'drop', x: g.player.x + rand(-40, 40), y: g.player.y + rand(-40, 40),
          r: 54, dmg: e.dmg * 0.8, life: 0.3, hostile: 1, delay: 0.9,
          fallH: 200, boom: '#ff8a4a', color: '#8a8f9a', shakeAmt: 6
        });
        break;
      }
      case 'rings': {
        T[a] = rand(5, 7) * rage;
        for (let k = 0; k < 3; k++) {
          g.spawnShot({
            beh: 'wave', x: e.x, y: e.y, r: 14, rMax: 230, dmg: e.dmg * 0.5,
            life: 1.1, hostile: 1, color: '#f2c14e', ring: 1, delay: k * 0.4
          });
        }
        Sound.bossSpawn();
        break;
      }
    }
  }
}

/* ---- damage ------------------------------------------------- */

/**
 * Apply damage to an enemy. Handles crits, knockback, feedback, and
 * the death cascade (XP, drops, kill counting).
 */
function damageEnemy(g, e, dmg, kx, ky, canCrit) {
  if (e.dead) return;

  let crit = 0;
  if (canCrit !== false) {
    const chanceC = 0.05 * g.player.stats.luck;
    if (RNG() < chanceC) { crit = 1; dmg *= 2.1; }
  }

  e.hp -= dmg;
  e.hitFlash = 0.09;
  g.player.dmgDealt += dmg;

  if (kx || ky) {
    const res = 1 - e.knockRes;
    if (res > 0.01) { e.kx += kx * res; e.ky += ky * res; }
  }

  // Damage numbers are noisy at 500 enemies — show the interesting ones.
  if (crit || e.isBoss || RNG() < 0.3) {
    FX.num(e.x, e.y - e.r, dmg, crit ? '#ffd35e' : '#ffffff', crit || e.isBoss);
  }
  FX.hitSpark(e.x + rand(-3, 3), e.y - e.r * 0.3, e.isBoss ? '#ffd35e' : '#c8ff9a');
  Sound.hit();

  if (e.hp <= 0) killEnemy(g, e);
}

function killEnemy(g, e) {
  if (e.dead) return;
  e.dead = 1;
  g.kills++;

  const big = e.isBoss || e.elite;
  FX.death(e.x, e.y, e.isBoss ? '#f2c14e' : '#9aa88a', big);
  if (e.isBoss) {
    FX.boom(e.x, e.y, e.r * 1.6, '#f2c14e');
    Sound.bossDie();
    g.shake(12);
    g.onBossKilled(e);
  } else {
    Sound.kill();
  }

  /* ---- drops ---- */
  const luck = g.player.stats.luck;
  if (e.isBoss) {
    g.spawnPickup(e.x, e.y, 'chest', 1);
    for (let i = 0; i < 8; i++) {
      const a = RNG() * TAU, d = rand(10, 44);
      g.spawnPickup(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 'gem', e.xp / 8);
    }
  } else {
    g.spawnPickup(e.x, e.y, 'gem', e.xp);
    if (RNG() < 0.012 * luck) g.spawnPickup(e.x, e.y, 'food', 1);
    if (RNG() < 0.006 * luck) g.spawnPickup(e.x, e.y, 'magnet', 1);
    if (RNG() < 0.0025 * luck) g.spawnPickup(e.x, e.y, 'bomb', 1);
    if (RNG() < 0.05 * luck) g.spawnPickup(e.x, e.y, 'coin', randInt(1, 8));
    if (e.elite) g.spawnPickup(e.x, e.y, 'coin', randInt(20, 60));
  }
}

/* ============================================================
   SHOTS
   ============================================================ */

function newShot() {
  return {
    kind: 'shot', uid: 0, beh: 'proj', fire: 0, assist: 0, anchor: null,
    x: 0, y: 0, vx: 0, vy: 0, r: 6,
    dmg: 0, pierce: 0, life: 0, maxLife: 1, knock: 0,
    ang: 0, angVel: 0, orbR: 0, spin: 0, rot: 0,
    len: 0, wid: 0, half: 0, rMax: 0, sp: 0, sweepVel: 0,
    delay: 0, delayMax: 0, fallH: 0,
    hitCd: 0, hits: new Map(),
    art: null, artScale: 1, color: '#fff', glow: null, tint: null,
    follow: 0, faceVel: 0, drag: 0, trail: 0, wake: 0, dust: 0,
    splash: 0, splashDmg: 0, bounces: 0, hostile: 0,
    slow: 0, slowTime: 0, leave: null, boom: null, shakeAmt: 0,
    ring: 0, pulse: 0, zap: 0, zapT: 0, void: 0, glitter: 0, grease: 0,
    cloth: 0, flat: 0, bar: 0, barLen: 0, orderly: 0, dropFood: 0,
    dead: 0, t: 0
  };
}

function resetShot(s) {
  s.dead = 1; s.hits.clear(); s.art = null; s.leave = null; s.anchor = null;
  s.glow = null; s.tint = null; s.boom = null;
}

const SHOT_DEFAULTS = {
  beh: 'proj', x: 0, y: 0, vx: 0, vy: 0, r: 6, dmg: 0, pierce: 0,
  life: 1, knock: 0, ang: 0, angVel: 0, orbR: 0, spin: 0,
  len: 0, wid: 0, half: 0, rMax: 0, sp: 0, delay: 0, fallH: 0, sweepVel: 0,
  hitCd: 0, art: null, artScale: 1, color: '#fff', glow: null, tint: null,
  follow: 0, faceVel: 0, drag: 0, trail: 0, wake: 0, dust: 0,
  splash: 0, splashDmg: 0, bounces: 0, hostile: 0, slow: 0, slowTime: 0,
  leave: null, boom: null, shakeAmt: 0, ring: 0, pulse: 0, zap: 0,
  void: 0, glitter: 0, grease: 0, cloth: 0, flat: 0, bar: 0, barLen: 0,
  orderly: 0, dropFood: 0, fire: 0, assist: 0, anchor: null
};

function configureShot(s, cfg) {
  for (const k in SHOT_DEFAULTS) s[k] = (cfg[k] !== undefined) ? cfg[k] : SHOT_DEFAULTS[k];
  s.uid = ENTITY_UID++;
  s.maxLife = s.life;
  s.delayMax = s.delay || 0.0001;
  s.rot = s.ang;
  s.dead = 0;
  s.t = 0;
  s.zapT = 0;
  s.hits.clear();
  return s;
}

function updateShots(g, dt) {
  const A = g.shots.active;
  const p = g.player;

  for (let i = A.length - 1; i >= 0; i--) {
    const s = A[i];
    if (s.dead) { g.shots.releaseAt(i); continue; }
    s.t += dt;

    /* ---- movement / lifetime by behavior ---- */
    switch (s.beh) {

      case 'proj':
      case 'eproj': {
        if (s.delay > 0) { s.delay -= dt; break; }
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.drag) { const k = Math.exp(-s.drag * dt); s.vx *= k; s.vy *= k; }
        if (s.faceVel) s.rot = Math.atan2(s.vy, s.vx);
        else s.rot += s.spin * dt;
        if (s.trail && RNG() < 0.6) FX.add(s.x, s.y, rand(-8, 8), rand(-8, 8), 0.16, s.glow || s.color, 2, 'dot', 0, 3);
        if (s.wake) FX.dust(s.x - s.vx * 0.03, s.y - s.vy * 0.03, 'rgba(200,220,255,.5)');
        if (s.dust && RNG() < 0.8) FX.dust(s.x - s.vx * 0.04, s.y + s.r * 0.5, 'rgba(190,180,150,.55)');
        s.life -= dt;
        if (s.life <= 0) { if (s.splash) explode(g, s); s.dead = 1; }
        break;
      }

      case 'ricochet': {
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.rot += s.spin * dt;
        if (s.trail && RNG() < 0.7) FX.add(s.x, s.y, 0, 0, 0.2, '#ffffff', 2, 'dot', 0, 4);
        s.life -= dt;
        if (s.life <= 0) s.dead = 1;
        break;
      }

      case 'arc':
      case 'orbit': {
        s.ang += s.angVel * dt;
        // Orbits normally centre on the player, but an assistant's swing
        // centres on the assistant.
        const ax = s.anchor ? s.anchor.x : p.x;
        const ay = s.anchor ? s.anchor.y : p.y;
        s.x = ax + Math.cos(s.ang) * s.orbR;
        s.y = ay + Math.sin(s.ang) * s.orbR;
        s.rot += s.spin * dt;
        if (s.zap) {
          // SDI satellites periodically fire a short beam at whatever's near.
          s.zapT -= dt;
          if (s.zapT <= 0) {
            s.zapT = 0.32;
            const e = nearestEnemy(g, s.x, s.y, 110);
            if (e) {
              damageEnemy(g, e, s.dmg, 0, 0);
              FX.add(s.x, s.y, 0, 0, 0.12, '#7fd4ff', 3, 'dot', 0, 0);
              FX.ring(e.x, e.y, 2, 14, 0.16, 'rgba(127,212,255,.9)', 2);
            }
          }
        }
        s.life -= dt;
        if (s.life <= 0) s.dead = 1;
        break;
      }

      case 'beam':
      case 'cone': {
        if (s.follow) { s.x = p.x; s.y = p.y; }
        // sweepVel turns a fixed lance into a rotating searchlight.
        if (s.sweepVel) s.ang += s.sweepVel * dt;
        s.life -= dt;
        if (s.life <= 0) s.dead = 1;
        break;
      }

      case 'aura': {
        if (s.follow) { s.x = p.x; s.y = p.y; }
        s.life -= dt;
        if (s.life <= 0) s.dead = 1;
        break;
      }

      case 'wave': {
        if (s.delay > 0) { s.delay -= dt; break; }
        if (s.follow) { s.x = p.x; s.y = p.y; }
        // Radius eases outward so the leading edge feels like a shockwave.
        const k = 1 - (s.life / s.maxLife);
        s.r = lerp(12, s.rMax, 1 - (1 - k) * (1 - k));
        s.life -= dt;
        if (s.life <= 0) s.dead = 1;
        break;
      }

      case 'zone':
      case 'trap': {
        s.life -= dt;
        if (s.void && RNG() < 0.5) {
          const a = RNG() * TAU;
          FX.add(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r, -Math.cos(a) * 60, -Math.sin(a) * 60, 0.4, '#a06ad8', 2, 'dot', 0, 0.5);
        }
        if (s.glitter && RNG() < 0.4) FX.glitter(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r), 1);
        if (s.life <= 0) s.dead = 1;
        break;
      }

      case 'drop': {
        if (s.delay > 0) {
          s.delay -= dt;
          if (s.delay <= 0) impactDrop(g, s);
          break;
        }
        s.life -= dt;
        if (s.life <= 0) s.dead = 1;
        break;
      }

      case 'boomerang': {
        // Out for the first half of its life, home back to the player after.
        const half = s.maxLife * 0.42;
        if (s.t < half) {
          s.x += Math.cos(s.ang) * s.sp * dt;
          s.y += Math.sin(s.ang) * s.sp * dt;
        } else {
          const dx = p.x - s.x, dy = p.y - s.y;
          const d = Math.hypot(dx, dy) || 1;
          s.x += (dx / d) * s.sp * 1.25 * dt;
          s.y += (dy / d) * s.sp * 1.25 * dt;
          if (d < 12) s.dead = 1;
        }
        s.rot += s.spin * dt;
        s.life -= dt;
        if (s.life <= 0) s.dead = 1;
        break;
      }
    }

    if (s.dead) continue;

    /* ---- hostile shots test against the player, not the horde ---- */
    if (s.hostile) {
      if (s.beh === 'eproj') {
        const rr = s.r + p.r;
        if (!p.dead && dist2(s.x, s.y, p.x, p.y) < rr * rr) {
          hurtPlayer(g, s.dmg);
          if (s.splash) { FX.boom(s.x, s.y, s.splash * 0.5, '#ff8a4a'); Sound.boom(); }
          s.dead = 1;
        }
      } else if (s.beh === 'wave' || s.beh === 'drop') {
        if (s.delay <= 0 && !p.dead && !s.hits.has(-1)) {
          const rr = s.r + p.r;
          if (dist2(s.x, s.y, p.x, p.y) < rr * rr) {
            s.hits.set(-1, 1e9);
            hurtPlayer(g, s.dmg);
          }
        }
      }
      continue;
    }

    /* ---- friendly shots damage enemies (never while still queued) ---- */
    if (s.delay <= 0) applyShotDamage(g, s, dt);
  }
}

/**
 * Test a shot against nearby enemies and apply damage.
 * Only the cells the shot actually overlaps are examined.
 */
function applyShotDamage(g, s, dt) {
  const reach = (s.beh === 'beam') ? s.len : (s.beh === 'cone' ? s.len : s.r);
  // The cap has to clear the worst case: a 230-radius Hope Surge inside a
  // 700-enemy crush. Truncating there would silently drop hits.
  const n = g.grid.queryInto(s.x, s.y, reach + 24, _near2, 512);
  if (!n) return;

  const now = g.time;

  for (let i = 0; i < n; i++) {
    const e = _near2[i];
    if (e.dead || e.spawnT > 0) continue;

    // Repeat-hit gating: hitCd 0 means "once ever" for this shot.
    const prev = s.hits.get(e.uid);
    if (prev !== undefined && (s.hitCd <= 0 || now < prev)) continue;

    if (!shotHits(s, e)) continue;

    s.hits.set(e.uid, s.hitCd > 0 ? now + s.hitCd : Infinity);

    // Knockback points away from the shot's origin.
    let kx = 0, ky = 0;
    if (s.knock) {
      const dx = e.x - s.x, dy = e.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      kx = (dx / d) * s.knock;
      ky = (dy / d) * s.knock;
    }

    // Track what the assistant actually finishes off. Damage dealt is a bad
    // proxy — it counts overkill, so a president who blankets the field in
    // 10x more damage than needed makes their VP look useless.
    const wasAlive = !e.dead;
    damageEnemy(g, e, s.dmg, kx, ky);
    if (s.assist) {
      g.assistDmg += s.dmg;
      if (wasAlive && e.dead) g.assistKills++;
    }

    if (s.slow) {
      e.slowMul = Math.min(e.slowMul, s.slow);
      e.slowT = Math.max(e.slowT, s.slowTime || 1);
    }
    if (s.beh === 'trap') {
      e.rootT = Math.max(e.rootT, 0.4);
      e.kx = e.ky = 0;
    }
    if (s.orderly && RNG() < 0.3) {
      FX.add(e.x, e.y - e.r, 0, -30, 0.4, '#7fd4ff', 2, 'square', 0, 1);
    }

    // Ricochet: bounce toward another target instead of stopping.
    if (s.beh === 'ricochet') {
      if (s.bounces > 0) {
        s.bounces--;
        const next = nearestRicochetTarget(g, s, e);
        const sp = Math.hypot(s.vx, s.vy) || 300;
        if (next) {
          const a = Math.atan2(next.y - s.y, next.x - s.x);
          s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
        } else {
          const a = Math.atan2(s.vy, s.vx) + rand(2.2, 4.0);
          s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
        }
        FX.ring(e.x, e.y, 2, 16, 0.18, 'rgba(255,255,255,.8)', 2);
        Sound.throttled('ric', 60, () => Sound.tone(1600, 0.05, 'square', 0.07, 900));
      } else {
        s.dead = 1;
      }
      return;
    }

    if (s.splash) { explode(g, s); s.dead = 1; return; }

    if (s.pierce !== 999) {
      s.pierce--;
      if (s.pierce < 0) { s.dead = 1; return; }
    }
  }
}

/** Overlap test, dispatched on shot shape. */
function shotHits(s, e) {
  if (s.beh === 'beam') {
    // Point-to-segment distance from the enemy to the beam's spine.
    const ex = e.x - s.x, ey = e.y - s.y;
    const ca = Math.cos(s.ang), sa = Math.sin(s.ang);
    const proj = ex * ca + ey * sa;
    if (proj < -e.r || proj > s.len + e.r) return false;
    const perp = Math.abs(-ex * sa + ey * ca);
    return perp < s.wid * 0.5 + e.r;
  }

  if (s.beh === 'cone') {
    const dx = e.x - s.x, dy = e.y - s.y;
    const d2 = dx * dx + dy * dy;
    const reach = s.len + e.r;
    if (d2 > reach * reach) return false;
    if (d2 < e.r * e.r) return true;                  // standing on top of you
    const a = Math.atan2(dy, dx);
    return Math.abs(angDelta(s.ang, a)) < s.half;
  }

  if (s.beh === 'wave') {
    // A ring, not a disc: only the expanding edge connects.
    const d = dist(s.x, s.y, e.x, e.y);
    return d < s.r + e.r && d > s.r - 26 - e.r;
  }

  const rr = s.r + e.r;
  return dist2(s.x, s.y, e.x, e.y) < rr * rr;
}

/** Next ricochet target: nearest enemy that isn't the one just hit. */
function nearestRicochetTarget(g, s, skip) {
  const n = g.grid.queryInto(s.x, s.y, 150, _near, 60);
  let best = null, bestD = 150 * 150;
  for (let i = 0; i < n; i++) {
    const e = _near[i];
    if (e === skip || e.dead) continue;
    const d = dist2(s.x, s.y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** Small area burst used by beans, pink slips, and enemy shells. */
function explode(g, s) {
  const r = s.splash;
  FX.boom(s.x, s.y, r * 0.6, s.glow || '#ffb84a');
  Sound.throttled('pop', 60, () => Sound.noise(0.1, 0.12, 800, 250, 0.7));
  const n = g.grid.queryInto(s.x, s.y, r + 20, _near, 120);
  for (let i = 0; i < n; i++) {
    const e = _near[i];
    if (e.dead) continue;
    const rr = r + e.r;
    if (dist2(s.x, s.y, e.x, e.y) < rr * rr) {
      damageEnemy(g, e, s.splashDmg || s.dmg * 0.5, 0, 0);
    }
  }
  // A projectile can leave a lingering field where it detonated, the same
  // way a 'drop' does — that's how You're Fired sets the ground alight.
  if (s.leave) spawnLeave(g, s.leave, s.x, s.y);
}

/** Spawn the lingering field a shot leaves behind on impact. */
function spawnLeave(g, c, x, y) {
  g.spawnShot({
    beh: c.beh, x, y, r: c.r, dmg: c.dmg, pierce: 999,
    life: c.life, hitCd: c.hitCd, slow: c.slow, slowTime: c.slowTime || 1.2,
    color: c.color, glitter: c.glitter, grease: c.grease, cloth: c.cloth, fire: c.fire
  });
}

/** A 'drop' weapon touching down: one big hit, plus whatever it leaves behind. */
function impactDrop(g, s) {
  const boomCol = s.boom || '#ffd66a';
  FX.boom(s.x, s.y, s.r * 0.7, boomCol);
  if (s.glitter || s.boom === '#f2c14e') FX.glitter(s.x, s.y, 22);
  Sound.boom();
  g.shake(s.shakeAmt || 5);

  if (s.leave) spawnLeave(g, s.leave, s.x, s.y);

  // Clinton's burgers occasionally leave something edible behind.
  if (s.dropFood && RNG() < 0.10 * g.player.stats.luck) {
    g.spawnPickup(s.x, s.y, 'food', 1);
  }
}

/* ============================================================
   PICKUPS
   ============================================================ */

function newPickup() {
  return { kind: 'pickup', x: 0, y: 0, vx: 0, vy: 0, type: 'gem', val: 1, tier: 0, t: 0, pull: 0, dead: 0 };
}
function resetPickup(o) { o.dead = 1; o.pull = 0; }

function spawnPickup(g, x, y, type, val) {
  if (g.pickups.count > 900) {
    // Too many on the floor: collapse the oldest into the player's XP.
    const o = g.pickups.active[0];
    if (o && o.type === 'gem') g.addXp(o.val);
    g.pickups.releaseAt(0);
  }
  const o = g.pickups.get();
  o.x = x; o.y = y;
  o.vx = rand(-26, 26); o.vy = rand(-26, 26);
  o.type = type; o.val = val || 1;
  o.t = RNG() * TAU; o.pull = 0; o.dead = 0;
  o.tier = type === 'gem' ? (val >= 200 ? 3 : val >= 40 ? 2 : val >= 8 ? 1 : 0) : 0;
  return o;
}

function updatePickups(g, dt) {
  const A = g.pickups.active;
  const p = g.player;
  const magnet = p.stats.magnet;
  const magnet2 = magnet * magnet;

  for (let i = A.length - 1; i >= 0; i--) {
    const o = A[i];
    if (o.dead) { g.pickups.releaseAt(i); continue; }

    o.t += dt * 3;

    // Initial scatter fades quickly.
    if (o.vx || o.vy) {
      o.x += o.vx * dt; o.y += o.vy * dt;
      const k = Math.exp(-6 * dt);
      o.vx *= k; o.vy *= k;
      if (Math.abs(o.vx) < 1) o.vx = 0;
      if (Math.abs(o.vy) < 1) o.vy = 0;
    }

    const dx = p.x - o.x, dy = p.y - o.y;
    const d2 = dx * dx + dy * dy;

    // Chests and consumables use a fixed, generous grab radius.
    const isGem = o.type === 'gem' || o.type === 'coin';
    const pullR2 = isGem ? magnet2 : 26 * 26;

    if (o.pull || d2 < pullR2) {
      o.pull = 1;
      const d = Math.sqrt(d2) || 1;
      const sp = 130 + (1 - Math.min(1, d / 160)) * 420;
      o.x += (dx / d) * sp * dt;
      o.y += (dy / d) * sp * dt;
    }

    if (d2 < 13 * 13) {
      collectPickup(g, o);
      g.pickups.releaseAt(i);
    }
  }
}

function collectPickup(g, o) {
  const p = g.player;
  switch (o.type) {
    case 'gem':
      g.addXp(o.val);
      Sound.pickup();
      break;
    case 'coin':
      g.gold += Math.round(o.val * p.stats.greed);
      Sound.throttled('coin', 40, () => Sound.tone(1200, 0.05, 'square', 0.05, 1700));
      break;
    case 'food':
      p.hp = Math.min(p.maxHp, p.hp + Math.max(30, p.maxHp * 0.28));
      FX.say(p.x, p.y - 24, '+HEALTH', '#7ee88a', 10);
      Sound.heal();
      break;
    case 'magnet':
      g.magnetAll();
      FX.say(p.x, p.y - 24, 'WHISTLE STOP', '#7fd4ff', 10);
      Sound.levelup();
      break;
    case 'bomb':
      g.nuke();
      FX.say(p.x, p.y - 24, 'EXECUTIVE ORDER', '#f2c14e', 11);
      break;
    case 'chest':
      g.openChest();
      break;
  }
}

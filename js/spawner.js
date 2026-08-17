/* ============================================================
   spawner.js — the stage director for Colonial Williamsburg.

   This is no longer a timeline. There is no "a new army arrives every
   minute". The nine armies are already here, dug into nine buildings,
   and they are not coming to you.

   What the director actually does:
     • deploys all nine strongpoints at stage start (boss + garrison)
     • keeps a roaming horde circulating for you to farm
     • replenishes garrisons you soften but don't finish
     • sends one roaming mini-boss after you every ~80 seconds
     • ramps the roaming horde as strongpoints fall

   Difficulty is driven mostly by STRONGPOINTS CLEARED rather than by
   the clock, so grinding is a real option and rushing is a real risk.
   ============================================================ */

/* Derived from the view rather than hardcoded, so changing the zoom in
   util.js can never reintroduce enemies appearing on screen.

   Computed per call rather than once at load: the view now reshapes to
   the device it's running on (see VIEW_AREA in util.js), so VIEW_R is no
   longer a constant and a value captured at startup would be wrong the
   moment the phone was rotated. */
function spawnMin() { return Math.round(VIEW_R + 35); }
function spawnMax() { return Math.round(VIEW_R + 155); }

/* ------------------------------------------------------------
   STRONGPOINT DIFFICULTY IS PER-TIER, NOT PER-DEFINITION.

   A stage names factions and a boss; it does not hand-tune nine
   health bars. Whatever definition ends up holding tier N is
   normalised to this curve, so any boss can garrison any building on
   any stage and the ladder still reads 6 -> 88.

   Every stage is a SELF-CONTAINED RUN: you start at level 1 with only
   your primary weapon, every time. So stages must NOT ramp steeply in
   absolute difficulty or stage 11 would be unplayable — they differ in
   layout, enemies and era, with only a gentle +10%/stage nudge that
   prestige perks are expected to absorb.
   ------------------------------------------------------------ */
const TIER_BASE_HP = [900, 2400, 5200, 9800, 17500, 30000, 48000, 72000, 300000];
const TIER_BASE_DMG = [26, 31, 36, 40, 42, 46, 52, 58, 90];

/* ------------------------------------------------------------
   ROAMING HORDE — normalised the same way bosses are.

   Bosses were normalised per tier from the start; the roaming horde
   was not, and it showed badly. Williamsburg opened with 12hp drunks
   while Gettysburg opened with 44hp marchers, a third of them
   sprinters and a sixth of them lobbing fireballs, and the Western
   Front opened with 330hp tanks. You start every stage at level 1
   with only your primary, so those openings were 4x and 15x stage 1's.

   Now a faction supplies FLAVOUR — sprite, name, behaviour — and the
   tier supplies the NUMBERS. Every stage's minute zero feels the same.

   Speed is normalised too, and deliberately: an enemy whose pace you
   cannot learn is one you cannot position against.
   ------------------------------------------------------------ */
const ROAM_HP    = [14, 30, 58, 105, 180, 290, 440, 660, 1000];
const ROAM_DMG   = [7, 10, 13, 17, 21, 26, 31, 37, 44];
const ROAM_SPEED = [31, 35, 39, 42, 45, 48, 51, 54, 57];

/* Per-behaviour pace, so each archetype reads consistently across the
   whole campaign instead of varying faction to faction. */
const AI_SPEED = { march: 1, drunk: 0.85, tank: 0.74, shooter: 0.70, charger: 1.12, swarm: 1.26 };

/* HOW MUCH OF THE HORDE MAY BE EACH KIND.
   Sprinters were 24% of spawn weight and fireball-throwers 8% — both
   far too high to read or avoid before you have any upgrades. */
const CAP_CHARGER = 0.08;   // a third of what it was
const CAP_SHOOTER = 0.01;

/* Normalised definitions, built once and reused — allocating a fresh
   def per spawn would put garbage in the hot loop. */
const _normCache = new Map();
function normalizedUnit(u, tier) {
  const key = u.id + ':' + tier;
  let n = _normCache.get(key);
  if (n) return n;
  const t = clamp(tier, 0, 8);
  n = Object.assign({}, u, {
    hp: ROAM_HP[t],
    dmg: ROAM_DMG[t],
    speed: Math.round(ROAM_SPEED[t] * (AI_SPEED[u.ai] || 1)),
    // Worth enough that the first upgrade is ~25 kills away, not 55.
    xp: Math.max(2, Math.round(2 + t * 4.5))
  });
  if (u.shotDmg) n.shotDmg = Math.round(ROAM_DMG[t] * 1.4);
  _normCache.set(key, n);
  return n;
}

/** Which definition holds tier `t` on this stage. */
function stageBossFor(st, tier) {
  /* A stage may name all nine commanders explicitly. Preferred, because
     "held by General Longstreet" is worth far more than "held by a boss
     recycled from tier 3". Stats still come from the tier curve either
     way, so naming them changes nothing about the difficulty ladder. */
  if (st.bosses && st.bosses[tier]) {
    const named = STAGE_BOSSES[st.bosses[tier]];
    if (named) return named;
  }
  if (tier >= 8) return STAGE_BOSSES[st.boss] || FINAL_BOSS;
  const pool = [];
  for (const fid of st.factions) {
    const f = FACTION_BY_ID[fid];
    if (f && f.boss) pool.push(f.boss);
  }
  for (const mid of st.minis) if (MINI_BY_ID[mid]) pool.push(MINI_BY_ID[mid]);
  if (!pool.length) return FACTIONS[0].boss;
  return pool[tier % pool.length];
}

/**
 * Garrison faction for a building.
 *
 * A stage's factions are not equal partners. Cycling them evenly made the
 * Comanche and Apache horse warriors 42% of the Expanding West, when they
 * should be a small number of superb light cavalry — so a faction may
 * declare a `share`, and the pool is expanded to match before cycling.
 */
function stageFactionPool(st) {
  if (st._facPool) return st._facPool;
  const pool = [];
  for (const id of st.factions) {
    const f = FACTION_BY_ID[id];
    if (!f || !f.units || !f.units.length) continue;
    const n = Math.max(1, Math.round((f.share === undefined ? 1 : f.share) * 6));
    for (let i = 0; i < n; i++) pool.push(f);
  }
  st._facPool = pool.length ? pool : [FACTIONS[0]];
  return st._facPool;
}

function stageFactionFor(st, tier) {
  const pool = stageFactionPool(st);
  return pool[tier % pool.length];
}

const Spawner = {
  accum: 0,
  patternT: 0,
  pattern: 'ring',
  miniT: 0,
  mini: null,               // the live roaming mini-boss, if any
  replenishT: 0,
  censusT: 0, nCharger: 0, nShooter: 0, nRoam: 0,

  reset() {
    this.accum = 0;
    this.patternT = 0;
    this.pattern = 'ring';
    this.miniT = 70;
    this.mini = null;
    this.replenishT = 3;
    this.censusT = 0; this.nCharger = 0; this.nShooter = 0; this.nRoam = 0;
  },

  /* ------------------------------------------------------------
     Difficulty curves. `cleared` is the primary input; time is a
     secondary nudge so camping forever still gets uncomfortable.
     ------------------------------------------------------------ */
  hpMul(g) { return 1 + g.cleared * 0.42 + g.minute * 0.05; },
  /**
   * Spawns per second — with an opening ramp.
   *
   * At full rate from second zero the horde outruns your first purchase:
   * the cheapest upgrade is 55 XP, an opening enemy is worth 2, and you
   * are surrounded long before you have 28 kills. The first half-minute
   * now eases in from a third rate, which is the window in which a
   * player actually gets to invest in the stage.
   */
  rate(g) {
    const base = 3.2 + g.cleared * 2.4 + Math.min(g.minute, 20) * 0.40;
    const warmup = Math.min(1, 0.32 + (g.time / 30) * 0.68);
    return base * warmup;
  },
  cap(g) { return Math.min(720, 260 + g.cleared * 48 + g.minute * 8); },
  eliteChance(g) { return Math.min(0.07, 0.006 + g.cleared * 0.008); },

  /* ------------------------------------------------------------
     Stage setup
     ------------------------------------------------------------ */

  /** Garrison every building. Called once, at stage start. */
  deploy(g) {
    for (const b of World.buildings) this.deployStrongpoint(g, b);
  },

  deployStrongpoint(g, b) {
    const st = World.stage;
    const f = stageFactionFor(st, b.tier);
    const src = stageBossFor(st, b.tier);
    const c = World.centre(b);
    const rally = World.rally(b);

    /* Normalise whatever definition landed here onto the tier curve.
       A shallow clone, built once at deploy time — it never touches the
       hot loop and the entity itself still comes from the pool. */
    const stageMul = 1 + st.index * 0.10;
    /* Anything a definition omits is filled here, so a commander can be
       declared with nothing but a name and a portrait. */
    const bossDef = Object.assign({}, src, {
      hp: TIER_BASE_HP[b.tier] * stageMul,
      dmg: TIER_BASE_DMG[b.tier] * stageMul,
      xp: Math.round(300 + b.tier * 1400),
      speed: src.speed || 42,
      r: src.r || 26,
      scale: src.scale || 2.2,
      abilities: src.abilities || ['summon']
    });
    b.bossDef = bossDef;

    // The boss stands in front of its building and does not leave it.
    const bossHp = 1 + b.tier * 0.46;
    const boss = spawnEnemy(g, bossDef, f, rally.x, rally.y, bossHp, false);
    if (boss) {
      boss.anchorX = c.x; boss.anchorY = c.y;
      boss.leash = 250;
      boss.post = b;
      b.bossEnt = boss;
    }
    b.guardHp = 1.7 + b.tier * 0.62;
    b.guardMax = 13 + b.tier * 2;
    this.fillGarrison(g, b, b.guardMax);
  },

  /** Top a garrison back up to `want` troops. */
  fillGarrison(g, b, want) {
    const f = stageFactionFor(World.stage, b.tier);
    if (!f.units.length) return;
    const c = World.centre(b);
    let have = 0;
    const A = g.enemies.active;
    for (let i = 0; i < A.length; i++) if (!A[i].dead && A[i].post === b && !A[i].isBoss) have++;

    for (let i = have; i < want; i++) {
      const a = RNG() * TAU;
      const d = rand(70, 190);
      const spot = World.freeSpot(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 14);
      const gu = weightedUnit(f);
      if (!gu) break;
      const e = spawnEnemy(g, normalizedUnit(gu, b.tier), f, spot.x, spot.y, b.guardHp, false);
      if (!e) break;
      e.anchorX = c.x; e.anchorY = c.y;
      e.leash = 210;
      e.post = b;
      e.dmg *= 1.25;
    }
  },

  /* ------------------------------------------------------------
     Per-frame
     ------------------------------------------------------------ */
  update(g, dt) {
    g.hpMul = this.hpMul(g);
    g.maxEnemies = this.cap(g);

    this.checkStrongpoints(g);

    /* ---- garrisons rebuild if you soften them and walk away ---- */
    this.replenishT -= dt;
    if (this.replenishT <= 0) {
      this.replenishT = 4.5;
      for (const b of World.buildings) {
        if (b.taken) continue;
        const c = World.centre(b);
        // Only rebuild when you're not standing on top of it, so a real
        // assault can actually make progress.
        if (dist2(g.player.x, g.player.y, c.x, c.y) < 430 * 430) continue;
        this.fillGarrison(g, b, b.guardMax);
      }
    }

    /* ---- roaming mini-boss ---- */
    if (this.mini && this.mini.dead) this.mini = null;
    this.miniT -= dt;
    if (this.miniT <= 0 && !this.mini) {
      this.miniT = rand(70, 105);
      this.spawnMini(g);
    }

    /* ---- rotate the roaming spawn pattern ---- */
    this.patternT -= dt;
    if (this.patternT <= 0) {
      this.patternT = rand(14, 24);
      this.pattern = pick(['ring', 'ring', 'arc', 'wall', 'pack']);
    }

    /* ---- the roaming horde ---- */
    let perSec = this.rate(g);
    if (g.bossAlive) perSec *= 0.6;
    this.accum += perSec * dt;
    let n = Math.floor(this.accum);
    this.accum -= n;
    if (n > 50) n = 50;
    for (let i = 0; i < n; i++) this.spawnRoamer(g);
  },

  /**
   * Wake garrisons the player walks into, keep the HUD nameplate pointed
   * at whichever boss is actually engaged, and notice when one falls.
   */
  checkStrongpoints(g) {
    const p = g.player;
    let engaged = null, engagedD = Infinity;

    for (const b of World.buildings) {
      if (b.taken) continue;
      const c = World.centre(b);
      const d2 = dist2(p.x, p.y, c.x, c.y);

      if (!b.aggro && d2 < 330 * 330) {
        b.aggro = true;
        g.announceBoss(b);
      }
      // Let the garrison settle down again once you've backed well off.
      if (b.aggro && d2 > 700 * 700) b.aggro = false;

      if (b.bossEnt && !b.bossEnt.dead && d2 < engagedD && d2 < 620 * 620) {
        engagedD = d2; engaged = b.bossEnt;
      }
    }

    // The mini-boss takes the nameplate if it's closer than any garrison boss.
    if (this.mini && !this.mini.dead) {
      const md = dist2(p.x, p.y, this.mini.x, this.mini.y);
      if (md < engagedD) engaged = this.mini;
    }
    g.bossAlive = engaged;
  },

  /** One roaming enemy, drawn from the armies you've already beaten. */
  spawnRoamer(g) {
    /* COMPOSITION IS DECIDED BEFORE THE UNIT IS.
       Rolling a unit by faction weight and then vetoing it against a
       live census is a feedback loop: it oscillates around the cap and
       overshoots badly between samples. Choosing the CLASS first from a
       fixed quota, then finding a unit of that class, makes the mix
       exact by construction — and needs no census at all. */
    const st = World.stage;
    const tier = Math.min(8, g.cleared);

    const roll = RNG();
    const cls = roll < CAP_SHOOTER ? 'shooter'
              : (roll < CAP_SHOOTER + CAP_CHARGER ? 'runner' : 'plain');

    const pick2 = this.pickByClass(st, cls, tier);
    if (!pick2) return;

    // No valid off-screen point (player jammed in a corner): skip this one
    // rather than dropping an enemy in their lap. The accumulator retries.
    const spot = World.spawnPoint(g.player.x, g.player.y, spawnMin(), spawnMax(), this.spawnAngle(g));
    if (!spot) return;
    const elite = RNG() < this.eliteChance(g);
    spawnEnemy(g, normalizedUnit(pick2.u, tier), pick2.f, spot.x, spot.y, g.hpMul, elite);
  },

  /**
   * Find a unit of the requested behaviour class anywhere on this stage.
   *
   * Searching the whole faction list matters because some factions are
   * made ENTIRELY of runners and shooters — the Korengal holdouts are a
   * charger and a mortar team and nothing else — so a class that exists
   * on the stage may not exist in the faction that was rolled.
   */
  pickByClass(st, cls, tier) {
    const isRunner = (a) => a === 'charger' || a === 'swarm';
    const matches = (u) =>
      cls === 'shooter' ? u.ai === 'shooter'
      : cls === 'runner' ? isRunner(u.ai)
      : (u.ai !== 'shooter' && !isRunner(u.ai));

    // Start from the faction this tier would normally draw, then rotate.
    const pool = stageFactionPool(st);
    const start = (RNG() * pool.length) | 0;
    for (let i = 0; i < pool.length; i++) {
      const f = pool[(start + i) % pool.length];
      if (!f || !f.units.length) continue;
      let total = 0;
      for (const u of f.units) if (matches(u)) total += u.weight || 1;
      if (total <= 0) continue;
      let r = RNG() * total;
      for (const u of f.units) {
        if (!matches(u)) continue;
        r -= u.weight || 1;
        if (r <= 0) return { u, f };
      }
    }

    // That class doesn't exist on this stage — fall back to an ordinary
    // unit rather than forcing a runner in through the back door.
    if (cls !== 'plain') return this.pickByClass(st, 'plain', tier);

    // A stage with no ordinary units at all: take anything.
    for (const f of pool) {
      if (f && f.units.length) return { u: f.units[(RNG() * f.units.length) | 0], f };
    }
    return null;
  },


  /** Which direction this spawn should come from, per the current pattern. */
  spawnAngle(g) {
    const p = g.player;
    let a;
    switch (this.pattern) {
      case 'arc': {
        const face = Math.atan2(p.vy || p.face.y, p.vx || p.face.x);
        a = face + rand(-0.7, 0.7);
        break;
      }
      case 'wall':
        if (this._wallAng === undefined) this._wallAng = RNG() * TAU;
        a = this._wallAng + rand(-0.9, 0.9);
        break;
      case 'pack':
        if (this._packT === undefined || this._packT < g.time) {
          this._packT = g.time + rand(0.7, 1.6);
          this._packA = RNG() * TAU;
        }
        a = this._packA + rand(-0.16, 0.16);
        break;
      default:
        a = RNG() * TAU;
    }
    return a;
  },

  /** Send a roaming mini-boss after the player. */
  spawnMini(g) {
    const st = World.stage;
    const pool = st.minis
      .map(id => MINI_BY_ID[id])
      .filter(m => m && m.tier <= g.cleared + 1 && (!m.rare || RNG() < 0.3));
    if (!pool.length) return;
    const def = pick(pool);

    const p = g.player;
    const spot = World.spawnPoint(p.x, p.y, spawnMin() + 40, spawnMax() + 60, RNG() * TAU);
    if (!spot) { this.miniT = 6; return; }   // try again shortly
    const f = stageFactionFor(st, def.tier);

    const e = spawnEnemy(g, def, f, spot.x, spot.y, 1 + g.cleared * 0.1, false);
    if (!e) return;
    e.mini = 1;
    e.gold = def.gold;
    this.mini = e;

    g.announce(def.name, def.sub);
    FX.ring(e.x, e.y, 10, 150, 0.8, 'rgba(216,50,74,.9)', 4);
    Sound.bossSpawn();
    g.shake(7);
  }
};

/** Pick a unit from a faction, respecting each unit's spawn weight. */
function weightedUnit(f, excludeAi) {
  if (!f || !f.units || !f.units.length) return null;
  let total = 0;
  for (let i = 0; i < f.units.length; i++) {
    const u = f.units[i];
    if (excludeAi && u.ai === excludeAi) continue;
    total += u.weight || 1;
  }
  if (total <= 0) return null;          // faction is entirely that type
  let r = RNG() * total;
  for (let i = 0; i < f.units.length; i++) {
    const u = f.units[i];
    if (excludeAi && u.ai === excludeAi) continue;
    r -= u.weight || 1;
    if (r <= 0) return u;
  }
  for (let i = f.units.length - 1; i >= 0; i--) {
    if (!excludeAi || f.units[i].ai !== excludeAi) return f.units[i];
  }
  return null;
}

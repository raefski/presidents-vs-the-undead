/* ============================================================
   upgrades.js — the passive catalogue and stat recomputation.

   Passives are no longer drawn at random from a pool. Every one of
   them is a line item in the shop (see shop.js), bought deliberately
   with banked XP. Each declares its category, its per-rank effect,
   and a cost curve.

   Effects are declared as per-rank deltas and the whole stat block is
   rebuilt from scratch on every purchase, so re-applying or removing a
   modifier can never leave drift behind.
   ============================================================ */

const PASSIVES = {
  spirit76: {
    id: 'spirit76', name: "Spirit of '76", icon: '🇺🇸', max: 5,
    desc: 'All attacks deal more damage.',
    per: { might: 0.10 }, text: '+10% damage',
    cat: 'power', cost: 120, costMul: 2.42
  },
  execorder: {
    id: 'execorder', name: 'Executive Order', icon: '📜', max: 5,
    desc: 'All weapons come off cooldown faster.',
    per: { cooldown: -0.055 }, text: '-5.5% cooldown',
    cat: 'power', cost: 145, costMul: 2.42
  },
  manifest: {
    id: 'manifest', name: 'Manifest Destiny', icon: '🗺️', max: 5,
    desc: 'Everything you do covers more ground.',
    per: { area: 0.10 }, text: '+10% area',
    cat: 'power', cost: 120, costMul: 2.42
  },
  bully: {
    id: 'bully', name: 'Bully Pulpit', icon: '📣', max: 5,
    desc: 'Projectiles travel faster and hit harder on arrival.',
    per: { projSpeed: 0.13, might: 0.03 }, text: '+13% projectile speed, +3% damage',
    cat: 'power', cost: 90, costMul: 2.42
  },
  filibuster: {
    id: 'filibuster', name: 'Filibuster', icon: '⏳', max: 5,
    desc: 'Attacks last longer. Considerably longer.',
    per: { duration: 0.14 }, text: '+14% duration',
    cat: 'power', cost: 75, costMul: 2.42
  },
  bipartisan: {
    // +1 projectile applies to every weapon at once, so one rank is plenty.
    id: 'bipartisan', name: 'Bipartisanship', icon: '🤝', max: 1,
    desc: 'Reach across the aisle. Fire an extra projectile.',
    per: { amount: 1 }, text: '+1 projectile', rare: 1,
    cat: 'power', cost: 2350, costMul: 2.42
  },
  motorcade: {
    id: 'motorcade', name: 'Motorcade', icon: '🏍️', max: 5,
    desc: 'A full escort. You move noticeably faster.',
    per: { speed: 5.5 }, text: '+5.5 move speed',
    cat: 'body', cost: 95, costMul: 2.42
  },
  secretservice: {
    id: 'secretservice', name: 'Secret Service', icon: '🕴️', max: 5,
    desc: 'Flat damage reduction from every hit taken.',
    per: { armor: 1 }, text: '+1 armor',
    cat: 'body', cost: 105, costMul: 2.42
  },
  constitution: {
    id: 'constitution', name: 'The Constitution', icon: '📃', max: 5,
    desc: 'A durable founding document. Raises maximum health.',
    per: { hp: 24 }, text: '+24 max HP (and heals it)',
    cat: 'body', cost: 75, costMul: 2.42
  },
  newdeal: {
    id: 'newdeal', name: 'The New Deal', icon: '🌾', max: 5,
    desc: 'Continuous recovery, funded by nobody in particular.',
    per: { regen: 0.30 }, text: '+0.30 HP/sec',
    cat: 'body', cost: 85, costMul: 2.42
  },
  campaign: {
    id: 'campaign', name: 'Campaign Trail', icon: '🧲', max: 5,
    desc: 'XP gems come to you. You are very popular.',
    per: { magnet: 16 }, text: '+16 pickup range',
    cat: 'economy', cost: 55, costMul: 2.42
  },
  gerrymander: {
    id: 'gerrymander', name: 'Gerrymander', icon: '🗳️', max: 5,
    desc: 'Redraws the odds. Better drops from everything.',
    per: { luck: 0.14 }, text: '+14% luck',
    cat: 'economy', cost: 95, costMul: 2.42
  },
  stump: {
    id: 'stump', name: 'Stump Speech', icon: '🎙️', max: 5,
    desc: 'Every gem is worth more experience.',
    per: { growth: 0.11 }, text: '+11% XP gained',
    cat: 'economy', cost: 105, costMul: 2.42
  },
  lobby: {
    id: 'lobby', name: 'Soft Money', icon: '💰', max: 5,
    desc: 'Coins are worth substantially more. No further questions.',
    per: { greed: 0.28 }, text: '+28% gold',
    cat: 'economy', cost: 65, costMul: 2.42
  },
  rosegarden: {
    id: 'rosegarden', name: 'Rose Garden Pardon', icon: '🌹', max: 2,
    desc: 'Death is overturned once. You revive at half health.',
    per: { revives: 1 }, text: '+1 revive', rare: 1,
    cat: 'body', cost: 4985, costMul: 2.42
  }
};

const PASSIVE_IDS = Object.keys(PASSIVES);

/* ------------------------------------------------------------
   Stat recomputation
   ------------------------------------------------------------ */

/**
 * Rebuild the player's stat block from their president's base plus
 * every owned passive. Called after any upgrade.
 */
function recomputeStats(p) {
  const base = p.pres.stats;
  const s = p.stats;
  for (const k in base) s[k] = base[k];

  for (const id in p.passives) {
    const def = PASSIVES[id];
    const lvl = p.passives[id];
    if (!def || !lvl) continue;
    for (const k in def.per) s[k] = (s[k] || 0) + def.per[k] * lvl;
  }

  // Guard rails so extreme builds can't break the game.
  s.cooldown = clamp(s.cooldown, 0.32, 3);
  s.speed = clamp(s.speed, 24, 190);
  s.might = Math.max(0.1, s.might);
  s.area = clamp(s.area, 0.35, 4);
  s.duration = clamp(s.duration, 0.35, 4);
  s.projSpeed = clamp(s.projSpeed, 0.35, 4);
  s.magnet = Math.max(16, s.magnet);

  p.maxHp = s.hp;
  if (p.hp > p.maxHp) p.hp = p.maxHp;
}

/* ------------------------------------------------------------
   Weapon instances
   ------------------------------------------------------------ */

/** Runtime state for one equipped weapon. */
function makeWeapon(def) {
  return { def, level: 1, timer: rand(0, 0.35), _s: null };
}

/** "GEORGE WASHINGTON" -> "Washington". */
function shortName(full) {
  const parts = full.split(' ');
  const last = parts[parts.length - 1];
  return last.charAt(0) + last.slice(1).toLowerCase();
}

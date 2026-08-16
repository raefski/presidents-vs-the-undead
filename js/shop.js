/* ============================================================
   shop.js — the upgrade store, replacing random level-up cards.

   XP is a currency now, not a level track. It banks up, and you spend
   it deliberately on whatever you want. Gold is a second currency used
   only to hire your assistant.

   ARSENAL is deliberately gated so each president plays like themselves:

     PRIMARY    available from the start, ranks 1..8
     SECONDARY  locked until PRIMARY is at max rank
     FUSION     locked until BOTH are at max rank

   Nobody can buy another president's weapons. Washington's axe is
   Washington's axe.
   ============================================================ */

const SHOP_CATS = [
  { id: 'arsenal', name: 'ARSENAL', icon: '⚔️', blurb: 'Your two signature attacks, and what they become together.' },
  { id: 'power',   name: 'FIREPOWER', icon: '💥', blurb: 'Damage, reach, and rate of fire across everything you own.' },
  { id: 'body',    name: 'THE PRESIDENT', icon: '🏃', blurb: 'Speed, health, and staying upright.' },
  { id: 'economy', name: 'ECONOMY', icon: '💰', blurb: 'Make every gem and coin on the ground worth more.' },
  { id: 'staff',   name: 'STAFF', icon: '🤝', blurb: 'Hired with gold. Fights alongside you, badly but sincerely.' },
  { id: 'prestige', name: 'PRESTIGE', icon: '🏛️', blurb: 'Bought with prestige points earned by clearing stages. Permanent, and carried between runs.' }
];

/**
 * Geometric cost curve: `rank` is how many are already owned.
 * Bases are low and multipliers steep on purpose — rank 1 of anything
 * has to be reachable in the first minute, or the opening is a
 * powerless slog, while a finished build still has to cost a whole run.
 */
function costOf(base, mul, rank) {
  return Math.round(base * Math.pow(mul, rank) / 5) * 5;
}

const WEAPON_COST = { base: 130, mul: 2.02 };
const FUSION_COST = { base: 1900, mul: 2.10 };
const UNLOCK_SECONDARY = 5600;
const UNLOCK_FUSION = 29000;

const Shop = {

  /* ------------------------------------------------------------
     Build the full catalogue with live state attached.
     ------------------------------------------------------------ */
  list(g) {
    const p = g.player;
    const out = [];
    const pres = p.pres;

    const prim = p.weapons.find(w => w.def.id === pres.weapon);
    const sec = p.weapons.find(w => w.def.id === pres.weapon2);
    const fus = p.weapons.find(w => w.def.id === pres.fusion);

    /* EXECUTIVE PRIVILEGE lowers the rank the previous weapon must reach.
       The unlock COSTS are untouched, so the XP curve is unchanged — only
       the moment the decision becomes available moves. */
    const gate = Prestige.gateRank();
    const primMaxed = prim && prim.level >= Math.min(gate, prim.def.maxLevel);
    const secMaxed = sec && sec.level >= Math.min(gate, sec.def.maxLevel);

    /* ---------- ARSENAL ---------- */

    // Primary — always available.
    if (prim) {
      const maxed = prim.level >= prim.def.maxLevel;
      const nxt = prim.def.levels[prim.level + 1];
      out.push({
        id: 'w:' + prim.def.id, cat: 'arsenal', kind: 'weapon',
        name: prim.def.name, icon: prim.def.icon, tag: 'PRIMARY',
        rank: prim.level, max: prim.def.maxLevel,
        desc: maxed ? 'Fully upgraded. This unlocks your secondary.' : (nxt ? nxt.t : ''),
        cost: maxed ? 0 : costOf(WEAPON_COST.base, WEAPON_COST.mul, prim.level - 1),
        currency: 'xp', maxed
      });
    }

    // Secondary — gated behind a maxed primary.
    if (!sec) {
      out.push({
        id: 'unlock:secondary', cat: 'arsenal', kind: 'unlock',
        name: WEAPONS[pres.weapon2].name, icon: WEAPONS[pres.weapon2].icon, tag: 'SECONDARY',
        rank: 0, max: 1, desc: WEAPONS[pres.weapon2].desc,
        cost: UNLOCK_SECONDARY, currency: 'xp',
        locked: !primMaxed,
        lockText: 'Requires ' + WEAPONS[pres.weapon].name + ' at rank ' + gate
      });
    } else {
      const maxed = sec.level >= sec.def.maxLevel;
      const nxt = sec.def.levels[sec.level + 1];
      out.push({
        id: 'w:' + sec.def.id, cat: 'arsenal', kind: 'weapon',
        name: sec.def.name, icon: sec.def.icon, tag: 'SECONDARY',
        rank: sec.level, max: sec.def.maxLevel,
        desc: maxed ? 'Fully upgraded. Both at max unlocks your fusion.' : (nxt ? nxt.t : ''),
        cost: maxed ? 0 : costOf(WEAPON_COST.base, WEAPON_COST.mul, sec.level - 1),
        currency: 'xp', maxed
      });
    }

    // Fusion — gated behind both.
    const fdef = WEAPONS[pres.fusion];
    if (!fus) {
      out.push({
        id: 'unlock:fusion', cat: 'arsenal', kind: 'unlock',
        name: fdef.name, icon: fdef.icon, tag: 'FUSION',
        rank: 0, max: 1, desc: fdef.desc,
        cost: UNLOCK_FUSION, currency: 'xp',
        locked: !(primMaxed && secMaxed),
        lockText: 'Requires BOTH weapons at rank ' + gate,
        highlight: 1
      });
    } else {
      const maxed = fus.level >= fus.def.maxLevel;
      const nxt = fus.def.levels[fus.level + 1];
      out.push({
        id: 'w:' + fus.def.id, cat: 'arsenal', kind: 'weapon',
        name: fus.def.name, icon: fus.def.icon, tag: 'FUSION',
        rank: fus.level, max: fus.def.maxLevel,
        desc: maxed ? 'There is nothing further. There is nothing left.' : (nxt ? nxt.t : ''),
        cost: maxed ? 0 : costOf(FUSION_COST.base, FUSION_COST.mul, fus.level - 1),
        currency: 'xp', maxed, highlight: 1
      });
    }

    /* ---------- PASSIVES ---------- */
    for (const id of PASSIVE_IDS) {
      const d = PASSIVES[id];
      const rank = p.passives[id] || 0;
      const maxed = rank >= d.max;
      out.push({
        id: 'p:' + id, cat: d.cat, kind: 'passive',
        name: d.name, icon: d.icon,
        rank, max: d.max,
        desc: maxed ? 'Fully invested.' : d.desc + '  (' + d.text + ')',
        cost: maxed ? 0 : costOf(d.cost, d.costMul, rank),
        currency: 'xp', maxed
      });
    }

    /* ---------- STAFF ---------- */
    const a = ASSISTANTS[pres.id];
    if (a) {
      if (!p.assistant) {
        out.push({
          id: 'hire', cat: 'staff', kind: 'hire',
          name: a.name, icon: '🤝', tag: a.title,
          rank: 0, max: 1, desc: a.blurb,
          cost: a.cost, currency: 'gold', highlight: 1
        });
      } else {
        const rank = p.assistantRank || 1;
        const maxed = rank >= 5;
        out.push({
          id: 'staffup', cat: 'staff', kind: 'staffup',
          name: a.name, icon: '🤝', tag: a.title,
          rank, max: 5,
          desc: maxed ? 'Cannot be promoted further. There is no further.'
                      : 'Promote. +35% damage and a faster attack.',
          cost: maxed ? 0 : Math.round(a.cost * 0.7 * Math.pow(1.55, rank - 1) / 5) * 5,
          currency: 'gold', maxed
        });
      }
    }

    /* ---------- PRESTIGE ----------
       A separate currency by design: it can never shift the XP cost
       curve because it never touches XP. Every perk here changes a rule
       rather than a stat, so the in-stage power ramp is identical. */
    for (const id of PRESTIGE_IDS) {
      const u = PRESTIGE_UPGRADES[id];
      const r = Prestige.rank(id);
      const maxed = r >= u.max;
      out.push({
        id: 'pr:' + id, cat: 'prestige', kind: 'prestige',
        name: u.name, icon: u.icon, tag: 'PERMANENT',
        rank: r, max: u.max,
        desc: maxed ? u.blurb + ' Fully invested.' : u.text(r),
        cost: maxed ? 0 : u.cost(r),
        currency: 'prestige', maxed, highlight: 1
      });
    }

    // Attach affordability for the UI.
    for (const e of out) {
      const bank = e.currency === 'gold' ? g.gold
        : (e.currency === 'prestige' ? Prestige.available() : g.xp);
      e.afford = !e.maxed && !e.locked && bank >= e.cost;
    }
    return out;
  },

  /** Cheapest thing the player could buy right now, or null. */
  cheapestAffordable(g) {
    let best = null;
    for (const e of this.list(g)) {
      if (!e.afford) continue;
      if (!best || e.cost < best.cost) best = e;
    }
    return best;
  },

  /** True if anything at all is purchasable — drives the button pulse. */
  anyAffordable(g) { return !!this.cheapestAffordable(g); },

  /* ------------------------------------------------------------
     Purchase
     ------------------------------------------------------------ */
  buy(g, id) {
    const p = g.player;
    const entry = this.list(g).find(e => e.id === id);
    if (!entry || entry.maxed || entry.locked || !entry.afford) return false;

    if (entry.kind === 'prestige') {
      if (!Prestige.buy(entry.id.slice(3))) return false;
      // Chief of Staff can take effect mid-run.
      Prestige.applyRunStart(g);
      Sound.uiBig();
      return true;
    }

    if (entry.currency === 'gold') g.gold -= entry.cost;
    else g.xp -= entry.cost;

    if (entry.kind === 'weapon') {
      const wid = id.slice(2);
      const w = p.weapons.find(x => x.def.id === wid);
      if (w) w.level = Math.min(w.def.maxLevel, w.level + 1);

    } else if (entry.kind === 'unlock') {
      const wid = id === 'unlock:secondary' ? p.pres.weapon2 : p.pres.fusion;
      if (!p.weapons.some(x => x.def.id === wid)) {
        p.weapons.push(makeWeapon(WEAPONS[wid]));
        FX.say(p.x, p.y - 40, WEAPONS[wid].name, '#f2c14e', 13);
      }

    } else if (entry.kind === 'passive') {
      const pid = id.slice(2);
      const before = p.stats.hp;
      p.passives[pid] = (p.passives[pid] || 0) + 1;
      recomputeStats(p);
      const gained = p.stats.hp - before;
      if (gained > 0) p.hp = Math.min(p.maxHp, p.hp + gained);

    } else if (entry.kind === 'hire') {
      hireAssistant(g);

    } else if (entry.kind === 'staffup') {
      p.assistantRank = (p.assistantRank || 1) + 1;
    }

    p.purchases = (p.purchases || 0) + 1;
    recomputeStats(p);
    Sound.uiBig();
    return true;
  }
};

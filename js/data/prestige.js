/* ============================================================
   prestige.js — meta-progression across the campaign.

   WHY IT CANNOT BREAK THE EARLY GAME
     The XP shop is a geometric curve tuned so rank 1 of anything is
     reachable in the first minute and a full build costs most of a run.
     Any prestige perk that granted flat stats — "+10% damage forever" —
     would shift that curve's starting point and unravel the tuning.

     So prestige is deliberately built two ways round:

       1. It has its OWN CURRENCY. Prestige points are earned per stage
          cleared and spent only here. They never touch XP or gold, so
          the shop's cost curve is arithmetically untouched.

       2. Every perk changes a RULE, not a NUMBER. Who you start with,
          what carries between stages, when a gate opens. None of them
          add damage, health or speed, so the power curve inside a
          single stage is exactly what it was.

     The result is that a fully-prestiged player has more options and a
     softer landing, but the same moment-to-moment difficulty ramp.

   AWARD
     Clearing a stage pays 3 points, +1 per stage index (so stage 1
     pays 3 and stage 11 pays 13), and a 5-point first-clear bonus.
     A full campaign is therefore ~143 points against ~86 to buy
     everything, which leaves headroom without trivialising it.
   ============================================================ */

const PRESTIGE_KEY = 'pvu.prestige.v1';

const PRESTIGE_UPGRADES = {

  /* -------------------------------------------------------- */
  chiefofstaff: {
    id: 'chiefofstaff', name: 'CHIEF OF STAFF', icon: '🤝', max: 3,
    blurb: 'Your assistant is already on the payroll when the stage starts.',
    /* Rank 1: hired at rank 1.  Rank 2: hired at rank 2.  Rank 3: rank 3. */
    text: (r) => r === 0
      ? 'Begin each stage with your assistant already hired.'
      : 'Assistant starts at rank ' + (r + 1) + ' instead of ' + r + '.',
    cost: (r) => [6, 10, 16][r],
    /* Pure rule change: it removes a gold purchase from the opening,
       and touches no stat and no cost curve. */
    apply: (g, rank) => {
      if (rank < 1 || g.player.assistant) return;
      hireAssistant(g);
      g.player.assistantRank = rank;
    }
  },

  /* -------------------------------------------------------- */
  continuity: {
    id: 'continuity', name: 'CONTINUITY OF GOVERNMENT', icon: '🏛️', max: 4,
    blurb: 'An orderly transition. Unspent resources survive the handover.',
    text: (r) => 'Carry ' + [15, 30, 45, 60][r] + '% of unspent XP and gold into the next stage.',
    cost: (r) => [4, 8, 14, 22][r],
    /* Changes what persists BETWEEN stages. Inside a stage the economy
       is identical, so no cost curve moves — you simply start a later
       stage having banked some of the previous one's tail. */
    carryFraction: (rank) => rank ? [0.15, 0.30, 0.45, 0.60][rank - 1] : 0
  },

  /* -------------------------------------------------------- */
  execprivilege: {
    id: 'execprivilege', name: 'EXECUTIVE PRIVILEGE', icon: '📜', max: 3,
    blurb: 'The arsenal gates open earlier. The weapons themselves are unchanged.',
    text: (r) => {
      const need = [8, 6, 4, 2][r];
      return 'Secondary and fusion unlock at rank ' + need + ' of the weapon before, instead of ' + [8, 8, 6, 4][r] + '.';
    },
    cost: (r) => [8, 16, 28][r],
    /* Changes the UNLOCK CONDITION only. Both unlocks still cost their
       full 5,600 and 29,000 XP, so the curve is untouched — you just
       reach the decision sooner and can spread a build differently. */
    gateRank: (rank) => [8, 6, 4, 2][rank] || 8
  }
};

const PRESTIGE_IDS = Object.keys(PRESTIGE_UPGRADES);

/* ============================================================
   SAVE STATE
   ============================================================ */
const Prestige = {
  points: 0,
  spent: 0,
  ranks: {},          // upgradeId -> rank
  cleared: {},        // stageId -> true
  found: {},          // presidentId -> true, for hidden roster unlocks
  best: {},           // stageId -> fastest clear seconds

  load() {
    let d = null;
    try {
      const raw = window.localStorage && window.localStorage.getItem(PRESTIGE_KEY);
      d = raw ? JSON.parse(raw) : null;
    } catch (e) { d = null; }
    d = d || {};
    this.points = d.points || 0;
    this.spent = d.spent || 0;
    this.ranks = d.ranks || {};
    this.cleared = d.cleared || {};
    this.found = d.found || {};
    this.best = d.best || {};
  },

  save() {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(PRESTIGE_KEY, JSON.stringify({
        points: this.points, spent: this.spent,
        ranks: this.ranks, cleared: this.cleared, best: this.best,
        found: this.found
      }));
    } catch (e) { /* private browsing — meta progress just won't persist */ }
  },

  rank(id) { return this.ranks[id] || 0; },
  available() { return this.points - this.spent; },

  canBuy(id) {
    const u = PRESTIGE_UPGRADES[id];
    if (!u) return false;
    const r = this.rank(id);
    return r < u.max && this.available() >= u.cost(r);
  },

  buy(id) {
    if (!this.canBuy(id)) return false;
    const u = PRESTIGE_UPGRADES[id];
    this.spent += u.cost(this.rank(id));
    this.ranks[id] = this.rank(id) + 1;
    this.save();
    return true;
  },

  /** Called when a stage is cleared. Returns the points awarded. */
  award(stage, seconds) {
    const first = !this.cleared[stage.id];
    const pts = 3 + stage.index + (first ? 5 : 0);
    this.points += pts;
    this.cleared[stage.id] = true;
    if (!this.best[stage.id] || seconds < this.best[stage.id]) this.best[stage.id] = seconds;
    this.save();
    return { pts, first };
  },

  /** Record a hidden character as found. Survives runs; it is meta. */
  find(id) {
    if (this.found[id]) return false;
    this.found[id] = true;
    this.save();
    return true;
  },

  /** A stage is playable once the one before it has been cleared. */
  unlocked(stage) {
    if (stage.index === 0) return true;
    return !!this.cleared[STAGES[stage.index - 1].id];
  },

  /** How far the campaign has got. */
  progress() {
    let n = 0;
    for (const s of STAGES) if (this.cleared[s.id]) n++;
    return n;
  },

  /** Wipe everything. Used by the dev menu. */
  reset() {
    this.points = 0; this.spent = 0;
    this.ranks = {}; this.cleared = {}; this.best = {};
    this.save();
  },

  /* --------------------------------------------------------
     Hooks the rest of the game asks
     -------------------------------------------------------- */

  /** Rank a weapon must reach before the next one unlocks. */
  gateRank() { return PRESTIGE_UPGRADES.execprivilege.gateRank(this.rank('execprivilege')); },

  /** Fraction of unspent XP/gold carried into the next stage. */
  carry() { return PRESTIGE_UPGRADES.continuity.carryFraction(this.rank('continuity')); },

  /** Applied once, at the start of a run. */
  applyRunStart(g) {
    const r = this.rank('chiefofstaff');
    if (r > 0) PRESTIGE_UPGRADES.chiefofstaff.apply(g, r);
  }
};

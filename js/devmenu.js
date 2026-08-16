/* ============================================================
   devmenu.js — the balance workbench.

   Opens over the game (F1, backtick, or the DEV BALANCE button) and
   lets you edit every president's attributes live, with the attribute
   point cost of each change shown as you make it.

   PERSISTENCE, IN TWO LAYERS
     Edits go straight into browser localStorage, so they survive a
     refresh and are never lost to an accidental reload. That is a
     WORKING copy — it is not in the repository and nobody else sees it.

     EXPORT TO CODE prints a ready-to-paste block for
     js/data/balance-overrides.js. Pasting it there is what makes a
     change permanent, version-controlled, and safe from any future
     gameplay iteration.
   ============================================================ */

const DEV_KEY = 'pvu.balance.v1';

/* Which stats are editable, and how the editor should step them. */
const DEV_STATS = [
  { k: 'hp',        label: 'Health',          step: 5,    min: 30,  max: 500, dec: 0 },
  { k: 'speed',     label: 'Move Speed',      step: 1,    min: 20,  max: 150, dec: 0 },
  { k: 'might',     label: 'Damage ×',        step: 0.05, min: 0.2, max: 3,   dec: 2 },
  { k: 'area',      label: 'Area / Reach ×',  step: 0.05, min: 0.3, max: 3,   dec: 2 },
  { k: 'cooldown',  label: 'Cooldown ×',      step: 0.05, min: 0.3, max: 2,   dec: 2, lowerBetter: 1 },
  { k: 'duration',  label: 'Duration ×',      step: 0.05, min: 0.3, max: 3,   dec: 2 },
  { k: 'projSpeed', label: 'Projectile Spd ×', step: 0.05, min: 0.3, max: 3,  dec: 2 },
  { k: 'amount',    label: 'Extra Projectiles', step: 1,  min: 0,   max: 5,   dec: 0 },
  { k: 'armor',     label: 'Armor',           step: 1,    min: 0,   max: 15,  dec: 0 },
  { k: 'regen',     label: 'HP Regen /s',     step: 0.05, min: 0,   max: 5,   dec: 2 },
  { k: 'magnet',    label: 'Pickup Radius',   step: 2,    min: 16,  max: 200, dec: 0 },
  { k: 'luck',      label: 'Luck ×',          step: 0.05, min: 0.3, max: 3,   dec: 2 },
  { k: 'growth',    label: 'XP Gain ×',       step: 0.05, min: 0.3, max: 3,   dec: 2 },
  { k: 'greed',     label: 'Gold Gain ×',     step: 0.05, min: 0.3, max: 4,   dec: 2 },
  { k: 'revives',   label: 'Free Revives',    step: 1,    min: 0,   max: 5,   dec: 0 }
];

const Dev = {
  open: false,
  sel: null,
  showingExport: false,

  /* ------------------------------------------------------------
     Persistence
     ------------------------------------------------------------ */
  load() {
    try {
      const raw = window.localStorage && window.localStorage.getItem(DEV_KEY);
      LIVE_TWEAKS = raw ? JSON.parse(raw) : {};
    } catch (e) { LIVE_TWEAKS = {}; }
    rebuildPresidentStats();
  },

  save() {
    try {
      if (window.localStorage) window.localStorage.setItem(DEV_KEY, JSON.stringify(LIVE_TWEAKS));
    } catch (e) { /* private browsing, quota — tweaks just won't persist */ }
  },

  /** Apply a change and push it everywhere that cares, immediately. */
  set(id, key, value) {
    if (!LIVE_TWEAKS[id]) LIVE_TWEAKS[id] = {};
    const meta = DEV_STATS.find(d => d.k === key);
    if (meta) value = clamp(value, meta.min, meta.max);
    LIVE_TWEAKS[id][key] = value;
    this.save();
    rebuildPresidentStats();
    // A run in progress should reflect the change without a restart.
    if (Game.player) recomputeStats(Game.player);
    this.render();
  },

  resetPresident(id) {
    delete LIVE_TWEAKS[id];
    this.save();
    rebuildPresidentStats();
    if (Game.player) recomputeStats(Game.player);
    this.render();
  },

  resetAll() {
    LIVE_TWEAKS = {};
    this.save();
    rebuildPresidentStats();
    if (Game.player) recomputeStats(Game.player);
    this.render();
  },

  /* ------------------------------------------------------------
     Export
     ------------------------------------------------------------ */

  /**
   * Build a paste-ready BALANCE_OVERRIDES block containing every stat
   * that differs from the authored default — both what's already
   * committed and whatever you've changed live.
   */
  exportCode() {
    const lines = [];
    for (const p of PRESIDENTS) {
      /* Compare against the baseline INCLUDING automatic melee
         compensation. Comparing against the raw authored values would
         export that compensation as though it were a manual override —
         and pasting it in would freeze it, so a later weapon change
         could no longer adjust it. Only real edits should export. */
      const authored = Object.assign({}, BASE_STATS, p.base);
      const mc = meleeCompensation(p);
      if (mc) {
        authored.armor = (authored.armor || 0) + mc.armor;
        authored.hp = (authored.hp || 0) + mc.hp;
      }
      const diffs = [];
      for (const d of DEV_STATS) {
        const now = p.stats[d.k];
        if (now === undefined) continue;
        if (Math.abs(now - authored[d.k]) < 1e-9) continue;
        diffs.push(d.k + ': ' + (d.dec ? +now.toFixed(d.dec) : Math.round(now)));
      }
      if (diffs.length) {
        lines.push('  ' + p.id + ': { ' + diffs.join(', ') + ' },' +
          '   // ' + p.points.toFixed(1) + ' pts');
      }
    }
    const body = lines.length ? lines.join('\n') : '  // (no overrides — every president is on its authored defaults)';
    return 'const BALANCE_OVERRIDES = {\n' + body + '\n};';
  },

  /* ------------------------------------------------------------
     Rendering
     ------------------------------------------------------------ */
  toggle() { this.open ? this.close() : this.openMenu(); },

  openMenu() {
    this.open = true;
    if (!this.sel) this.sel = PRESIDENTS[0].id;
    this._prevState = Game.state;
    Game.state = 'dev';
    this.render();
    UI.show('dev');
  },

  close() {
    this.open = false;
    this.showingExport = false;
    const back = this._prevState || 'title';
    Game.state = (back === 'dev') ? 'title' : back;
    if (Game.state === 'playing') { UI.hideOverlay(); Game._last = performance.now(); }
    else if (Game.state === 'title') UI.show('title');
    else if (Game.state === 'select') UI.show('select');
    else if (Game.state === 'paused') UI.showPause(Game);
    else UI.hideOverlay();
  },

  render() {
    if (!this.open) return;
    const pts = PRESIDENTS.map(p => p.points);
    const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
    const lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts);

    $('#dev-summary').innerHTML =
      'roster average <b>' + avg.toFixed(1) + '</b> pts &nbsp;·&nbsp; ' +
      'spread <b>' + lo.toFixed(1) + '</b> to <b>' + hi.toFixed(1) + '</b> &nbsp;·&nbsp; ' +
      'gap <b>' + (hi - lo).toFixed(1) + '</b>';

    /* ---- roster, sorted by cost so outliers are obvious ---- */
    const roster = $('#dev-roster');
    roster.innerHTML = '';
    const sorted = PRESIDENTS.slice().sort((a, b) => b.points - a.points);
    for (const p of sorted) {
      const row = el('div', 'devrow' + (p.id === this.sel ? ' on' : ''));
      const rel = p.points - avg;
      const col = rel > 2.5 ? '#ff8a3a' : (rel < -2.5 ? '#7fd4ff' : '#5ec26a');
      const w = clamp(Math.abs(p.points) / Math.max(1, hi) * 100, 2, 100);
      row.innerHTML =
        '<span class="dn">' + shortName(p.name) + '</span>' +
        '<span class="dbarwrap"><span class="dbar" style="width:' + w + '%;background:' + col + '"></span></span>' +
        '<span class="dp" style="color:' + col + '">' + p.points.toFixed(1) + '</span>' +
        (Object.keys(LIVE_TWEAKS[p.id] || {}).length ? '<span class="dmod">●</span>' : '<span class="dmod"></span>');
      row.addEventListener('click', () => { this.sel = p.id; this.render(); });
      roster.appendChild(row);
    }

    /* ---- the selected president's editor ---- */
    const p = PRES_BY_ID[this.sel];
    const panel = $('#dev-panel');
    panel.innerHTML = '';

    const head = el('div', 'devhead');
    head.innerHTML = '<h3>' + p.name + '</h3>' +
      '<div class="dsub">' + p.term + '</div>' +
      '<div class="dtot">TOTAL <b>' + p.points.toFixed(1) + '</b> pts' +
      (Object.keys(LIVE_TWEAKS[p.id] || {}).length ? ' <span class="dmodtag">MODIFIED</span>' : '') + '</div>';
    // Points measure STATS, not RISK. A melee president carries more stat
    // because they have to stand in the crowd to deal any damage at all —
    // reading them as "overbudget" against a beam president is the one
    // way this number misleads, so it says so.
    if (p.melee) {
      const mc = meleeCompensation(p);
      head.innerHTML += '<div class="dmelee">MELEE — primary reach ' +
        Math.round(weaponReach(WEAPONS[p.weapon])) + 'u. Auto-compensated +' +
        mc.armor + ' armor, +' + mc.hp + ' HP for having to fight inside the crowd. ' +
        'That stat is paid for positionally and is not free budget.</div>';
    }
    panel.appendChild(head);

    // Attack types, so you can see what kind of kit you're balancing.
    const kit = el('div', 'devkit');
    const rows = [['PRIMARY', WEAPONS[p.weapon]], ['SECONDARY', WEAPONS[p.weapon2]], ['FUSION', WEAPONS[p.fusion]]];
    for (const [tag, w] of rows) {
      kit.appendChild(el('div', 'devweap',
        '<span class="wi">' + w.icon + '</span>' +
        '<span class="wt">' + tag + '</span>' +
        '<b>' + w.name + '</b>' +
        '<span class="wtype">' + weaponType(w) + '</span>'));
    }
    const a = ASSISTANTS[p.id];
    if (a) {
      kit.appendChild(el('div', 'devweap',
        '<span class="wi">🤝</span><span class="wt">STAFF</span><b>' + a.name + '</b>' +
        '<span class="wtype">' + a.atk.toUpperCase() + ' · ' + a.damage + ' dmg / ' + a.interval + 's · ' + a.range + 'u</span>'));
    }
    panel.appendChild(kit);

    /* ---- stat rows ---- */
    const authored = Object.assign({}, BASE_STATS, p.base);
    for (const d of DEV_STATS) {
      const v = p.stats[d.k];
      const pts = statPoints(d.k, v);
      const base = BASE_STATS[d.k];
      const changed = Math.abs(v - authored[d.k]) > 1e-9;

      const row = el('div', 'devstat' + (changed ? ' changed' : ''));
      row.appendChild(el('span', 'sl', d.label));

      const dec = el('button', 'sb', '−');
      const inp = document.createElement('input');
      inp.type = 'number'; inp.className = 'si';
      inp.value = d.dec ? v.toFixed(d.dec) : Math.round(v);
      inp.step = d.step; inp.min = d.min; inp.max = d.max;
      const inc = el('button', 'sb', '+');

      dec.addEventListener('click', () => this.set(p.id, d.k, +(v - d.step).toFixed(4)));
      inc.addEventListener('click', () => this.set(p.id, d.k, +(v + d.step).toFixed(4)));
      inp.addEventListener('change', () => {
        const n = parseFloat(inp.value);
        if (!isNaN(n)) this.set(p.id, d.k, n);
      });

      row.appendChild(dec); row.appendChild(inp); row.appendChild(inc);
      row.appendChild(el('span', 'sbase', 'base ' + (d.dec ? base.toFixed(d.dec) : base)));

      const pc = pts >= 0 ? 'pos' : 'neg';
      row.appendChild(el('span', 'spts ' + pc,
        (pts >= 0 ? '+' : '') + pts.toFixed(1) + ' pts'));
      panel.appendChild(row);
    }

    $('#dev-export').classList.toggle('hidden', !this.showingExport);
    if (this.showingExport) $('#dev-export-text').value = this.exportCode();
  }
};

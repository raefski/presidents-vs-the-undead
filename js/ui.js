/* ============================================================
   ui.js — everything outside the canvas.

   The game world is drawn to a fixed VW x VH canvas that gets scaled
   up to fit the window. The HUD, menus and the War Room are real DOM
   positioned on top of that canvas box, so text stays crisp at any
   zoom and we get hover states, scrolling and layout for free.
   ============================================================ */

/* VW / VH live in util.js — they are the zoom control. */

const UI = {
  canvas: null, stage: null, hud: null, overlay: null,
  selected: null,
  onStart: null,
  shopTab: 'arsenal',
  scale: 1, offX: 0, offY: 0,

  init() {
    this.canvas = $('#game');
    this.stage = $('#stage');
    this.hud = $('#hud');
    this.overlay = $('#overlay');
    const mm = $('#minimap');
    this.mmx = mm ? mm.getContext('2d') : null;

    this.buildRoster();
    this.bindButtons();
    this.layout();
    window.addEventListener('resize', () => this.layout());
  },

  /* ------------------------------------------------------------
     Scale the canvas to fit the window and align the DOM layers to it.

     Three cases:
       desktop            letterboxed 16:9, HUD overlaid on the picture
       phone, landscape   same, but the HUD spans the whole screen
       phone, portrait    view transposes to 540x960 and the HUD moves
                          OFF the picture into a band above and below

     The portrait bands are the fix for a phone: a browser's own chrome
     already eats a third of the height, and stacking the HUD on top of
     what's left is what made it unreadable.
     ------------------------------------------------------------ */
  layout() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    const touch = typeof TouchUI !== 'undefined' && TouchUI.active;
    // Portrait is a phone affordance. A tall, narrow desktop window
    // should letterbox exactly as it always has, not reshape the game.
    const portrait = touch && h > w;

    document.body.classList.toggle('portrait', portrait);

    // Bands are a share of the screen, floored so they stay usable on a
    // small phone and capped so they don't eat a tablet.
    // The top band has to hold three rows — resources, objective, health —
    // so its floor is what those actually measure, not a round number.
    const topBand = portrait ? Math.round(clamp(h * 0.105, 66, 96)) : 0;
    const botBand = portrait ? Math.round(clamp(h * 0.185, 116, 180)) : 0;
    const availH = Math.max(120, h - topBand - botBand);

    // Desktop keeps the authored 16:9 exactly. A phone gets a view shaped
    // to its own screen, so the picture reaches both edges instead of
    // spending a third of a small display on black bars — at constant
    // AREA, so the amount of world on screen is unchanged. See VIEW_AREA.
    const v = touch ? viewForAspect(w / availH) : VIEW_LANDSCAPE;
    if (setView(v.w, v.h)) Game.viewChanged();

    const s = Math.max(0.3, Math.min(w / VW, availH / VH));
    const cw = Math.floor(VW * s), ch = Math.floor(VH * s);
    this.scale = s;
    this.offX = Math.floor((w - cw) / 2);
    this.offY = topBand + Math.floor((availH - ch) / 2);

    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    // #stage centres the canvas with flex, which can't honour the bands.
    if (portrait) {
      this.canvas.style.position = 'absolute';
      this.canvas.style.left = this.offX + 'px';
      this.canvas.style.top = this.offY + 'px';
    } else {
      this.canvas.style.position = '';
      this.canvas.style.left = '';
      this.canvas.style.top = '';
    }

    // On a touchscreen the HUD is screen furniture rather than canvas
    // furniture: it spans the whole display, so it can use the letterbox
    // instead of stacking on top of the picture.
    for (const layer of [this.hud, this.overlay]) {
      layer.style.left = (touch ? 0 : this.offX) + 'px';
      layer.style.top = (touch ? 0 : this.offY) + 'px';
      layer.style.width = (touch ? w : cw) + 'px';
      layer.style.height = (touch ? h : ch) + 'px';
    }

    // The HUD text is scaled against whatever box it actually occupies.
    this.hud.style.fontSize = clamp((touch ? w : cw) / 96, touch ? 10 : 11, 20) + 'px';

    // What the portrait HUD positions itself against.
    this.hud.style.setProperty('--top-band', topBand + 'px');
    this.hud.style.setProperty('--bot-band', botBand + 'px');
    this.hud.style.setProperty('--play-bottom', (this.offY + ch) + 'px');
    this.hud.style.setProperty('--play-top', this.offY + 'px');

    if (touch) TouchUI.onLayout();
  },

  /* ------------------------------------------------------------
     Screens
     ------------------------------------------------------------ */
  show(name) {
    // An overlay came up, so steering stops — otherwise a thumb still
    // held down when the War Room opens leaves a stale direction that
    // walks you off the moment you close it again.
    if (typeof TouchUI !== 'undefined' && TouchUI.active) TouchUI.release();
    $$('.screen').forEach(s => s.classList.add('hidden'));
    const el = $('#scr-' + name);
    if (el) el.classList.remove('hidden');
    this.overlay.classList.remove('hidden');
    this.overlay.classList.toggle('transparent', name === 'shop' || name === 'pause' || name === 'unlock');
  },

  hideOverlay() { this.overlay.classList.add('hidden'); },
  showHud(on) { this.hud.classList.toggle('hidden', !on); },

  bindButtons() {
    document.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      Sound.init(); Sound.resume(); Sound.ui();
      const act = b.dataset.act;
      if (act === 'goto-title') { this.show('title'); Game.state = 'title'; }
      else if (act === 'goto-help') { this.show('help'); Game.state = 'help'; }
      else if (act === 'goto-select') { this.show('select'); Game.state = 'select'; }
      else if (act === 'goto-campaign') this.showCampaign();
      else if (act === 'camp-spend') { this.campPerks = !this.campPerks; this.showCampaign(); }
      else if (act === 'next-stage') Game.nextStage();
      else if (act === 'start') { if (this.selected) Game.beginStage(this.selected, this.stageIndex || 0); }
      else if (act === 'shop') Game.openShop();
      else if (act === 'closeshop') Game.closeShop();
      else if (act === 'resume') Game.togglePause();
      else if (act === 'touch-pause') {
        if (Game.state === 'playing' || Game.state === 'paused') Game.togglePause();
      }
      else if (act === 'touch-mute') b.textContent = Sound.toggleMute() ? '🔇' : '🔊';
      else if (act === 'quit') Game.quitToCampaign();
      else if (act === 'retry') Game.restart();
      else if (act === 'dev-open') Dev.openMenu();
      else if (act === 'dev-close') Dev.close();
      else if (act === 'dev-reset') Dev.resetPresident(Dev.sel);
      else if (act === 'dev-resetall') Dev.resetAll();
      else if (act === 'dev-export') { Dev.showingExport = !Dev.showingExport; Dev.render(); }
      else if (act === 'dev-copy') {
        const ta = $('#dev-export-text');
        ta.select();
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(() => {});
        else { try { document.execCommand('copy'); } catch (e) {} }
      }
    });

    // The era card says "press any key". A phone hasn't got any, so a
    // tap anywhere on the card counts — and it costs a mouse nothing.
    $('#scr-era').addEventListener('click', () => Game.dismissEra());
    $('#scr-unlock').addEventListener('click', () => Game.dismissUnlock());
  },

  /* ------------------------------------------------------------
     Campaign map
     ------------------------------------------------------------ */
  stageIndex: 0,
  campPerks: false,

  _rosterSig: '',

  /** Rebuild the roster only if what's unlocked has actually changed. */
  maybeRebuildRoster() {
    const sig = PRESIDENTS.map(p => (p.hidden && !Prestige.found[p.id]) ? '0' : '1').join('');
    if (sig === this._rosterSig) return;
    this._rosterSig = sig;
    this.buildRoster();
  },

  showCampaign() {
    Game.state = 'campaign';
    this.maybeRebuildRoster();
    const done = Prestige.progress();
    $('#camp-progress').innerHTML =
      '<b>' + done + '</b> of <b>' + STAGES.length + '</b> stages cleared' +
      (done === STAGES.length ? ' &nbsp;·&nbsp; <b>CAMPAIGN COMPLETE</b>' : '');
    $('#camp-pts').textContent = Prestige.available();

    const list = $('#camp-list');
    list.innerHTML = '';
    let nextUp = -1;
    for (let i = 0; i < STAGES.length; i++) {
      if (Prestige.unlocked(STAGES[i]) && !Prestige.cleared[STAGES[i].id]) { nextUp = i; break; }
    }

    STAGES.forEach((st, i) => {
      const unlocked = Prestige.unlocked(st);
      const cleared = !!Prestige.cleared[st.id];
      let cls = 'stagecard';
      if (!unlocked) cls += ' locked';
      if (cleared) cls += ' cleared';
      if (i === nextUp) cls += ' next';
      const card = el('div', cls);

      // The associated president, as a portrait.
      const pres = PRES_BY_ID[st.president];
      const th = document.createElement('canvas');
      th.width = 30; th.height = 46;
      const cx = th.getContext('2d');
      cx.imageSmoothingEnabled = false;
      if (pres) {
        const spr = Art.person(Object.assign({}, pres.sprite, { key: pres.sprite.key + '_c', scale: 0.95 }), 0);
        cx.drawImage(spr, Math.round((30 - spr.width) / 2), 46 - spr.height);
      }
      card.appendChild(th);

      const body = el('div', 'sb');
      body.appendChild(el('div', 'sno', 'STAGE ' + st.no));
      body.appendChild(el('div', 'snm', st.name));
      body.appendChild(el('div', 'syr', st.year));
      if (pres) body.appendChild(el('div', 'spr', shortName(pres.name)));

      let status;
      if (!unlocked) status = '🔒 clear stage ' + st.no + ' first'.replace(st.no, st.no - 1);
      else if (cleared) {
        const b = Prestige.best[st.id];
        status = '✓ CLEARED' + (b ? ' · best ' + fmtTime(b) : '');
      } else status = i === nextUp ? '▶ NEXT' : 'AVAILABLE';
      body.appendChild(el('div', 'sst', status));
      card.appendChild(body);

      if (unlocked) {
        card.addEventListener('click', () => {
          Sound.ui();
          this.stageIndex = i;
          this.selectPres(st.president);
          this.show('select');
          Game.state = 'select';
        });
      }
      list.appendChild(card);
    });

    /* ---- prestige perks, spendable between runs ---- */
    const perks = $('#camp-perks');
    perks.classList.toggle('hidden', !this.campPerks);
    if (this.campPerks) {
      perks.innerHTML = '';
      for (const id of PRESTIGE_IDS) {
        const u = PRESTIGE_UPGRADES[id];
        const r = Prestige.rank(id);
        const maxed = r >= u.max;
        const afford = Prestige.canBuy(id);
        const row = el('div', 'item fusion' + (afford ? ' affordable' : '') + (maxed ? ' maxed' : ''));
        row.appendChild(el('div', 'ico', u.icon));
        const b = el('div', 'body');
        b.appendChild(el('div', 'nm', u.name + '<span class="tag">PERMANENT</span>'));
        b.appendChild(el('div', 'rank', maxed ? 'MAX RANK' : 'Rank ' + r + ' / ' + u.max));
        const pips = el('div', 'pips');
        for (let k = 0; k < u.max; k++) pips.appendChild(el('span', 'pip2' + (k < r ? ' on' : '')));
        b.appendChild(pips);
        b.appendChild(el('div', 'ds', maxed ? u.blurb : u.text(r)));
        row.appendChild(b);
        const buy = el('button', 'buy');
        if (maxed) { buy.textContent = 'MAX'; buy.disabled = true; }
        else {
          buy.innerHTML = u.cost(r) + '<small>PRESTIGE</small>';
          buy.disabled = !afford;
          buy.addEventListener('click', () => {
            if (Prestige.buy(id)) { Sound.uiBig(); this.showCampaign(); }
          });
        }
        row.appendChild(buy);
        perks.appendChild(row);
      }
    }

    this.show('campaign');
  },

  /* ------------------------------------------------------------
     Era interstitial

     Shown while the incoming stage's sprites are generated, which is
     the only moment in the game with a visible hitch. It doubles as
     the chronology beat: year, place, and whose era this is.
     ------------------------------------------------------------ */
  showEra(st, presId) {
    $('#era-no').textContent = 'STAGE ' + st.no + ' OF ' + STAGES.length;
    $('#era-year').textContent = st.year;
    $('#era-name').textContent = st.name;
    $('#era-blurb').textContent = st.blurb;

    const pres = PRES_BY_ID[presId] || PRES_BY_ID[st.president];
    const pc = $('#era-portrait');
    const cx = pc.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.clearRect(0, 0, pc.width, pc.height);
    cx.fillStyle = '#0b1026'; cx.fillRect(0, 0, pc.width, pc.height);
    if (pres) {
      const spr = Art.person(Object.assign({}, pres.sprite, { key: pres.sprite.key + '_era', scale: 2.4 }), 0);
      cx.drawImage(spr, Math.round((pc.width - spr.width) / 2), pc.height - spr.height - 4);
      $('#era-presname').innerHTML = pres.name + '<br><span style="opacity:.55;font-size:9px">' + pres.term + '</span>';
    }
    this.show('era');
  },

  /**
   * A hidden president has just been found. This freezes the run and puts
   * him on screen properly — the sprite you will actually be playing, and
   * a reason he is worth having — because the previous version was a
   * two-second banner over a live fight, which is exactly when nobody is
   * reading anything.
   */
  showUnlock(pres, sec) {
    $('#unlock-name').textContent = pres.name;
    $('#unlock-term').textContent = pres.term;
    $('#unlock-fact').textContent = pres.fact || '';
    $('#unlock-found').textContent = sec && sec.sub ? sec.sub : '';

    const pc = $('#unlock-portrait');
    const cx = pc.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.clearRect(0, 0, pc.width, pc.height);
    cx.fillStyle = '#0b1026'; cx.fillRect(0, 0, pc.width, pc.height);
    cx.fillStyle = '#141c3d'; cx.fillRect(0, pc.height - 16, pc.width, 16);
    // The same sprite that walks around the stage, just larger.
    const spr = Art.person(
      Object.assign({}, pres.sprite, { key: pres.sprite.key + '_unlock', scale: 3.1 }), 0);
    cx.drawImage(spr, Math.round((pc.width - spr.width) / 2), pc.height - spr.height - 8);

    const kit = $('#unlock-kit');
    kit.innerHTML = '';
    [[pres.weapon, 'PRIMARY'], [pres.weapon2, 'SECONDARY'], [pres.fusion, 'FUSION']]
      .forEach(([id, tag]) => {
        const w = WEAPONS[id];
        if (!w) return;
        const row = el('div', 'ukit');
        row.innerHTML = '<span class="ico">' + w.icon + '</span>' +
          '<b>' + w.name + '</b><span class="tag">' + tag + '</span>';
        kit.appendChild(row);
      });

    this.show('unlock');
  },

  /* ------------------------------------------------------------
     Character select
     ------------------------------------------------------------ */
  buildRoster() {
    const wrap = $('#roster');
    wrap.innerHTML = '';
    PRESIDENTS.forEach((p) => {
      // A hidden president is on the roster from the start as a locked
      // slot, not absent from it. An empty grid tells you nothing; a
      // locked door tells you there is something to find.
      const locked = p.hidden && !Prestige.found[p.id];
      const cell = el('div', 'pres' + (locked ? ' locked' : ''));
      cell.dataset.id = p.id;
      if (locked) {
        cell.appendChild(el('div', 'no', '#' + p.no));
        cell.appendChild(el('div', 'qmark', '?'));
        cell.appendChild(el('div', 'nm', 'SEALED'));
        wrap.appendChild(cell);
        return;
      }

      const thumb = document.createElement('canvas');
      thumb.width = 44; thumb.height = 66;
      const cx = thumb.getContext('2d');
      cx.imageSmoothingEnabled = false;
      const spr = Art.person(Object.assign({}, p.sprite, { key: p.sprite.key + '_t', scale: 1.4 }), 0);
      cx.drawImage(spr, Math.round((44 - spr.width) / 2), 2);

      cell.appendChild(thumb);
      cell.appendChild(el('div', 'no', '#' + p.no));
      cell.appendChild(el('div', 'nm', shortName(p.name).toUpperCase()));

      cell.addEventListener('click', () => { Sound.init(); Sound.ui(); this.selectPres(p.id); });
      wrap.appendChild(cell);
    });
    this.selectPres(PRESIDENTS[0].id);
    this._rosterSig = PRESIDENTS.map(p => (p.hidden && !Prestige.found[p.id]) ? '0' : '1').join('');
  },

  selectPres(id) {
    const pres = PRES_BY_ID[id];
    if (pres && pres.hidden && !Prestige.found[id]) return;
    this.selected = id;
    const p = PRES_BY_ID[id];
    $$('.pres').forEach(c => c.classList.toggle('sel', c.dataset.id === id));
    $('#btn-start').disabled = false;

    const pc = $('#portrait');
    const cx = pc.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.clearRect(0, 0, pc.width, pc.height);
    cx.fillStyle = '#0b1026'; cx.fillRect(0, 0, pc.width, pc.height);
    cx.fillStyle = '#141c3d'; cx.fillRect(0, pc.height - 14, pc.width, 14);
    const spr = Art.person(Object.assign({}, p.sprite, { key: p.sprite.key + '_big', scale: 2.7 }), 0);
    cx.drawImage(spr, Math.round((pc.width - spr.width) / 2), pc.height - spr.height - 6);

    $('#d-name').textContent = p.name;
    $('#d-term').innerHTML = p.term + ' — ' + p.blurb +
      ' <span class="ptcost">' + p.points.toFixed(1) + ' attribute pts</span>';

    // The full arsenal ladder, so the gating is legible before you commit.
    const wl = $('#d-weapons');
    wl.innerHTML = '';
    const rows = [
      ['PRIMARY', WEAPONS[p.weapon], ''],
      ['SECONDARY', WEAPONS[p.weapon2], 'unlocks when the primary is maxed'],
      ['FUSION', WEAPONS[p.fusion], 'unlocks when both are maxed']
    ];
    for (const [tag, w, note] of rows) {
      wl.appendChild(el('div', 'wep',
        '<span class="ico">' + w.icon + '</span><b>' + w.name + '</b>' +
        ' <span class="tag">' + tag + '</span>' +
        ' <span class="atype">' + weaponType(w) + '</span>' +
        '<span class="d"> — ' + w.desc + (note ? ' <i>(' + note + ')</i>' : '') + '</span>'));
    }
    const a = ASSISTANTS[p.id];
    if (a) {
      wl.appendChild(el('div', 'wep',
        '<span class="ico">🤝</span><b>' + a.name + '</b> <span class="tag">STAFF</span>' +
        '<span class="d"> — ' + a.blurb + ' (hired with gold)</span>'));
    }

    const sl = $('#d-stats');
    sl.innerHTML = '';
    for (const pip of STAT_PIPS) {
      const v = p.stats[pip.k];
      const base = BASE_STATS[pip.k];
      if (pip.hideAt !== undefined && v === pip.hideAt) continue;
      let cls = 'pip';
      if (v !== base) cls += (pip.better === 'up' ? v > base : v < base) ? ' good' : ' bad';
      sl.appendChild(el('span', cls, pip.label + ' <b>' + pip.fmt(v) + '</b>'));
    }
  },

  moveSelection(dx, dy) {
    const idx = PRESIDENTS.findIndex(p => p.id === this.selected);
    if (idx < 0) return;
    const n = clamp(idx + dx + dy * 6, 0, PRESIDENTS.length - 1);
    this.selectPres(PRESIDENTS[n].id);
    Sound.ui();
  },

  /* ------------------------------------------------------------
     HUD
     ------------------------------------------------------------ */
  updateHud(g) {
    const p = g.player;
    if (!p) return;

    const hpPct = clamp(p.hp / p.maxHp, 0, 1);
    $('#hpfill').style.width = (hpPct * 100) + '%';
    $('#hptext').textContent = Math.ceil(Math.max(0, p.hp)) + ' / ' + Math.round(p.maxHp);
    $('#hpbar').classList.toggle('low', hpPct < 0.3);

    $('#plvl').textContent = playerLevel(g);
    $('#xpbank').textContent = fmtNum(g.xp);
    $('#goldbank').textContent = fmtNum(g.gold);
    $('#timer').textContent = fmtTime(g.time);
    $('#kills').textContent = fmtNum(g.kills);
    $('#cleared').textContent = g.cleared;
    const sn = $('#stagename');
    if (sn && g.stage) sn.textContent = g.stage.no + '. ' + g.stage.name + ' · ' + g.stage.year;

    // Pulse the upgrade button only when something is genuinely buyable.
    const btn = $('#btn-upgrade');
    const ready = Shop.anyAffordable(g);
    if (ready !== this._ready) { this._ready = ready; btn.classList.toggle('ready', ready); }

    this.updateSlots(p);
    this.updateBoss(g);
    this.updateThreat(g);

    // The minimap is static between frames; a few redraws a second is
    // plenty and keeps it off the per-frame budget.
    if ((g.frameCount & 3) === 0 && this.mmx) World.drawMinimap(this.mmx, g);
  },

  /**
   * The bottom strip. Names the nearest threat, states its level against
   * yours, and says plainly whether walking in is a good idea. This is
   * what stops you strolling into King George at level nine.
   */
  updateThreat(g) {
    const strip = $('#threat');
    const p = g.player;
    const plvl = playerLevel(g);

    let name = null, lvl = 0, dist = Infinity;

    // A live mini-boss takes priority — it's the one actively hunting you.
    const mini = Spawner.mini;
    if (mini && !mini.dead) {
      const d = Math.hypot(mini.x - p.x, mini.y - p.y);
      if (d < 700) { name = mini.def.name; lvl = mini.def.lvl || 1; dist = d; }
    }

    // Otherwise: the nearest strongpoint still in enemy hands. The radius
    // is deliberately far outside the aggro range so you get real warning.
    for (const b of World.buildings) {
      if (b.taken) continue;
      const c = World.centre(b);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < 850 && d < dist) { name = b.name; lvl = b.lvl; dist = d; }
    }

    if (!name) {
      if (this._threatOn) { strip.classList.add('hidden'); this._threatOn = false; }
      return;
    }
    strip.classList.remove('hidden');
    this._threatOn = true;

    const t = threatOf(plvl, lvl);
    const sig = name + '|' + lvl + '|' + plvl;
    if (sig !== this._threatSig) {
      this._threatSig = sig;
      const el2 = $('#threat-lvl');
      el2.textContent = 'LVL ' + lvl;
      el2.style.color = t.col;
      $('#threat-name').textContent = name;
      const v = $('#threat-verdict');
      v.textContent = t.label;
      v.style.color = t.col;
      $('#threat-you').textContent = 'you are LVL ' + plvl;
      strip.classList.toggle('danger', t.label === 'DEADLY' || t.label === 'DANGEROUS');
    }
  },

  _slotSig: '',
  updateSlots(p) {
    // Rebuilding this DOM every frame would be wasteful; only redraw when
    // the loadout actually changed.
    let sig = '';
    for (const w of p.weapons) sig += w.def.id + w.level + '|';
    for (const k in p.passives) sig += k + p.passives[k] + '|';
    sig += p.assistant ? 'a' + (p.assistantRank || 0) : '';
    sig += 'r' + ((p.stats.revives || 0) - (p.revivesUsed || 0));
    if (sig === this._slotSig) return;
    this._slotSig = sig;

    const wrap = $('#weaponslots');
    wrap.innerHTML = '';
    for (const w of p.weapons) {
      const maxed = w.level >= w.def.maxLevel;
      const isFusion = w.def.id === p.pres.fusion;
      const s = el('div', 'slot' + (maxed ? ' max' : '') + (isFusion ? ' fusion' : ''), w.def.icon);
      s.title = w.def.name + ' — rank ' + w.level + '/' + w.def.maxLevel;
      s.appendChild(el('span', 'lv', maxed ? 'M' : String(w.level)));
      wrap.appendChild(s);
    }
    for (const id in p.passives) {
      const d = PASSIVES[id], lvl = p.passives[id];
      const maxed = lvl >= d.max;
      const s = el('div', 'slot passive' + (maxed ? ' max' : ''), d.icon);
      s.title = d.name + ' — rank ' + lvl + '/' + d.max;
      s.appendChild(el('span', 'lv', maxed ? 'M' : String(lvl)));
      wrap.appendChild(s);
    }
    if (p.assistant) {
      const s = el('div', 'slot passive', '🤝');
      s.title = p.assistant.def.name;
      s.appendChild(el('span', 'lv', String(p.assistantRank || 1)));
      wrap.appendChild(s);
    }
    // Revives left, called out separately — you should never be unsure
    // whether the pardon is still in your pocket.
    const revLeft = (p.stats.revives || 0) - (p.revivesUsed || 0);
    if (revLeft > 0) {
      const s = el('div', 'slot revive', '🌹');
      s.title = 'Rose Garden Pardon — ' + revLeft + ' death' + (revLeft > 1 ? 's' : '') + ' will be overturned';
      s.appendChild(el('span', 'lv', String(revLeft)));
      wrap.appendChild(s);
    }
  },

  /**
   * Boss nameplate. Always shows who it is and — this is the point —
   * what they were, so the history lands.
   */
  updateBoss(g) {
    const bar = $('#bossbar');
    const b = g.bossAlive;
    if (!b || b.dead) {
      if (this._bossShown) { bar.classList.add('hidden'); this._bossShown = false; }
      return;
    }
    bar.classList.remove('hidden');
    this._bossShown = true;

    const sig = b.uid;
    if (sig !== this._bossSig) {
      this._bossSig = sig;
      const lvl = b.post ? b.post.lvl : (b.def.lvl || 1);
      const t = threatOf(playerLevel(g), lvl);
      $('#bossname').innerHTML =
        '<span id="bosslvl" style="color:' + t.col + '">LVL ' + lvl + '</span>' + b.def.name;
      let sub = '';
      if (b.post) sub = 'holds ' + b.post.name + ' — ' + b.post.sub;
      else if (b.def.sub) sub = b.def.sub;
      $('#bosssub').textContent = sub;
    }
    $('#bossfill').style.width = clamp(b.hp / b.maxHp, 0, 1) * 100 + '%';
  },

  banner(text, sub) {
    const b = $('#banner');
    b.innerHTML = text + (sub ? '<div style="font-size:.36em;letter-spacing:1px;color:#f4efe2;opacity:.8;margin-top:6px;line-height:1.4">' + sub + '</div>' : '');
    b.classList.remove('show');
    void b.offsetWidth;          // force reflow so the animation restarts
    b.classList.add('show');
  },

  /* ------------------------------------------------------------
     THE WAR ROOM
     ------------------------------------------------------------ */
  showShop(g) {
    const items = Shop.list(g);

    $('#shop-xp').textContent = fmtNum(g.xp);
    $('#shop-gold').textContent = fmtNum(g.gold);
    const pb = $('#shop-prestige');
    if (pb) pb.textContent = Prestige.available();

    /* ---- tabs, with a dot on any category holding something buyable ---- */
    const tabs = $('#shop-tabs');
    tabs.innerHTML = '';
    for (const c of SHOP_CATS) {
      const any = items.some(i => i.cat === c.id && i.afford);
      const t = el('button', 'tab' + (c.id === this.shopTab ? ' on' : ''), c.icon + ' ' + c.name);
      if (any) t.appendChild(el('span', 'dot'));
      t.addEventListener('click', () => { this.shopTab = c.id; Sound.ui(); this.showShop(g); });
      tabs.appendChild(t);
    }
    const cat = SHOP_CATS.find(c => c.id === this.shopTab);
    $('#shop-blurb').textContent = cat ? cat.blurb : '';

    /* ---- the list ---- */
    const list = $('#shop-list');
    list.innerHTML = '';
    for (const it of items) {
      if (it.cat !== this.shopTab) continue;

      let cls = 'item';
      if (it.afford) cls += ' affordable';
      if (it.locked) cls += ' locked';
      if (it.maxed) cls += ' maxed';
      if (it.highlight) cls += ' fusion';
      const row = el('div', cls);

      row.appendChild(el('div', 'ico', it.icon));

      const body = el('div', 'body');
      body.appendChild(el('div', 'nm', it.name + (it.tag ? '<span class="tag">' + it.tag + '</span>' : '')));
      body.appendChild(el('div', 'rank',
        it.maxed ? 'MAX RANK' : 'Rank ' + it.rank + ' / ' + it.max));

      // Rank pips, capped so a long bar doesn't wrap the card.
      if (it.max > 1 && it.max <= 10) {
        const pips = el('div', 'pips');
        for (let i = 0; i < it.max; i++) pips.appendChild(el('span', 'pip2' + (i < it.rank ? ' on' : '')));
        body.appendChild(pips);
      }

      body.appendChild(el('div', 'ds', it.desc));
      if (it.locked) body.appendChild(el('div', 'lockmsg', '🔒 ' + it.lockText));
      row.appendChild(body);

      const buy = el('button', 'buy');
      if (it.maxed) { buy.textContent = 'MAX'; buy.disabled = true; }
      else if (it.locked) { buy.textContent = 'LOCKED'; buy.disabled = true; }
      else {
        const cur = it.currency === 'gold' ? 'GOLD' : (it.currency === 'prestige' ? 'PRESTIGE' : 'XP');
        buy.innerHTML = fmtNum(it.cost) + '<small>' + cur + '</small>';
        buy.disabled = !it.afford;
        buy.addEventListener('click', () => Game.buy(it.id));
      }
      row.appendChild(buy);
      list.appendChild(row);
    }

    this.show('shop');
  },

  /* ------------------------------------------------------------
     Pause / results
     ------------------------------------------------------------ */
  statBlock(items) {
    return items.map(i => '<div class="ostat"><span class="v">' + i[1] + '</span><span class="l">' + i[0] + '</span></div>').join('');
  },

  runStats(g) {
    const p = g.player;
    return [
      ['TIME', fmtTime(g.time)],
      ['STRONGPOINTS', g.cleared + ' / ' + World.buildings.length],
      ['UPGRADES', p.purchases || 0],
      ['KILLS', fmtNum(g.kills)],
      ['GOLD', fmtNum(g.gold)],
      ['XP EARNED', fmtNum(g.xpTotal)]
    ];
  },

  showPause(g) {
    $('#pause-stats').innerHTML = this.statBlock(this.runStats(g));
    this.show('pause');
  },

  showOver(g, won) {
    const head = $('#over-head');
    const st = g.stage;

    // Clearing the LAST stage is the end of the campaign, not just another
    // results screen. Until this existed, finishing the game dropped you
    // back on the map with a line of text and no acknowledgement at all.
    const finale = won && g.stageIndex === STAGES.length - 1;

    head.textContent = finale ? 'THE RECORD IS CLOSED'
      : (won ? (st.name + ' IS CLEAR') : 'TERM ENDED');
    head.classList.toggle('win', !!won);

    let sub = won
      ? 'All nine strongpoints retaken. The flags are back up. ' + st.name + ' is, technically, still standing.'
      : '"' + g.player.pres.quip + '"';
    if (finale) sub = 'Twelve stages. Nine armies apiece. One room at the back of the mountain that nobody had got round to filling in.';
    $('#over-sub').textContent = sub;

    const ending = $('#over-ending');
    ending.classList.toggle('hidden', !finale);
    if (finale) {
      const done = Prestige.progress();
      ending.innerHTML =
        '<h3>THE HALL OF RECORDS</h3>' +
        '<p>Borglum cut eighteen feet into the canyon wall behind Lincoln and meant to ' +
        'fill it with the Declaration, the Constitution, and an account of who these four ' +
        'were and why anyone had gone to the trouble. He died in 1941 and it stayed a hole ' +
        'in a rock for fifty-seven years.</p>' +
        '<p>You have just carried the last of it up the mountain yourself, past every army ' +
        'that ever occupied this country’s memory, with ' + shortName(g.player.pres.name) +
        ' doing most of the shouting. The chamber is sealed. Whoever comes next will know ' +
        'exactly who was on the mountain, and what it cost to keep them there.</p>' +
        '<p class="sign">' + done + ' of ' + STAGES.length + ' stages cleared &nbsp;·&nbsp; ' +
        Prestige.points + ' prestige earned across the campaign</p>';
    }

    // Prestige payout, shown above the stats so it reads as the reward.
    const award = $('#over-award');
    const paid = won && g.award;
    award.classList.toggle('hidden', !paid);
    if (paid) {
      award.innerHTML = 'PRESTIGE EARNED <b>+' + g.award.pts + '</b>' +
        (g.award.first ? ' &nbsp;(includes first-clear bonus)' : '');
    }

    $('#over-stats').innerHTML = this.statBlock(this.runStats(g));

    // Offer the next stage only when there is one and it's now unlocked.
    const btn = $('#btn-next');
    const hasNext = won && g.stageIndex + 1 < STAGES.length;
    btn.classList.toggle('hidden', !hasNext);
    if (hasNext) btn.textContent = 'NEXT: ' + STAGES[g.stageIndex + 1].name;

    this.show('over');
  }
};

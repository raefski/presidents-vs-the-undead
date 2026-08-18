/* ============================================================
   game.js — the loop, the camera, the renderer, the state machine.

   TIMING
     Simulation runs on a fixed 1/60s step with an accumulator, so
     physics and weapon timers behave identically on a 60Hz laptop and
     a 165Hz monitor. Rendering happens once per animation frame.

   RENDER ORDER
     ground -> faction tint -> ground-level effects -> actors sorted by
     depth -> overhead effects -> particles -> damage numbers -> screen
     effects. Sorting by y is what makes a 2D top-down scene read as
     having depth.
   ============================================================ */

const STEP = 1 / 60;
const MAX_STEPS = 5;         // if the tab was hidden, don't simulate an hour
const ANCHOR = 0.72;         // sprite row that sits on the entity's position

const Game = {
  ctx: null,
  state: 'title',            // title | select | help | playing | shop | paused | over
  player: null,

  enemies: null, shots: null, pickups: null, grid: null,

  time: 0, minute: 0, frameCount: 0,
  kills: 0, gold: 0, xp: 0, xpTotal: 0,
  cleared: 0, assistDmg: 0, assistKills: 0,
  stage: null, stageIndex: 0, award: null,
  _pending: null, _eraStart: 0,
  _carryXp: 0, _carryGold: 0,
  hpMul: 1, maxEnemies: 300,
  bossAlive: null, bossDefeated: {},
  won: false,
  allies: [],        // allied presidents, Rushmore only

  camX: 0, camY: 0,
  shakeAmt: 0, shakeX: 0, shakeY: 0,
  flashAmt: 0, flashCol: '255,255,255',


  _acc: 0, _last: 0, _pattern: null,
  _draw: [], _frameTimes: [], _ftIdx: 0,

  /* ------------------------------------------------------------ */

  /**
   * The view was reshaped (the phone was rotated). Resize the backing
   * store, restore the context state that resizing throws away, and drop
   * anything that was baked at the old dimensions.
   */
  viewChanged() {
    const c = $('#game');
    c.width = VW; c.height = VH;
    // Setting width/height resets the whole 2D context, including this.
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    this._vig = null;                       // baked at the old size
    // Snap rather than damp: a rotation shouldn't look like the camera
    // sliding across town.
    if (this.player) {
      this.camX = this.player.x - VW / 2;
      this.camY = this.player.y - VH / 2;
    }
  },

  init() {
    const c = $('#game');
    c.width = VW; c.height = VH;
    this.ctx = c.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;

    this.enemies = new Pool(newEnemy, resetEnemy, 320);
    this.shots = new Pool(newShot, resetShot, 220);
    this.pickups = new Pool(newPickup, resetPickup, 400);
    this.grid = new Grid(48);

    FX.init();
    Art.warm();
    this._pattern = this.ctx.createPattern(Art.makeGround(), 'repeat');
    for (let i = 0; i < 30; i++) this._frameTimes.push(16);
  },

  /* ------------------------------------------------------------
     Run lifecycle
     ------------------------------------------------------------ */
  start(presId, stageIndex) {
    reseed((Date.now() ^ 0x9e3779b9) >>> 0);

    /* Load the stage BEFORE the player, so START_X/START_Y and the world
       bounds are the new stage's before anything reads them. */
    const prev = World.stage;
    const idx = (stageIndex === undefined) ? (this.stageIndex || 0) : stageIndex;
    this.stageIndex = idx;
    if (prev && prev.id !== STAGES[idx].id) Art.evictStage(prev.id);
    this.stage = World.loadStage(idx);
    this._pattern = this.ctx.createPattern(Art.makeGround(this.stage.palette), 'repeat');
    this.player = makePlayer(PRES_BY_ID[presId]);
    this.player.x = START_X; this.player.y = START_Y;
    spawnAllies(this);   // stage.allies, if this stage declares any
    this._secretT = 0;

    this.enemies.releaseAll();
    this.shots.releaseAll();
    this.pickups.releaseAll();
    FX.clear();

    this.time = 0; this.minute = 0; this.frameCount = 0;
    this.kills = 0; this.gold = 0; this.xp = 0; this.xpTotal = 0;
    this.cleared = 0; this.assistDmg = 0; this.assistKills = 0;
    this.bossAlive = null; this.bossDefeated = {};
    this.won = false;
    this.shakeAmt = 0; this.flashAmt = 0;
    this.camX = START_X - VW / 2; this.camY = START_Y - VH / 2;
    this._acc = 0;
    this._lastPresId = presId;

    /* CONTINUITY OF GOVERNMENT: a fraction of the previous stage's
       unspent bank survives the handover. Nothing else carries. */
    const carry = Prestige.carry();
    this.xp = Math.floor((this._carryXp || 0) * carry);
    this.gold = Math.floor((this._carryGold || 0) * carry);

    Spawner.reset();
    Spawner.deploy(this);       // garrison all nine strongpoints up front
    Prestige.applyRunStart(this);
    UI.hideOverlay();
    UI.showHud(true);
    UI._slotSig = '';
    this.state = 'playing';
    Sound.init(); Sound.resume();
  },

  restart() { this.start(this._lastPresId || PRESIDENTS[0].id, this.stageIndex || 0); },

  quitToTitle() {
    this.state = 'title';
    UI.showHud(false);
    UI.show('title');
  },

  /** Abandon a run and go back to stage selection. */
  quitToCampaign() {
    UI.showHud(false);
    UI.showCampaign();
  },

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; UI.showPause(this); }
    else if (this.state === 'paused') { this.state = 'playing'; UI.hideOverlay(); }
  },

  onPlayerDeath() {
    this.state = 'over';
    Sound.gameover();
    this.flash(0.5, '216,50,74');
    setTimeout(() => { if (this.state === 'over') UI.showOver(this, false); }, 900);
  },

  /**
   * Hidden roster unlocks: walk into the spot.
   *
   * Deliberately a position check and not a pickup entity — a pickup
   * would be magneted to you from across the street by the collection
   * radius, which would hand it over without the player ever going
   * looking. You have to actually stand on it.
   */
  checkSecret() {
    const sec = World.stage && World.stage.secret;
    if (!sec || this._secretT) return;
    if (Prestige.found[sec.unlocks]) { this._secretT = 1; return; }
    const p = this.player;
    if (dist2(p.x, p.y, sec.x, sec.y) > sec.r * sec.r) return;

    this._secretT = 1;
    if (!Prestige.find(sec.unlocks)) return;
    const pres = PRES_BY_ID[sec.unlocks];
    const name = pres ? pres.name : 'A NEW COMMANDER';

    FX.ring(sec.x, sec.y, 8, 170, 0.8, 'rgba(242,193,78,.95)', 5);
    FX.ring(sec.x, sec.y, 8, 110, 1.2, 'rgba(255,255,255,.8)', 3);
    FX.burst(sec.x, sec.y, 26, '#f2c14e', 150, 0.8, 3, 'square', 200);
    FX.say(p.x, p.y - 40, 'UNSEALED', '#f2c14e', 18);
    this.announce(name + ' JOINS THE ROSTER',
      sec.sub + ' He is selectable from the character screen from now on.');
    this.flash(0.4, '242,193,78');
    Sound.win();
  },

  onWin() {
    this.won = true;
    this.state = 'over';

    // Bank what's left for CONTINUITY OF GOVERNMENT, then pay out.
    this._carryXp = this.xp;
    this._carryGold = this.gold;
    this.award = Prestige.award(this.stage, this.time);

    Sound.win();
    this.flash(0.7, '255,255,255');
    setTimeout(() => { if (this.state === 'over') UI.showOver(this, true); }, 1400);
  },

  /**
   * Open a stage. Shows the era card first and generates that stage's
   * sprites behind it — that warm is the only visible hitch in the game,
   * and this is what hides it.
   */
  beginStage(presId, index) {
    this._lastPresId = presId;
    this._pending = { presId, index };
    this.state = 'era';
    this._eraStart = performance.now();
    UI.showEra(STAGES[index], presId);

    // One frame later, so the card paints before we block on sprite work.
    setTimeout(() => {
      const prev = World.stage;
      if (prev && prev.id !== STAGES[index].id) Art.evictStage(prev.id);
      World.loadStage(index);
    }, 40);
  },

  /** Leave the era card and actually start. Held for a minimum beat. */
  dismissEra() {
    if (this.state !== 'era') return;
    if (performance.now() - this._eraStart < 700) return;
    const p = this._pending;
    if (!p) { UI.showCampaign(); return; }
    this._pending = null;
    this.start(p.presId, p.index);
  },

  /** Advance to the next stage, keeping the same president. */
  nextStage() {
    const n = this.stageIndex + 1;
    if (n >= STAGES.length) { UI.showCampaign(); return; }
    this.beginStage(this._lastPresId || STAGES[n].president, n);
  },

  /* ------------------------------------------------------------
     Main tick
     ------------------------------------------------------------ */
  tick(now) {
    const raw = (now - this._last) / 1000;
    this._last = now;

    // Track frame cost so we can dial back particle density if needed.
    this._frameTimes[this._ftIdx = (this._ftIdx + 1) % this._frameTimes.length] = raw * 1000;

    if (this.state === 'playing') {
      // Clamp: a long stall (alt-tab, breakpoint) must not fast-forward.
      this._acc += Math.min(raw, 0.25);
      let steps = 0;
      while (this._acc >= STEP && steps < MAX_STEPS) {
        this.step(STEP);
        this._acc -= STEP;
        steps++;
        if (this.state !== 'playing') break;
      }
      if (steps >= MAX_STEPS) this._acc = 0;
    } else {
      this._acc = 0;
      // Effects keep animating on the pause/shop screens; it looks alive.
      if (this.state === 'shop' || this.state === 'over') FX.update(Math.min(raw, 0.05));
      // The era card times out on its own if nobody presses anything.
      if (this.state === 'era' && now - this._eraStart > 5200) this.dismissEra();
    }

    this.render();
    if (this.state === 'playing') UI.updateHud(this);
    this.adaptQuality();
  },

  step(dt) {
    this.time += dt;
    this.minute = this.time / 60;
    this.frameCount++;

    Input.poll();

    updatePlayer(this, dt);
    this.checkSecret();
    updateCompanion(this, dt);
    updateAllies(this, dt);
    Spawner.update(this, dt);
    updateEnemies(this, dt);
    updateShots(this, dt);
    updatePickups(this, dt);
    FX.update(dt);

    /* ---- camera ---- */
    const tx = this.player.x - VW / 2, ty = this.player.y - VH / 2;
    this.camX = damp(this.camX, tx, 14, dt);
    this.camY = damp(this.camY, ty, 14, dt);

    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 26);
      this.shakeX = rand(-1, 1) * this.shakeAmt;
      this.shakeY = rand(-1, 1) * this.shakeAmt;
    } else { this.shakeX = this.shakeY = 0; }

    if (this.flashAmt > 0) this.flashAmt = Math.max(0, this.flashAmt - dt * 2.2);

  },

  /* ------------------------------------------------------------
     Progression
     ------------------------------------------------------------ */
  /* ------------------------------------------------------------
     Progression

     XP is a spendable currency now, not a level track. It banks up and
     the player decides what to buy in the shop. Nothing is ever rolled
     at random.
     ------------------------------------------------------------ */
  addXp(amount) {
    const gained = amount * this.player.stats.growth;
    this.xp += gained;
    this.xpTotal += gained;
  },

  /* ---- the shop ---- */
  openShop() {
    if (this.state !== 'playing') return;
    this.state = 'shop';
    UI.showShop(this);
  },

  closeShop() {
    if (this.state !== 'shop') return;
    this.state = 'playing';
    UI.hideOverlay();
    UI._slotSig = '';
    this._last = performance.now();   // don't bank the time spent shopping
  },

  buy(id) {
    if (this.state !== 'shop') return;
    if (Shop.buy(this, id)) UI.showShop(this);   // refresh prices, locks, banks
  },

  /* ------------------------------------------------------------
     Strongpoints
     ------------------------------------------------------------ */

  /** First time you walk into a garrison's range, say whose it is. */
  announceBoss(b) {
    const def = b.bossDef || (b.bossEnt && b.bossEnt.def) || FINAL_BOSS;
    UI.banner(def.name, 'holds ' + b.name + ' — ' + b.sub);
    Sound.bossSpawn();
  },

  onBossKilled(e) {
    this.bossDefeated[e.def.id] = true;
    if (this.bossAlive === e) this.bossAlive = null;

    // Roaming mini-boss: pays gold, changes nothing structurally.
    if (e.mini) {
      const g = e.gold || 200;
      this.gold += g;
      this.announce(e.def.name + ' DOWN', '+' + g + ' gold. The streets are briefly quieter.');
      this.flash(0.3, '242,193,78');
      return;
    }

    // Strongpoint boss: the building falls, and its garrison with it.
    const b = e.post;
    if (b && !b.taken) {
      b.taken = true;
      b.bossEnt = null;
      this.cleared++;

      const A = this.enemies.active;
      for (let i = A.length - 1; i >= 0; i--) {
        if (A[i].post === b && !A[i].dead) killEnemy(this, A[i]);
      }

      this.gold += 300 + b.tier * 190;
      this.announce(b.name + ' TAKEN',
        this.cleared + ' of ' + World.buildings.length + ' strongpoints cleared.');
      this.flash(0.45, '242,193,78');
      Sound.win();
      this.shake(10);

      if (this.cleared >= World.buildings.length) this.onWin();
    }
  },

  openChest() {
    Sound.levelup();
    FX.glitter(this.player.x, this.player.y, 44);
    const xp = 420 + this.cleared * 300;
    const gold = randInt(140, 340);
    this.addXp(xp);
    this.gold += gold;
    FX.say(this.player.x, this.player.y - 36, '+' + xp + ' XP   +' + gold + ' GOLD', '#f2c14e', 11);
  },

  /* ------------------------------------------------------------
     World-affecting helpers used by pickups and upgrades
     ------------------------------------------------------------ */
  nuke() {
    const A = this.enemies.active;
    this.flash(0.55, '255,255,255');
    this.shake(10);
    Sound.boom();
    for (let i = A.length - 1; i >= 0; i--) {
      const e = A[i];
      if (e.dead) continue;
      if (e.isBoss) damageEnemy(this, e, e.maxHp * 0.12, 0, 0, false);
      else killEnemy(this, e);
    }
  },

  magnetAll() {
    const A = this.pickups.active;
    for (let i = 0; i < A.length; i++) {
      if (A[i].type === 'gem' || A[i].type === 'coin') A[i].pull = 1;
    }
    Sound.levelup();
  },

  spawnShot(cfg) {
    const s = this.shots.get();
    return configureShot(s, cfg);
  },

  spawnPickup(x, y, type, val) { return spawnPickup(this, x, y, type, val); },

  shake(a) { this.shakeAmt = Math.min(16, Math.max(this.shakeAmt, a)); },
  flash(a, col) { this.flashAmt = Math.max(this.flashAmt, a); this.flashCol = col || '255,255,255'; },
  announce(text, sub) { UI.banner(text, sub); },

  /* ------------------------------------------------------------
     Adaptive quality: if we're consistently missing frames, spend
     less on particles rather than dropping the simulation rate.
     ------------------------------------------------------------ */
  adaptQuality() {
    let sum = 0;
    for (let i = 0; i < this._frameTimes.length; i++) sum += this._frameTimes[i];
    const avg = sum / this._frameTimes.length;
    if (avg > 26) FX.quality = Math.max(0.25, FX.quality - 0.02);
    else if (avg < 19) FX.quality = Math.min(1, FX.quality + 0.01);
  },

  /* ============================================================
     RENDERING
     ============================================================ */
  render() {
    const ctx = this.ctx;
    const cx = Math.round(this.camX + this.shakeX);
    const cy = Math.round(this.camY + this.shakeY);

    /* ---- ground: turf, then streets, greens and Market Square ---- */
    World.drawGround(ctx, cx, cy, this._pattern);

    if (!this.player) { this.drawVignette(ctx); return; }

    /* ---- ground-level effects (under everything) ---- */
    const S = this.shots.active;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (s.dead) continue;
      if (s.beh === 'zone' || s.beh === 'trap' || s.beh === 'aura' || s.beh === 'wave') {
        this.drawGroundShot(ctx, s, cx, cy);
      }
    }

    /* ---- depth-sorted actors ---- */
    const list = this._draw;
    list.length = 0;

    const P = this.pickups.active;
    for (let i = 0; i < P.length; i++) if (!P[i].dead && this.onScreen(P[i], cx, cy, 40)) list.push(P[i]);

    const E = this.enemies.active;
    for (let i = 0; i < E.length; i++) if (!E[i].dead && this.onScreen(E[i], cx, cy, 90)) list.push(E[i]);

    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (s.dead) continue;
      const b = s.beh;
      if (b === 'proj' || b === 'eproj' || b === 'arc' || b === 'orbit' ||
          b === 'boomerang' || b === 'ricochet') {
        if (this.onScreen(s, cx, cy, 80)) list.push(s);
      }
    }

    // Buildings sort by the bottom edge of their footprint, so walking
    // north of one puts you behind it.
    for (let i = 0; i < World.buildings.length; i++) {
      const b = World.buildings[i];
      if (b.x - cx > VW + 40 || b.x + b.w - cx < -40) continue;
      if (b.y - cy > VH + 40 || b.y + b.h - cy < -260) continue;
      list.push(b);
    }

    // Scenery joins the depth sort so flags and emplacements occlude
    // correctly rather than always painting over or under.
    for (let i = 0; i < World.props.length; i++) {
      const pr = World.props[i];
      if (pr.x - cx < -60 || pr.x - cx > VW + 60) continue;
      if (pr.y - cy < -90 || pr.y - cy > VH + 60) continue;
      list.push(pr);
    }

    if (this.player.assistant) list.push(this.player.assistant);
    for (let i = 0; i < this.allies.length; i++) list.push(this.allies[i]);
    if (!this.player.dead) list.push(this.player);

    list.sort(byDepth);

    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.kind === 'enemy') this.drawEnemy(ctx, o, cx, cy);
      else if (o.kind === 'pickup') this.drawPickup(ctx, o, cx, cy);
      else if (o.kind === 'shot') this.drawShot(ctx, o, cx, cy);
      else if (o.kind === 'building') World.drawBuilding(ctx, o, cx, cy);
      else if (o.kind2 === 'prop') World.drawProp(ctx, o, cx, cy);
      else if (o.kind === 'companion' || o.kind === 'ally') drawCompanion(ctx, o, cx, cy);
      else this.drawPlayer(ctx, o, cx, cy);
    }

    /* ---- overhead effects ---- */
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (s.dead) continue;
      if (s.beh === 'beam') this.drawBeam(ctx, s, cx, cy);
      else if (s.beh === 'cone') this.drawCone(ctx, s, cx, cy);
      else if (s.beh === 'drop' && s.delay > 0) this.drawFalling(ctx, s, cx, cy);
    }

    FX.draw(ctx, cx, cy);
    FX.drawNums(ctx, cx, cy);

    /* ---- offscreen markers ---- */
    if (this.bossAlive && !this.bossAlive.dead) this.drawBossArrow(ctx, cx, cy);
    World.drawObjective(ctx, this.player.x, this.player.y, cx, cy);

    /* ---- screen effects ---- */
    this.drawVignette(ctx);

    if (this.player.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(216,50,74,' + (this.player.hurtFlash * 0.55) + ')';
      ctx.fillRect(0, 0, VW, VH);
    }
    const hpFrac = this.player.hp / this.player.maxHp;
    if (hpFrac < 0.3 && !this.player.dead) {
      const pulse = 0.14 + Math.sin(this.time * 7) * 0.07;
      ctx.fillStyle = 'rgba(216,50,74,' + (pulse * (1 - hpFrac / 0.3)) + ')';
      ctx.fillRect(0, 0, VW, VH);
    }
    if (this.flashAmt > 0) {
      ctx.fillStyle = 'rgba(' + this.flashCol + ',' + this.flashAmt * 0.7 + ')';
      ctx.fillRect(0, 0, VW, VH);
    }
  },

  onScreen(o, cx, cy, pad) {
    const x = o.x - cx, y = o.y - cy;
    return x > -pad && x < VW + pad && y > -pad && y < VH + pad;
  },

  /* ---- actors ---- */

  drawPlayer(ctx, p, cx, cy) {
    const spr = Art.person(p.pres.sprite, p.moving ? p.frame : 0);
    const x = Math.round(p.x - cx), y = Math.round(p.y - cy);
    this.shadow(ctx, x, y, spr.width * 0.9, null, y + spr.height * (1 - ANCHOR));

    // Blink while invulnerable so the state is readable.
    const blink = p.invuln > 0 && ((p.invuln * 22) | 0) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.55;

    ctx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height * ANCHOR));

    if (p.hurtFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p.hurtFlash * 2;
      ctx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height * ANCHOR));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  },

  drawEnemy(ctx, e, cx, cy) {
    const x = Math.round(e.x - cx), y = Math.round(e.y - cy);

    const spr = e.art ? e.art : (e.frame ? e.sprB : e.sprA);
    if (!spr) return;

    const sc = (e.art ? e.artScale : 1) * e.drawScale;
    const w = spr.width * sc;
    const h = spr.height * sc;

    if (!e.flying) this.shadow(ctx, x, y, w * 0.85, null, y + h * (1 - ANCHOR));
    else this.shadow(ctx, x, y + 20, w * 0.6, 0.4, y + 20);

    if (e.spawnT > 0) ctx.globalAlpha = 1 - e.spawnT / 0.22;

    /* BEHAVIOUR TELLS.
       Sprinters and fireball-throwers are the two things that punish a
       player who cannot yet out-damage them, so they are marked all the
       time rather than only at the moment they commit. Being able to
       pick one out of a crowd of forty is the difference between
       positioning and guessing. */
    if (!e.isBoss) {
      const ai = e.def.ai;
      const runner = (ai === 'charger' || ai === 'swarm');
      if (runner || ai === 'shooter') {
        const col = runner ? 'rgba(216,50,74,.85)' : 'rgba(255,138,58,.9)';
        const gy = y + h * (1 - ANCHOR) - 2;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, gy, e.r * 1.05, e.r * 0.44, 0, 0, TAU);
        ctx.stroke();

        ctx.fillStyle = col;
        const ty = Math.round(y - h * ANCHOR) - 5;
        if (runner) {
          // Forward chevron: this one closes on you.
          ctx.beginPath();
          ctx.moveTo(x, ty - 4); ctx.lineTo(x - 4, ty + 1); ctx.lineTo(x + 4, ty + 1);
          ctx.closePath(); ctx.fill();
        } else {
          // Crosshair pip: this one hits you from over there.
          ctx.fillRect(x - 4, ty - 1, 8, 2);
          ctx.fillRect(x - 1, ty - 4, 2, 8);
        }
        // Winding up to charge — the tell that matters most.
        if (runner && e.state === 1) {
          ctx.globalAlpha = 0.5 + Math.sin(this.time * 9) * 0.3;
          ctx.strokeStyle = '#ff5a5a';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, gy, e.r * 1.7, e.r * 0.7, 0, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    // Elites wear a gold ring; bosses get a red one.
    if (e.elite || e.isBoss) {
      ctx.strokeStyle = e.isBoss ? 'rgba(216,50,74,.8)' : 'rgba(242,193,78,.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + h * (1 - ANCHOR) - 2, e.r * 1.15, e.r * 0.5, 0, 0, TAU);
      ctx.stroke();
    }

    const dx = Math.round(x - w / 2), dy = Math.round(y - h * ANCHOR);
    ctx.drawImage(spr, dx, dy, w, h);

    if (e.hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, e.hitFlash * 9);
      ctx.drawImage(spr, dx, dy, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Slowed / rooted tint.
    if (e.rootT > 0 || e.slowT > 0) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = e.rootT > 0 ? '#6a4a2a' : '#7fd4ff';
      ctx.fillRect(dx, dy, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  },

  drawPickup(ctx, o, cx, cy) {
    const x = Math.round(o.x - cx), y = Math.round(o.y - cy + Math.sin(o.t) * 1.5);
    let spr;
    if (o.type === 'gem') spr = Art.gem(o.tier);
    else spr = Art.pickup(o.type);

    if (o.type === 'chest') {
      // Chests glow — you should never walk past one.
      ctx.globalAlpha = 0.4 + Math.sin(o.t * 1.6) * 0.2;
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height / 2));
  },

  drawShot(ctx, s, cx, cy) {
    const x = Math.round(s.x - cx), y = Math.round(s.y - cy);

    if (s.beh === 'arc' && s.bar) {
      // Teddy's stick: a solid club drawn along the swing angle.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.ang);
      ctx.fillStyle = '#5a3f22';
      ctx.fillRect(-s.barLen * 0.5, -3, s.barLen, 6);
      ctx.fillStyle = '#8a6a40';
      ctx.fillRect(-s.barLen * 0.5, -3, s.barLen, 2);
      ctx.fillStyle = '#c9a878';
      ctx.fillRect(s.barLen * 0.3, -5, s.barLen * 0.24, 10);
      ctx.restore();
      return;
    }

    if (!s.art) {
      // Plain energy bolt.
      if (s.glow) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = s.glow;
        ctx.beginPath(); ctx.arc(x, y, s.r * 1.8, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill();
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    if (s.rot) ctx.rotate(s.rot);
    const w = s.art.width * s.artScale, h = s.art.height * s.artScale;
    ctx.drawImage(s.art, -w / 2, -h / 2, w, h);
    ctx.restore();
  },

  /* ---- effects ---- */

  drawGroundShot(ctx, s, cx, cy) {
    const x = s.x - cx, y = s.y - cy;
    const t = s.life / s.maxLife;

    if (s.beh === 'wave') {
      if (s.delay > 0) return;
      ctx.globalAlpha = clamp(t * 1.3, 0, 1);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(x, y, Math.max(1, s.r), 0, TAU); ctx.stroke();
      ctx.globalAlpha = clamp(t * 0.55, 0, 1);
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(x, y, Math.max(1, s.r - 8), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    if (s.beh === 'aura') {
      const pulse = 0.5 + Math.sin(s.t * 7) * 0.16;
      ctx.globalAlpha = 0.14 * t + 0.05;
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.55 * t;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, s.r * pulse * 2, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    // zone / trap
    ctx.globalAlpha = clamp(t * 0.75, 0.1, 0.75);
    if (s.void) {
      const grd = ctx.createRadialGradient(x, y, 1, x, y, Math.max(2, s.r));
      grd.addColorStop(0, 'rgba(8,2,14,.95)');
      grd.addColorStop(0.7, 'rgba(60,20,90,.7)');
      grd.addColorStop(1, 'rgba(120,60,180,0)');
      ctx.fillStyle = grd;
    } else if (s.grease) {
      ctx.fillStyle = 'rgba(120,92,32,.7)';
    } else if (s.cloth) {
      ctx.fillStyle = 'rgba(239,228,207,.75)';
    } else if (s.fire) {
      const grd = ctx.createRadialGradient(x, y, 1, x, y, Math.max(2, s.r));
      grd.addColorStop(0, 'rgba(255,220,120,.75)');
      grd.addColorStop(0.55, 'rgba(255,106,42,.55)');
      grd.addColorStop(1, 'rgba(180,40,20,0)');
      ctx.fillStyle = grd;
    } else if (s.glitter) {
      ctx.fillStyle = 'rgba(242,193,78,.45)';
    } else {
      ctx.fillStyle = s.color;
    }
    ctx.beginPath(); ctx.arc(x, y, Math.max(1, s.r), 0, TAU); ctx.fill();

    if (s.cloth) {
      // Stripes, so the banner reads as a banner from above.
      ctx.globalAlpha = clamp(t * 0.6, 0, 0.6);
      ctx.fillStyle = '#d8324a';
      for (let i = -2; i <= 2; i++) ctx.fillRect(x - s.r, y + i * 9, s.r * 2, 3);
      ctx.fillStyle = '#3f6fd8';
      ctx.fillRect(x - s.r, y - s.r * 0.55, s.r * 0.7, s.r * 0.7);
    }

    ctx.globalAlpha = clamp(t, 0, 1);
    ctx.strokeStyle = s.void ? '#a06ad8' : (s.glitter ? '#fff3cf' : '#00000055');
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, Math.max(1, s.r), 0, TAU); ctx.stroke();

    if (s.beh === 'trap' && s.art) {
      ctx.globalAlpha = 1;
      const w = s.art.width * s.artScale, h = s.art.height * s.artScale;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.t * 3);
      ctx.drawImage(s.art, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },

  drawBeam(ctx, s, cx, cy) {
    const x = s.x - cx, y = s.y - cy;
    const t = s.life / s.maxLife;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.ang);
    const w = s.wid * (0.5 + t * 0.6);
    const grd = ctx.createLinearGradient(0, 0, s.len, 0);
    grd.addColorStop(0, 'rgba(255,255,255,' + (0.95 * t) + ')');
    grd.addColorStop(0.35, 'rgba(255,233,168,' + (0.85 * t) + ')');
    grd.addColorStop(1, 'rgba(255,184,74,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, -w / 2, s.len, w);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * t) + ')';
    ctx.fillRect(0, -w * 0.16, s.len * 0.9, w * 0.32);
    ctx.restore();

    ctx.globalAlpha = t * 0.8;
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath(); ctx.arc(x, y, 7 * t + 3, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  },

  drawCone(ctx, s, cx, cy) {
    const x = s.x - cx, y = s.y - cy;
    const t = s.life / s.maxLife;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.ang);
    const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, Math.max(4, s.len));
    grd.addColorStop(0, 'rgba(255,255,255,' + (0.7 * t) + ')');
    grd.addColorStop(0.5, 'rgba(191,228,255,' + (0.45 * t) + ')');
    grd.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, s.len, -s.half, s.half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawFalling(ctx, s, cx, cy) {
    const k = clamp(s.delay / s.delayMax, 0, 1);
    const x = Math.round(s.x - cx);
    const groundY = Math.round(s.y - cy);
    // Ease in so it accelerates toward the ground.
    const y = groundY - s.fallH * (k * k);

    // Target marker
    ctx.globalAlpha = 0.35 + (1 - k) * 0.45;
    ctx.strokeStyle = s.boom || '#ffd66a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, groundY, s.r * (0.5 + (1 - k) * 0.5), s.r * 0.4 * (0.5 + (1 - k) * 0.5), 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;

    if (!s.art) return;
    const w = s.art.width * s.artScale, h = s.art.height * s.artScale;
    ctx.save();
    ctx.translate(x, y);
    if (s.flat) {
      // The banner falls flat, so squash it as it descends.
      ctx.drawImage(s.art, -w / 2, -h / 2, w, h * (0.4 + 0.6 * (1 - k)));
    } else {
      ctx.drawImage(s.art, -w / 2, -h, w, h);
    }
    ctx.restore();
  },

  /**
   * Ground shadow, at the FEET.
   *
   * This used to be centred near `y`, but sprites are drawn at
   * `y - h*ANCHOR`, so the boots land at `y + (1-ANCHOR)*h` — about
   * eleven pixels lower. The shadow was sitting behind the figure's
   * shins where the sprite painted straight over it, and nothing in the
   * game looked like it was standing on anything. The elite, boss and
   * runner rings already used the correct foot line; this now agrees
   * with them.
   *
   * `footY` is that line. Callers that know their sprite height pass it;
   * anything that doesn't falls back to the old behaviour of `y`.
   */
  shadow(ctx, x, y, w, alpha, footY) {
    const sh = Art.getShadow();
    // Narrower than the sprite: it should match the width of the boots,
    // not the width of the shoulders.
    const sw = Math.max(8, w * 0.62);
    const shh = sw * (14 / 32);
    const fy = footY == null ? y : footY;
    ctx.globalAlpha = alpha == null ? 0.75 : alpha;
    ctx.drawImage(sh, Math.round(x - sw / 2), Math.round(fy - shh * 0.55), sw, shh);
    ctx.globalAlpha = 1;
  },

  /** Arrow at the screen edge pointing to an offscreen boss. */
  drawBossArrow(ctx, cx, cy) {
    const b = this.bossAlive;
    const x = b.x - cx, y = b.y - cy;
    if (x > 10 && x < VW - 10 && y > 10 && y < VH - 10) return;
    const px = clamp(x, 16, VW - 16), py = clamp(y, 24, VH - 16);
    const a = Math.atan2(y - VH / 2, x - VW / 2);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(216,50,74,.9)';
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  },

  drawVignette(ctx) {
    if (!this._vig) {
      const c = document.createElement('canvas');
      c.width = VW; c.height = VH;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(VW / 2, VH / 2, VH * 0.36, VW / 2, VH / 2, VH * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.5)');
      x.fillStyle = g; x.fillRect(0, 0, VW, VH);
      this._vig = c;
    }
    ctx.drawImage(this._vig, 0, 0);
  }
};

/**
 * Depth sort: lower on the screen draws in front. Buildings carry an
 * explicit sortY (the bottom of their footprint) because their `y` is
 * the top edge, which would sort them far too early.
 */
function byDepth(a, b) {
  return (a.sortY !== undefined ? a.sortY : a.y) - (b.sortY !== undefined ? b.sortY : b.y);
}



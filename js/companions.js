/* ============================================================
   companions.js — the hired assistant.

   One per president, bought with gold in the STAFF tab. They trail
   along behind you and fight on their own timer. Deliberately not a
   second player: they should be worth hiring and never worth relying
   on, which lands somewhere around a tenth of your own output.

   Their damage scales off how much YOU have invested (`purchases`)
   rather than off the clock, so a VP hired at minute three is still
   pulling their weight at minute fifteen without ever overtaking you.
   ============================================================ */

/**
 * The best thing for an assistant to shoot: the enemy in range with the
 * LEAST health left.
 *
 * Targeting the nearest — or even the furthest — enemy means competing
 * with your president for things that are already dead on arrival, and
 * the assistant ends up with plenty of hits and no kills. Going after
 * whatever is closest to dying makes them a finisher, which is a job the
 * president is bad at and which produces a steady, visible contribution
 * no matter how much of the field your own weapons cover.
 */
function finishableEnemy(g, x, y, maxR) {
  const list = g.enemies.active;
  let best = null, bestHp = Infinity;
  const max2 = maxR * maxR;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead || e.spawnT > 0) continue;
    if (dist2(x, y, e.x, e.y) > max2) continue;
    // Bosses are never "finishable" — chipping one is a waste of the turn.
    const hp = e.isBoss ? e.hp * 6 : e.hp;
    if (hp < bestHp) { bestHp = hp; best = e; }
  }
  return best;
}

/** Attach the president's assistant. Called from the shop. */
function hireAssistant(g) {
  const p = g.player;
  const def = ASSISTANTS[p.pres.id];
  if (!def || p.assistant) return;

  p.assistant = {
    kind: 'companion', def,
    x: p.x - 26, y: p.y + 10,
    r: 7, timer: rand(0.2, 0.6),
    frame: 0, frameT: 0, moving: 0, flash: 0,
    sprA: Art.person(def.sprite, 0),
    sprB: Art.person(def.sprite, 1)
  };
  p.assistantRank = 1;

  FX.say(p.x, p.y - 44, def.name + ' JOINS', '#7ee88a', 12);
  FX.ring(p.x, p.y, 8, 60, 0.5, 'rgba(126,232,138,.9)', 3);
  Sound.levelup();
}

/**
 * Effective damage per hit for the current build.
 *
 * Scales off the player's WEAPON RANKS, not their raw purchase count.
 * Counting purchases meant a player who bought thirty cheap passives got
 * an assistant nine times stronger while their own damage hadn't moved —
 * the VP ended up out-damaging the president three to one.
 */
function assistDamage(g) {
  const p = g.player;
  const a = p.assistant;
  if (!a) return 0;
  const rank = p.assistantRank || 1;
  let ranks = 0;
  for (let i = 0; i < p.weapons.length; i++) ranks += p.weapons[i].level;
  return a.def.damage
    * p.stats.might
    * (1 + 0.30 * (ranks - 1))
    * (1 + 0.45 * (rank - 1));
}

function updateCompanion(g, dt) {
  const p = g.player;
  const a = p.assistant;
  if (!a || p.dead) return;

  /* ---- follow, hanging back a little behind the president ---- */
  const tx = p.x - p.face.x * 30 - 6;
  const ty = p.y - p.face.y * 30 + 8;
  const dx = tx - a.x, dy = ty - a.y;
  const d = Math.hypot(dx, dy);

  if (d > 14) {
    // Never let them fall behind: they close faster the further out they are.
    const sp = Math.min(p.stats.speed * 1.55, 70 + d * 2.4);
    a.x += (dx / d) * sp * dt;
    a.y += (dy / d) * sp * dt;
    a.moving = 1;
    a.frameT += dt * 5.5;
    if (a.frameT >= 1) { a.frameT = 0; a.frame ^= 1; }
  } else {
    a.moving = 0;
  }

  // Teleport if they get walled off — better than watching them shove a house.
  if (d > 420) { a.x = p.x; a.y = p.y; }
  World.collide(a, a.r);
  World.clampToWorld(a, a.r);

  if (a.flash > 0) a.flash -= dt;

  /* ---- attack ---- */
  const rank = p.assistantRank || 1;
  a.timer -= dt;
  if (a.timer > 0) return;

  const def = a.def;
  const range = def.range * (1 + 0.06 * (rank - 1));

  const target = finishableEnemy(g, a.x, a.y, range);
  if (!target) { a.timer = 0.2; return; }

  a.timer = def.interval / (1 + 0.12 * (rank - 1));
  a.flash = 0.12;
  const dmg = assistDamage(g);
  const ang = Math.atan2(target.y - a.y, target.x - a.x);

  switch (def.atk) {
    case 'melee':
      // The swing radius must match the range they select targets at, or
      // they spend the whole game lunging at things just out of reach.
      g.spawnShot({
        beh: 'arc', follow: 0, x: a.x, y: a.y,
        ang: ang - 0.9, angVel: 1.8 / 0.28, orbR: 0,
        r: range * 0.95, dmg, pierce: 999, life: 0.28,
        knock: 190, color: def.color, assist: 1, anchor: a
      });
      Sound.throttled('acomp', 110, () => Sound.noise(0.08, 0.07, 2400, 800, 1.4));
      break;

    case 'beam':
      g.spawnShot({
        beh: 'beam', x: a.x, y: a.y, ang,
        len: range, wid: 12, dmg, pierce: 999, life: 0.22,
        knock: 40, color: def.color, glow: def.color, assist: 1
      });
      Sound.throttled('acomp', 140, () => Sound.tone(760, 0.14, 'sine', 0.06, 1500));
      break;

    case 'burst': {
      const n = 3 + Math.floor(rank / 2);
      for (let i = 0; i < n; i++) {
        const aa = ang + (i - (n - 1) / 2) * 0.17;
        g.spawnShot({
          beh: 'proj', x: a.x, y: a.y,
          vx: Math.cos(aa) * 560, vy: Math.sin(aa) * 560,
          r: 5, dmg: dmg * 0.55, pierce: 1, life: 1.0,
          knock: 50, color: def.color, glow: def.color, trail: 1, assist: 1, ang: aa
        });
      }
      Sound.throttled('acomp', 110, () => Sound.tone(560, 0.07, 'square', 0.05, 260));
      break;
    }

    default:   // 'shot'
      g.spawnShot({
        beh: 'proj', x: a.x, y: a.y,
        vx: Math.cos(ang) * 600, vy: Math.sin(ang) * 600,
        r: 6, dmg, pierce: 2, life: 1.3,
        knock: 70, color: def.color, glow: def.color, trail: 1, assist: 1, ang
      });
      Sound.throttled('acomp', 110, () => Sound.tone(680, 0.06, 'square', 0.05, 300));
  }
}

/* ============================================================
   ALLIED PRESIDENTS

   Declared per stage (`stage.allies`) and used only by the Rushmore
   finale, where the carved presidents come down off the mountain and
   fight beside whoever you brought.

   They are NOT a second assistant. An ally is built with makePlayer(),
   which means it is a genuine weapon owner — real stats, real primary,
   real fire() — so Lincoln's beam is Lincoln's beam and not a recoloured
   generic bolt. Nothing in weapons.js reaches for g.player, so a weapon
   fires correctly for whoever is handed to it.

   Two deliberate limits:
     - they never take damage. Babysitting three invulnerable-but-mortal
       escorts through a level 88 fight is a different, worse game.
     - their weapon rank trails yours and their damage is scaled down,
       because the run has to stay about the president the player chose.
   ============================================================ */

/* Where each ally sits relative to you. Spread rather than stacked, so
   three of them plus an assistant don't become one indistinguishable
   clump on a phone screen. */
const ALLY_OFFSETS = [
  { x: -52, y: 16 }, { x: 52, y: 16 }, { x: 0, y: -44 }, { x: -34, y: -30 }
];

/** Damage scale — see the note above about not stealing the run. */
const ALLY_MIGHT = 0.55;

function spawnAllies(g) {
  g.allies = [];
  const st = World.stage;
  if (!st || !st.allies) return;

  for (const id of st.allies) {
    // Don't stand the player next to a second copy of themselves.
    if (id === g.player.pres.id) continue;
    const pres = PRES_BY_ID[id];
    if (!pres) continue;

    const a = makePlayer(pres);
    a.kind = 'ally';
    a.slot = g.allies.length;
    a.stats.might *= ALLY_MIGHT;
    const off = ALLY_OFFSETS[a.slot % ALLY_OFFSETS.length];
    a.x = g.player.x + off.x;
    a.y = g.player.y + off.y;
    a.r = 8;
    a.flash = 0;
    a.sprA = Art.person(pres.sprite, 0);
    a.sprB = Art.person(pres.sprite, 1);
    g.allies.push(a);
  }
}

function updateAllies(g, dt) {
  const list = g.allies;
  if (!list || !list.length) return;
  const p = g.player;

  /* Their rank trails the player's total investment. Veterans of the
     whole campaign rather than level-1 recruits — but capped below your
     ceiling so three of them can never out-shoot the one you picked. */
  let ranks = 0;
  for (let i = 0; i < p.weapons.length; i++) ranks += p.weapons[i].level;
  const lvl = clamp(1 + Math.floor(ranks / 4), 1, 6);

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const off = ALLY_OFFSETS[a.slot % ALLY_OFFSETS.length];
    const tx = p.x + off.x, ty = p.y + off.y;
    const dx = tx - a.x, dy = ty - a.y;
    const d = Math.hypot(dx, dy);

    if (d > 16) {
      const sp = Math.min(p.stats.speed * 1.6, 80 + d * 2.2);
      a.x += (dx / d) * sp * dt;
      a.y += (dy / d) * sp * dt;
      a.moving = 1;
      a.frameT += dt * 5.5;
      if (a.frameT >= 1) { a.frameT = 0; a.frame ^= 1; }
    } else {
      a.moving = 0;
    }
    if (d > 520) { a.x = p.x; a.y = p.y; }     // walled off — catch up
    World.collide(a, a.r);
    World.clampToWorld(a, a.r);
    if (a.flash > 0) a.flash -= dt;

    /* Face the nearest target, or a cone weapon fires due east all game. */
    const t = nearestEnemy(g, a.x, a.y, 420);
    if (t) {
      const m = Math.hypot(t.x - a.x, t.y - a.y) || 1;
      a.face.x = (t.x - a.x) / m; a.face.y = (t.y - a.y) / m;
    } else {
      a.face.x = p.face.x; a.face.y = p.face.y;
    }

    const w = a.weapons[0];
    if (!w) continue;
    w.level = lvl;
    const s = wstats(w, a);
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer = s.interval;
      // Only when there's something to shoot: idle allies firing into
      // empty hillside is noise, and it costs shots from the pool.
      if (t) { a.flash = 0.1; w.def.fire(g, a, w, s); }
    }
  }
}

/** Drawn in the depth-sorted pass, same as any other actor. */
function drawCompanion(ctx, a, cx, cy) {
  const spr = a.moving && a.frame ? a.sprB : a.sprA;
  if (!spr) return;
  const x = Math.round(a.x - cx), y = Math.round(a.y - cy);

  const sh = Art.getShadow();
  const sw = spr.width * 0.8, shh = sw * (14 / 32);
  ctx.globalAlpha = 0.7;
  ctx.drawImage(sh, Math.round(x - sw / 2), Math.round(y - shh * 0.3), sw, shh);
  ctx.globalAlpha = 1;

  const dx = Math.round(x - spr.width / 2), dy = Math.round(y - spr.height * ANCHOR);
  ctx.drawImage(spr, dx, dy);

  if (a.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a.flash * 3;
    ctx.drawImage(spr, dx, dy);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

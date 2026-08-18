/* ============================================================
   presidents.js — the playable roster.

   Every president is pure data: a sprite recipe, a stat block, and
   two weapon ids. Adding a thirteenth commander in chief means adding
   one object here and one weapon in weapons.js. Nothing else changes.

   BASELINE stats (what 1.0 / 100 / 62 mean):
     hp 100, speed 62 world-units/sec, might 1.0 damage multiplier,
     area 1.0 size multiplier, cooldown 1.0 (lower fires faster),
     amount +0 extra projectiles, armor 0 flat damage reduction.
   ============================================================ */

const BASE_STATS = {
  hp: 100, speed: 62, might: 1, area: 1, cooldown: 1, duration: 1,
  projSpeed: 1, amount: 0, armor: 0, regen: 0, magnet: 42,
  luck: 1, growth: 1, greed: 1, revives: 0
};

const PRESIDENTS = [
  {
    id: 'washington', no: 1, name: 'GEORGE WASHINGTON',
    term: '1st President · 1789–1797',
    blurb: 'Cannot tell a lie. Can absolutely tell an axe.',
    weapon: 'axe', weapon2: 'volley',
    fusion: 'fusion_washington',
    quip: 'I cannot tell a lie — that went poorly.',
    base: { hp: 115, speed: 60, might: 1.15, armor: 1 },
    sprite: {
      key: 'washington', coat: '#1f3352', coatAlt: '#c9b07a', shirt: '#efe8d4',
      hair: '#e8e6dc', hairStyle: 'wig', hat: 'tricorn', hatCol: '#191922',
      hatAccent: '#c9a24a', pants: '#c9b07a', hold: 'saber', holdCol: '#7a5a34'
    }
  },
  {
    id: 'lincoln', no: 2, name: 'ABRAHAM LINCOLN',
    term: '16th President · 1861–1865',
    blurb: 'Four score and seven seconds ago, that horde existed.',
    weapon: 'beam', weapon2: 'log',
    fusion: 'fusion_lincoln',
    quip: 'The world will little note, nor long remember, that.',
    base: { hp: 95, speed: 58, area: 1.25, growth: 1.1 },
    sprite: {
      key: 'lincoln', scale: 0.975, coat: '#191922', coatAlt: '#2a2a34',
      shirt: '#efe8d4', tie: '#2a2a34', hair: '#241a12', hairStyle: 'tall',
      face: 'beard', facialCol: '#241a12', hat: 'stovepipe', hatCol: '#131319'
    }
  },
  {
    id: 'teddy', no: 3, name: 'THEODORE ROOSEVELT',
    term: '26th President · 1901–1909',
    blurb: 'Speaks softly. Does not, in practice, speak softly.',
    weapon: 'stick', weapon2: 'moose',
    fusion: 'fusion_teddy',
    quip: 'Bully. Absolutely bully. Ow.',
    base: { hp: 130, speed: 68, might: 1.2, area: 0.95, cooldown: 0.95, regen: 0.2 },
    sprite: {
      key: 'teddy', coat: '#4a5236', coatAlt: '#5e6844', shirt: '#c9b07a',
      hair: '#4a3a24', hairStyle: 'part', face: 'glasses', stache: true,
      facialCol: '#4a3a24', hat: 'campaign', hatCol: '#5a4a2e', hatAccent: '#2e3a24',
      pants: '#3e4630', hold: 'club', holdCol: '#6a4a2a'
    }
  },
  {
    id: 'fdr', no: 4, name: 'FRANKLIN D. ROOSEVELT',
    term: '32nd President · 1933–1945',
    blurb: 'The only thing they have to fear is this wheelchair.',
    weapon: 'chair', weapon2: 'fireside',
    fusion: 'fusion_fdr',
    quip: 'The only thing we have to fear is... that, mostly.',
    base: { hp: 90, speed: 82, might: 0.95, area: 1.05, cooldown: 0.9 },
    sprite: {
      key: 'fdr', coat: '#2e3a4e', shirt: '#efe8d4', tie: '#4a5a7a',
      hair: '#6a6258', hairStyle: 'thin', face: 'glasses',
      hat: 'fedora', hatCol: '#2a2a34', chair: true, chairCol: '#9aa2b4'
    }
  },
  {
    id: 'jfk', no: 5, name: 'JOHN F. KENNEDY',
    term: '35th President · 1961–1963',
    blurb: 'Ask not what your country can do for you. Ask about the boat.',
    weapon: 'pt109', weapon2: 'moonshot',
    fusion: 'fusion_jfk',
    quip: 'Ask not for whom the horde comes. Rude.',
    base: { hp: 92, speed: 74, might: 1.05, cooldown: 0.92, luck: 1.15 },
    sprite: {
      key: 'jfk', skin: '#e8b48a', coat: '#2a3550', shirt: '#efe8d4',
      tie: '#8a1f2e', hair: '#7a4f2a', hairStyle: 'poof', pin: true
    }
  },
  {
    id: 'nixon', no: 6, name: 'RICHARD NIXON',
    term: '37th President · 1969–1974',
    blurb: 'Recording this encounter. For posterity. No reason.',
    weapon: 'tape', weapon2: 'gap',
    fusion: 'fusion_nixon',
    quip: 'I am not a crook. I am, however, deceased.',
    base: { hp: 100, speed: 55, area: 1.1, luck: 1.35, growth: 1.15 },
    sprite: {
      key: 'nixon', arms: 'up', skin: '#d8a888', coat: '#3a3a46', shirt: '#efe8d4',
      tie: '#3a5a9a', hair: '#2a2018', hairStyle: 'part', stache: false, pin: true
    }
  },
  {
    id: 'reagan', no: 7, name: 'RONALD REAGAN',
    term: '40th President · 1981–1989',
    blurb: 'Tear down this horde. Also, want a jelly bean?',
    weapon: 'beans', weapon2: 'sdi',
    fusion: 'fusion_reagan',
    quip: 'Well... there you go again.',
    base: { hp: 98, speed: 63, might: 0.9, amount: 1, cooldown: 0.95 },
    sprite: {
      key: 'reagan', hat: 'stetson', hatCol: '#8a6a42', hatAccent: '#4a3420', coat: '#4a2f2a', coatAlt: '#5c3c34', shirt: '#efe8d4',
      tie: '#a83a3a', hair: '#3a2a1c', hairStyle: 'poof', pin: true
    }
  },
  {
    id: 'clinton', no: 8, name: 'BILL CLINTON',
    term: '42nd President · 1993–2001',
    blurb: 'Plays a mean sax. Plays a meaner sax at the undead.',
    weapon: 'sax', weapon2: 'bigmac',
    fusion: 'fusion_clinton',
    quip: 'I feel your pain. Genuinely, this time.',
    base: { hp: 105, speed: 64, might: 0.95, area: 1.0, magnet: 55 },
    sprite: {
      key: 'clinton', hold: 'sax', coat: '#1f2a44', shirt: '#efe8d4', tie: '#c02a3a',
      hair: '#b8b0a4', hairStyle: 'poof', pin: true
    }
  },
  {
    id: 'bush43', no: 9, name: 'GEORGE W. BUSH',
    term: '43rd President · 2001–2009',
    blurb: 'Declares victory early. Repeatedly. It keeps working.',
    weapon: 'banner', weapon2: 'shoe',
    fusion: 'fusion_bush43',
    quip: 'Fool me once... shame on... you can\'t get fooled again.',
    base: { hp: 112, speed: 66, might: 1.05, area: 1.15, armor: 1 },
    sprite: {
      key: 'bush43', coat: '#8a7550', coatAlt: '#a89263', shirt: '#efe8d4', tie: '#3a6a9a',
      hair: '#4a3a2a', hairStyle: 'crop', pin: true
    }
  },
  {
    id: 'obama', no: 10, name: 'BARACK OBAMA',
    term: '44th President · 2009–2017',
    blurb: 'Yes we can. Specifically: yes we can vaporize those.',
    weapon: 'hope', weapon2: 'micdrop',
    fusion: 'fusion_obama',
    quip: 'Let me be clear: that was not ideal.',
    base: { hp: 100, speed: 66, area: 1.25, cooldown: 0.9, growth: 1.1 },
    sprite: {
      key: 'obama', arms: 'rolled', skin: '#8a5f3f', coat: '#dfe3ea', coatAlt: '#c2c8d4', shirt: '#efe8d4',
      tie: '#4a6ab0', hair: '#1a1614', hairStyle: 'crop', pin: true
    }
  },
  {
    id: 'trump', no: 11, name: 'DONALD TRUMP',
    term: '45th & 47th President · 2017–2021, 2025–',
    blurb: 'The escalator goes down. It only ever goes down.',
    weapon: 'golf', weapon2: 'fired',
    fusion: 'escalator',
    quip: 'Frankly, nobody has ever died better than that.',
    base: { hp: 135, speed: 52, might: 1.35, area: 1.1, cooldown: 1.1, greed: 1.5 },
    sprite: {
      key: 'trump', skin: '#e8b878', coat: '#1a1a22', coatAlt: '#26262f',
      shirt: '#efe8d4', tie: '#d8324a', hair: '#e8c76a', hairStyle: 'swoop',
      hat: 'cap', hatCol: '#d8324a', pin: true
    }
  },
  {
    id: 'biden', no: 12, name: 'JOSEPH R. BIDEN',
    term: '46th President · 2021–2025',
    blurb: 'Come on, man. Get in the Corvette.',
    weapon: 'corvette', weapon2: 'aviators',
    fusion: 'fusion_biden',
    quip: 'Here\'s the deal — no, that\'s it. That was the deal.',
    base: { hp: 108, speed: 70, might: 1.05, cooldown: 0.95, regen: 0.15 },
    sprite: {
      key: 'biden', coat: '#1f2a44', shirt: '#efe8d4', tie: '#3f6fd8',
      hair: '#e8e4dc', hairStyle: 'thin', face: 'shades', pin: true
    }
  },
  {
    /* Hidden until found. See the `secret` block on stage 1 and
       Prestige.found — he is not on the roster until you find him. */
    id: 'jefferson', no: 13, name: 'THOMAS JEFFERSON',
    term: '3rd President · 1801–1809',
    blurb: 'He wrote the sentence. He has been getting notes on it ever since.',
    weapon: 'declaration', weapon2: 'purchase',
    fusion: 'fusion_jefferson',
    quip: 'The tree of liberty has, on reflection, been rather over-watered.',
    hidden: 1,
    base: { hp: 92, speed: 61, area: 1.2, luck: 1.25, growth: 1.1 },
    sprite: {
      key: 'jefferson', scale: 0.99, coat: '#5a2230', coatAlt: '#7c3242',
      shirt: '#efe8d4', tie: '#efe8d4', pants: '#d8cfb8',
      hair: '#b4623a', hairStyle: 'wig', hold: 'quill', holdCol: '#3a2a18'
    }
  },
  {
    id: 'grant', no: 14, name: 'ULYSSES S. GRANT',
    term: '18th President · 1869–1877',
    blurb: 'Lincoln went through five generals before this one. This one did not stop.',
    weapon: 'cigar', weapon2: 'surrender',
    fusion: 'fusion_grant',
    quip: 'I propose to fight it out on this line. Not, it turns out, today.',
    hidden: 1,
    base: { hp: 122, speed: 55, might: 1.05, armor: 2, growth: 1.05 },
    sprite: {
      key: 'grant', scale: 1.0, coat: '#2a3a4a', coatAlt: '#c9a24a',
      shirt: '#c9bfa2', pants: '#4a5a68', hair: '#3a2a1c', hairStyle: 'crop',
      face: 'fullbeard', facialCol: '#3a2a1c', hat: 'kepi', hatCol: '#1f2a36',
      hold: 'saber', holdCol: '#c9a24a'
    }
  },
  {
    id: 'eisenhower', no: 15, name: 'DWIGHT D. EISENHOWER',
    term: '34th President · 1953–1961',
    blurb: 'Ran the largest invasion in history, then warned everybody about the people who sold him the boats.',
    weapon: 'beachhead', weapon2: 'interstate',
    fusion: 'fusion_eisenhower',
    quip: 'Plans are worthless. Planning is everything. Neither helped there.',
    hidden: 1,
    base: { hp: 104, speed: 58, area: 1.15, cooldown: 0.95, amount: 1 },
    sprite: {
      key: 'eisenhower', scale: 0.98, coat: '#6e6a54', coatAlt: '#8a8468',
      shirt: '#c9bfa2', tie: '#3a3a30', pants: '#7a7460',
      hair: '#c8c4b8', hairStyle: 'bald', hat: 'peaked', hatCol: '#5e5a46',
      hatAccent: '#c9a24a'
    }
  },
  {
    id: 'truman', no: 16, name: 'HARRY S. TRUMAN',
    term: '33rd President · 1945–1953',
    blurb: 'Nobody expected him to win. The newspaper had already gone to press.',
    weapon: 'givehell', weapon2: 'dewey',
    fusion: 'fusion_truman',
    quip: 'The buck stopped somewhere back there, I think.',
    hidden: 1,
    base: { hp: 96, speed: 63, growth: 1.15, luck: 1.15, magnet: 50 },
    sprite: {
      key: 'truman', scale: 0.96, coat: '#3a3a48', coatAlt: '#5a5a6a',
      shirt: '#efe8d4', tie: '#8a2a3a', pants: '#4a4a58',
      hair: '#c8c4b8', hairStyle: 'thin', face: 'glasses',
      hat: 'fedora', hatCol: '#5a5648'
    }
  }
];

/* ============================================================
   ASSISTANTS

   Hired with gold, not XP. Each one follows their president around
   and picks off a slice of the horde on their own timer — useful,
   never a replacement for your own weapons.

   Damage scales with elapsed time (see companions.js) so a hire made
   at minute three still contributes at minute fifteen.

   `atk` is one of: 'shot' (ranged bolt), 'melee' (short arc),
   'burst' (radial spray), 'beam' (short lance).
   ============================================================ */
const ASSISTANTS = {
  jefferson: {
    name: 'AARON BURR', title: 'Vice President, 1801–1805',
    blurb: 'An excellent shot. Famously, catastrophically, an excellent shot.',
    cost: 950, atk: 'shot', interval: 1.25, damage: 9, range: 340, color: '#e8d9a8',
    sprite: { key: 'a_burr', coat: '#2a2a34', coatAlt: '#6a6a78', shirt: '#efe8d4', pants: '#c9bfa2', hair: '#2a2018', hairStyle: 'wig', hold: 'musket', holdCol: '#5a4128', scale: 0.75 }
  },
  grant: {
    name: 'W. T. SHERMAN', title: 'Major General, Army of the Tennessee',
    blurb: 'Made Georgia howl. Considered it the shortest available route.',
    cost: 1000, atk: 'burst', interval: 1.5, damage: 8, range: 300, color: '#ff9a5a',
    sprite: { key: 'a_sherman', coat: '#2a3a4a', coatAlt: '#8a8468', shirt: '#c9bfa2', pants: '#4a5a68', hair: '#7a4a2a', hairStyle: 'crop', face: 'fullbeard', facialCol: '#7a4a2a', hat: 'kepi', hatCol: '#1f2a36', scale: 0.75 }
  },
  eisenhower: {
    name: 'RICHARD NIXON', title: 'Vice President, 1953–1961',
    blurb: 'Keen, available, and taking rather a lot of notes.',
    cost: 980, atk: 'shot', interval: 1.3, damage: 9, range: 330, color: '#b8c4d8',
    sprite: { key: 'a_nixon2', coat: '#2f3240', coatAlt: '#4a4e60', shirt: '#efe8d4', tie: '#6a2a3a', pants: '#3a3e4c', hair: '#2a2018', hairStyle: 'crop', scale: 0.75 }
  },
  truman: {
    name: 'ALBEN BARKLEY', title: 'Vice President, 1949–1953',
    blurb: 'Coined the word "Veep" because his grandson could not manage the rest of it.',
    cost: 900, atk: 'shot', interval: 1.35, damage: 8, range: 350, color: '#f2e0a8',
    sprite: { key: 'a_barkley', coat: '#3a3a48', coatAlt: '#5a5a6a', shirt: '#efe8d4', tie: '#2a4a6a', pants: '#4a4a58', hair: '#d8d4c8', hairStyle: 'thin', face: 'glasses', scale: 0.75 }
  },
  washington: {
    name: 'MARQUIS DE LAFAYETTE', title: 'Major General, Continental Army',
    blurb: 'Nineteen years old, absurdly rich, and here entirely by choice.',
    cost: 900, atk: 'shot', interval: 1.4, damage: 8, range: 320, color: '#ffe9a8',
    sprite: { key: 'a_lafayette', coat: '#1f3352', coatAlt: '#c9b07a', shirt: '#efe8d4', pants: '#c9b07a', hair: '#e8e6dc', hairStyle: 'wig', hat: 'tricorn', hatCol: '#191922', hatAccent: '#c9a24a', hold: 'musket', scale: 0.75 }
  },
  lincoln: {
    name: 'HANNIBAL HAMLIN', title: '15th Vice President',
    blurb: 'Served a full term and was replaced on the ticket. Still bitter. Channels it.',
    cost: 900, atk: 'shot', interval: 1.2, damage: 6, range: 320, color: '#ffd24a',
    sprite: { key: 'a_hamlin', coat: '#2a2a34', shirt: '#efe8d4', tie: '#1a1a22', hair: '#2a2018', hairStyle: 'part', face: 'fullbeard', facialCol: '#2a2018', hat: 'stovepipe', hatCol: '#1a1a22', scale: 0.75 }
  },
  teddy: {
    name: 'A ROUGH RIDER', title: '1st U.S. Volunteer Cavalry',
    blurb: 'Volunteered for San Juan Hill. Volunteered again for this. Nobody asked.',
    cost: 850, atk: 'melee', interval: 0.9, damage: 3, range: 92, color: '#c9a878',
    sprite: { key: 'a_rider', coat: '#4a5236', coatAlt: '#5e6844', shirt: '#c9b07a', pants: '#3e4630', hair: '#4a3a24', hairStyle: 'crop', stache: true, facialCol: '#4a3a24', hat: 'campaign', hatCol: '#5a4a2e', hold: 'saber', scale: 0.75 }
  },
  fdr: {
    name: 'ELEANOR ROOSEVELT', title: 'First Lady of the World',
    blurb: 'Redrafted the Universal Declaration of Human Rights. Reads the relevant clause aloud. It burns.',
    cost: 1000, atk: 'beam', interval: 1.8, damage: 10, range: 320, color: '#bfe4ff',
    sprite: { key: 'a_eleanor', coat: '#4a5a72', coatAlt: '#5f7189', shirt: '#efe8d4', pants: '#4a5a72', hair: '#8a8578', hairStyle: 'poof', hat: 'fedora', hatCol: '#5a6a80', scale: 0.75 }
  },
  jfk: {
    name: 'LYNDON B. JOHNSON', title: '36th Vice President',
    blurb: 'Applies the Johnson Treatment: stands much too close and does not stop talking.',
    cost: 950, atk: 'melee', interval: 1.1, damage: 3, range: 92, color: '#e8d0a0',
    sprite: { key: 'a_lbj', coat: '#3a3a48', shirt: '#efe8d4', tie: '#8a7a3a', hair: '#3a3028', hairStyle: 'thin', hat: 'fedora', hatCol: '#4a4a54', scale: 0.775 }
  },
  nixon: {
    name: 'SPIRO AGNEW', title: '39th Vice President',
    blurb: 'Nattering nabob of negativism. Hurls unsealed documents at high velocity.',
    cost: 850, atk: 'burst', interval: 1.9, damage: 6, range: 320, color: '#efe4cf',
    sprite: { key: 'a_agnew', coat: '#3f4450', shirt: '#efe8d4', tie: '#6a3a4a', hair: '#2e2a22', hairStyle: 'part', scale: 0.75 }
  },
  reagan: {
    name: 'GEORGE H. W. BUSH', title: '43rd Vice President',
    blurb: 'Banned broccoli from Air Force One. Has kept a supply for exactly this.',
    cost: 900, atk: 'burst', interval: 1.7, damage: 6, range: 320, color: '#5ec26a',
    sprite: { key: 'a_hwbush', coat: '#2a3550', shirt: '#efe8d4', tie: '#c02a3a', hair: '#8a8578', hairStyle: 'part', scale: 0.75 }
  },
  clinton: {
    name: 'AL GORE', title: '45th Vice President',
    blurb: 'Presents an inconvenient truth. The chart goes up. Everything near the chart goes down.',
    cost: 900, atk: 'beam', interval: 1.7, damage: 10, range: 320, color: '#5ec26a',
    sprite: { key: 'a_gore', coat: '#232a3c', coatAlt: '#2f3850', shirt: '#efe8d4', tie: '#5ec26a', hair: '#6a6258', hairStyle: 'part', scale: 0.75 }
  },
  bush43: {
    name: 'DICK CHENEY', title: '46th Vice President',
    blurb: 'Operating from an undisclosed location approximately four feet to your left.',
    cost: 950, atk: 'burst', interval: 1.6, damage: 6, range: 320, color: '#c8ccd6',
    sprite: { key: 'a_cheney', coat: '#2f3440', shirt: '#efe8d4', tie: '#5a5a68', hair: '#b8b0a4', hairStyle: 'bald', face: 'glasses', scale: 0.75 }
  },
  obama: {
    name: 'JOE BIDEN', title: '47th Vice President',
    blurb: 'Available. Enthusiastic. Wearing the sunglasses indoors, as is his right.',
    cost: 900, atk: 'beam', interval: 1.6, damage: 10, range: 320, color: '#bfe4ff',
    sprite: { key: 'a_bidenvp', coat: '#1f2a44', shirt: '#efe8d4', tie: '#3f6fd8', hair: '#c8c0b4', hairStyle: 'thin', face: 'shades', scale: 0.75 }
  },
  trump: {
    name: 'MIKE PENCE', title: '48th Vice President',
    blurb: 'Arrives with the fly. The fly does most of the work. Nobody discusses the fly.',
    cost: 850, atk: 'burst', interval: 1.5, damage: 6, range: 320, color: '#2a2a34',
    sprite: { key: 'a_pence', coat: '#2a2f3c', shirt: '#efe8d4', tie: '#d8324a', hair: '#e8e4dc', hairStyle: 'part', scale: 0.75 }
  },
  biden: {
    name: 'KAMALA HARRIS', title: '49th Vice President',
    blurb: 'Former prosecutor. Objects, sustains her own objection, and drops the gavel.',
    cost: 950, atk: 'melee', interval: 1.0, damage: 3, range: 92, color: '#c9a24a',
    sprite: { key: 'a_harris', coat: '#2a2f42', coatAlt: '#3a405a', shirt: '#efe8d4', pants: '#2a2f42', skin: '#a06a44', hair: '#1a1410', hairStyle: 'poof', scale: 0.75 }
  }
};

/* ============================================================
   ATTRIBUTE POINTS

   A single currency for "how much stat did this president get",
   so the roster can be balanced against each other rather than by
   feel. One point is roughly one meaningful unit of power; the
   divisors below are what a point buys of each stat.

   Deviations are measured from BASE_STATS, and can be negative — a
   slow president is spending points elsewhere and getting some back.
   ============================================================ */
const POINT_UNITS = {
  hp: 10,          // +10 max health
  speed: 2,        // +2 move speed (movement is worth a lot here)
  might: 0.05,     // +5% damage
  area: 0.05,      // +5% area
  cooldown: -0.05, // -5% interval (negative: lower is better)
  duration: 0.05,
  projSpeed: 0.05,
  amount: 0.08,    // +1 projectile is ~12.5 points, and should be
  armor: 0.35,     // +1 armor ~2.9 pts: strong early, negligible once
                   // enemy damage outgrows it, and capped at 75% anyway
  regen: 0.05,
  magnet: 8,
  luck: 0.06,
  growth: 0.06,
  greed: 0.12,     // gold matters least, so it costs least
  revives: 0.1
};

/** Points spent on one stat, signed. */
function statPoints(key, value) {
  const base = BASE_STATS[key];
  const unit = POINT_UNITS[key];
  if (base === undefined || !unit) return 0;
  return (value - base) / unit;
}

/** Total attribute points for a stat block. */
function totalPoints(stats) {
  let t = 0;
  for (const k in POINT_UNITS) {
    if (stats[k] === undefined) continue;
    t += statPoints(k, stats[k]);
  }
  return t;
}

/* ------------------------------------------------------------
   Stat assembly

   BASE_STATS  ->  p.base (authored)  ->  BALANCE_OVERRIDES (yours)
                                       ->  live dev-menu tweaks

   Re-runnable, so the dev menu can change a number and have it take
   effect immediately without a reload.
   ------------------------------------------------------------ */

/** Live tweaks from the dev menu, kept out of the committed file. */
let LIVE_TWEAKS = {};

/**
 * Roughly how far a weapon can hurt something, in world units.
 * Used only to decide who is a melee character; it does not need to be
 * exact, it needs to separate "must stand in the crowd" from "need not".
 */
function weaponReach(w) {
  switch (w.style) {
    case 'arc':   return (w.reach || 0) + (w.radius || 0);
    case 'wave':  return w.radius || 0;
    case 'aura':  return w.radius || 0;
    case 'beam':
    case 'cone':  return w.len || 0;
    case 'orbit': return (w.radius || 0) * 1.5;
    case 'trap':
    case 'zone':
    case 'drop':  return 300;                       // placed at range
    default:      return (w.speed || 200) * (w.duration || 1);
  }
}

/**
 * MELEE COMPENSATION.
 *
 * A president whose primary attack has no reach has to stand inside the
 * crowd to deal any damage at all, which is strictly more dangerous than
 * doing it from thirty metres away — and it is worst exactly when they
 * are weakest, before anything has been bought. They get armour and
 * health back for it, scaled by how short their reach actually is.
 *
 * Derived rather than hand-typed, so it stays correct if a weapon's
 * numbers change. Applied BEFORE your overrides, so you can still tune
 * or remove it per president in balance-overrides.js.
 */
function meleeCompensation(p) {
  const w = (typeof WEAPONS !== 'undefined') && WEAPONS[p.weapon];
  if (!w) return null;
  const reach = weaponReach(w);
  if (reach >= 140) return null;                    // has a ranged option
  const t = clamp((140 - reach) / 100, 0, 1);
  // Weighted toward health rather than armour: armour is enormously
  // front-loaded (it is a flat subtraction against 7-damage openers and
  // nothing against 44-damage late ones), so leaning on it would make
  // these three trivial early and no better later.
  return { armor: 2, hp: Math.round(20 + t * 45) };
}

function rebuildPresidentStats() {
  for (const p of PRESIDENTS) {
    const file = (typeof BALANCE_OVERRIDES !== 'undefined' && BALANCE_OVERRIDES[p.id]) || {};
    const live = (typeof IGNORE_LOCAL_TWEAKS !== 'undefined' && IGNORE_LOCAL_TWEAKS)
      ? {} : (LIVE_TWEAKS[p.id] || {});

    p.stats = Object.assign({}, BASE_STATS, p.base);

    // Melee compensation stacks on the authored base, then your overrides win.
    const mc = meleeCompensation(p);
    p.melee = !!mc;
    if (mc) {
      p.stats.armor = (p.stats.armor || 0) + mc.armor;
      p.stats.hp = (p.stats.hp || 0) + mc.hp;
    }

    Object.assign(p.stats, file, live);
    p.points = totalPoints(p.stats);
  }
}

/** id -> president, for quick lookup. */
const PRES_BY_ID = {};
for (const p of PRESIDENTS) PRES_BY_ID[p.id] = p;
rebuildPresidentStats();

/**
 * Which stat pips to show on the select screen, and what counts as
 * "notably better/worse than baseline" for coloring them.
 */
const STAT_PIPS = [
  { k: 'hp',       label: 'HP',    fmt: v => Math.round(v),     better: 'up' },
  { k: 'speed',    label: 'SPD',   fmt: v => Math.round(v),     better: 'up' },
  { k: 'might',    label: 'MIGHT', fmt: v => pct(v),            better: 'up' },
  { k: 'area',     label: 'AREA',  fmt: v => pct(v),            better: 'up' },
  { k: 'cooldown', label: 'RATE',  fmt: v => pct(2 - v),        better: 'down' },
  { k: 'armor',    label: 'ARMOR', fmt: v => '+' + v,           better: 'up', hideAt: 0 },
  { k: 'luck',     label: 'LUCK',  fmt: v => pct(v),            better: 'up', hideAt: 1 },
  { k: 'regen',    label: 'REGEN', fmt: v => '+' + v.toFixed(2), better: 'up', hideAt: 0 },
  { k: 'amount',   label: 'PROJ',  fmt: v => '+' + v,           better: 'up', hideAt: 0 },
  { k: 'growth',   label: 'XP',    fmt: v => pct(v),            better: 'up', hideAt: 1 },
  { k: 'greed',    label: 'GOLD',  fmt: v => pct(v),            better: 'up', hideAt: 1 },
  { k: 'magnet',   label: 'MAGNET',fmt: v => Math.round(v),     better: 'up', hideAt: 42 }
];

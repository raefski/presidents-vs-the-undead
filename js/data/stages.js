/* ============================================================
   stages.js — the eleven-stage chronological campaign.

   WHY THIS FILE EXISTS
     world.js used to hardcode one map: a WORLD_W/WORLD_H pair, one
     GROUND_ZONES array and one BUILDINGS array. Everything downstream
     (spawner, minimap, collision, objective markers) read those globals
     directly. This file turns all of it into data so a stage is a
     record, not a rewrite.

   THREE LAYERS, SO ELEVEN STAGES DON'T COST ELEVEN TIMES THE DATA

     1. PALETTES    an era's materials and ground colours. Every
                    procedural draw reads from the active palette, so
                    switching eras recolours the whole world without a
                    single new sprite.

     2. ARCHETYPES  reusable structure templates (colonial house, tin
                    shack, concrete bunker...). A stage's building says
                    WHICH archetype and WHERE, not how to draw a roof.
                    Art.building() already takes flags like brick/
                    octagon/cupola; archetypes are just named bundles of
                    those flags plus palette hooks.

     3. STAGES      layout, strongpoints, garrison factions, mini-boss
                    pool, and the stage boss.

   A new stage is therefore ~40 lines of data, not a new renderer.

   COLLISION / GRID NOTE
     Every stage keeps the 48px spatial hash. The grid is rebuilt from
     scratch each frame from live entities and is unbounded in extent
     (it hashes cell coords, it doesn't allocate a WxH array), so a
     larger or smaller stage costs nothing extra and needs no retuning.

   NAMING NOTE
     Enemies are named as MILITARY FORCES, never as peoples — the same
     rule the original nine armies follow. See GAME.md.
   ============================================================ */

/* ------------------------------------------------------------
   1. PALETTES — an era's look, as data
   ------------------------------------------------------------ */
const PALETTES = {
  colonial: {
    turf: '#2f4526', turfAlt: ['#35502a', '#294020', '#3c5a2e', '#416432', '#243a1c'],
    street: '#8a7550', rut: 'rgba(70,56,34,.45)', green: '#3f6030', dirt: '#7d6a4c',
    fence: '#5a4a32', sky: 'rgba(0,0,0,0)'
  },
  civilwar: {
    turf: '#4a5230', turfAlt: ['#535c36', '#3f4628', '#5c6640', '#69734a', '#333a20'],
    street: '#8a7a58', rut: 'rgba(66,54,30,.5)', green: '#4e5a34', dirt: '#7a6b48',
    fence: '#4a3f28', sky: 'rgba(120,90,40,0.06)'
  },
  frontier: {
    turf: '#7a6a42', turfAlt: ['#86754a', '#6c5d38', '#93825a', '#5e5230', '#a08d63'],
    street: '#9c8a5e', rut: 'rgba(90,74,42,.45)', green: '#6e6a38', dirt: '#8d7c52',
    fence: '#6a5636', sky: 'rgba(200,160,80,0.07)'
  },
  wwii: {
    turf: '#4a4a3a', turfAlt: ['#54543f', '#3e3e30', '#5e5e48', '#333326', '#666650'],
    street: '#6e6a5c', rut: 'rgba(48,44,34,.5)', green: '#454a34', dirt: '#5f5a4a',
    fence: '#3a3a2e', sky: 'rgba(80,80,90,0.10)'
  },
  sixties: {
    turf: '#5a6a3a', turfAlt: ['#63744a', '#4d5c30', '#6e8052', '#41501f', '#7a8c5e'],
    street: '#5c5c60', rut: 'rgba(40,40,44,.45)', green: '#4f6234', dirt: '#7a7060',
    fence: '#4a4a44', sky: 'rgba(120,140,200,0.06)'
  },
  jungle: {
    turf: '#26401e', turfAlt: ['#2d4c22', '#1e3418', '#375a2a', '#16280f', '#436a34'],
    street: '#5e5230', rut: 'rgba(40,34,18,.55)', green: '#1f3a18', dirt: '#5a4c2e',
    fence: '#33452a', sky: 'rgba(40,90,40,0.12)'
  },
  coldwar: {
    turf: '#4a4a52', turfAlt: ['#53535c', '#3f3f47', '#5c5c66', '#34343b', '#666672'],
    street: '#54545c', rut: 'rgba(36,36,42,.5)', green: '#424a42', dirt: '#5e5e66',
    fence: '#3a3a42', sky: 'rgba(90,100,130,0.12)'
  },
  desert: {
    turf: '#9a8354', turfAlt: ['#a68e5d', '#8b7548', '#b39a68', '#7a6640', '#c0a878'],
    street: '#b3a074', rut: 'rgba(110,92,58,.4)', green: '#8a7f4e', dirt: '#a89263',
    fence: '#7a6844', sky: 'rgba(230,190,110,0.10)'
  },
  mountain: {
    turf: '#7a7260', turfAlt: ['#847c6a', '#6e6656', '#928a78', '#5e584a', '#a09884'],
    street: '#8e846e', rut: 'rgba(84,76,60,.42)', green: '#6a6a50', dirt: '#877c66',
    fence: '#5e5648', sky: 'rgba(180,180,200,0.10)'
  },
  arid: {
    turf: '#8a7448', turfAlt: ['#96803f', '#7c6740', '#a28c58', '#6c5a34', '#b09a68'],
    street: '#a08c60', rut: 'rgba(96,80,48,.45)', green: '#7e7440', dirt: '#96825a',
    fence: '#6e5c3a', sky: 'rgba(220,170,90,0.11)'
  },
  pandemic: {
    turf: '#3a4048', turfAlt: ['#434a52', '#31373e', '#4d545c', '#282d33', '#575f68'],
    street: '#4a4a52', rut: 'rgba(30,32,38,.5)', green: '#36423c', dirt: '#54545c',
    fence: '#2e3238', sky: 'rgba(60,180,160,0.10)'
  },
  /* Black Hills granite and ponderosa pine — the mountain is grey, the
     trees are almost black, and the light is thin. */
  blackhills: {
    turf: '#2e3a2c', turfAlt: ['#354334', '#273325', '#3d4c3a', '#1f2a1e', '#455440'],
    street: '#7e7e78', rut: 'rgba(52,52,48,.45)', green: '#2a3828', dirt: '#6e6a5e',
    fence: '#4a4438', sky: 'rgba(150,160,180,0.09)'
  }
};

/* ------------------------------------------------------------
   2. ARCHETYPES — reusable structures

   These are the flag bundles Art.building() already understands,
   plus `mat` which selects colours from the active palette so the
   same archetype reads differently in different eras.
   ------------------------------------------------------------ */
const ARCHETYPES = {
  /* --- pre-industrial --- */
  brickhouse: { wall: '#8f5442', roof: '#4a4038', trim: '#2f4a34', brick: 1, dormers: 3 },
  clapboard:  { wall: '#e2dccc', roof: '#4a4038', trim: '#2f4a34', dormers: 4 },
  church:     { wall: '#8f5442', roof: '#3f3a34', trim: '#2f4a34', brick: 1, cupola: 1, steeple: 1, chimneys: 0 },
  civic:      { wall: '#8a5140', roof: '#4a4038', trim: '#2f4a34', brick: 1, cupola: 1, chimneys: 1 },
  magazine:   { wall: '#96604a', roof: '#4a4038', trim: '#2f4a34', brick: 1, octagon: 1, chimneys: 0 },
  gaol:       { wall: '#8a5140', roof: '#3f3a34', trim: '#22252c', brick: 1, barred: 1, chimneys: 1 },
  farmhouse:  { wall: '#d8cfb8', roof: '#5a4a38', trim: '#4a5a3a', dormers: 2, chimneys: 2 },
  barn:       { wall: '#8c3f30', roof: '#3f3a34', trim: '#e6e0d2', chimneys: 0, dormers: 0 },
  saloon:     { wall: '#b09466', roof: '#4a4038', trim: '#5a3a24', chimneys: 1, dormers: 0 },
  depot:      { wall: '#7a6a4a', roof: '#44403a', trim: '#3a3a30', chimneys: 1, dormers: 0 },

  /* --- industrial / modern --- */
  bunker:     { wall: '#6e6e66', roof: '#4e4e48', trim: '#3a3a34', concrete: 1, chimneys: 0, dormers: 0, barred: 1 },
  ruin:       { wall: '#77706a', roof: '#3e3a36', trim: '#2e2c2a', concrete: 1, rubble: 1, chimneys: 1, dormers: 0 },
  tin:        { wall: '#9aa0a2', roof: '#6e7476', trim: '#4a5052', corrugated: 1, chimneys: 0, dormers: 0 },
  hut:        { wall: '#a68a56', roof: '#8a7238', trim: '#5a4a2a', thatch: 1, chimneys: 0, dormers: 0 },
  compound:   { wall: '#c2ac7e', roof: '#8a7a54', trim: '#6a5a3a', chimneys: 0, dormers: 0 },
  mosque:     { wall: '#cbb98c', roof: '#7a8a72', trim: '#5a6a52', cupola: 1, chimneys: 0, dormers: 0 },
  officeblk:  { wall: '#8e9298', roof: '#585c62', trim: '#3a3e44', concrete: 1, chimneys: 0, dormers: 0 },
  checkpoint: { wall: '#b0b4b8', roof: '#7a7e82', trim: '#c02a3a', concrete: 1, chimneys: 0, dormers: 0 },
  hospital:   { wall: '#dfe6e8', roof: '#8a9498', trim: '#3fa0b8', concrete: 1, chimneys: 0, dormers: 0 },
  warehouse:  { wall: '#7e8488', roof: '#5a6064', trim: '#3a4044', corrugated: 1, chimneys: 0, dormers: 0 },
  schoolbook: { wall: '#c8ab72', roof: '#6a5236', trim: '#8a3a2a', chimneys: 1, dormers: 2 },
  plaza:      { wall: '#b8b0a0', roof: '#6a6258', trim: '#4a4a44', concrete: 1, chimneys: 0, dormers: 0 },

  /* --- the mountain --- */
  /* `carved` short-circuits Art.building() entirely: no walls, no roof,
     no windows. `who` picks which face gets cut into the rock. */
  granitehead: { wall: '#8e8e88', roof: '#6e6e68', trim: '#55554e', carved: 1, chimneys: 0, dormers: 0 },
  granite:     { wall: '#84847e', roof: '#5e5e58', trim: '#46463f', concrete: 1, chimneys: 0, dormers: 0 }
};

/** Merge an archetype with a per-building override. */
function archetype(name, over) {
  return Object.assign({}, ARCHETYPES[name] || ARCHETYPES.brickhouse, over || {});
}

/* ------------------------------------------------------------
   3. HELPERS for laying a stage out

   Every stage is a road grid plus nine strongpoints. `road()` and
   `plot()` keep the data terse and consistent instead of 99 blocks
   of hand-written rectangles.
   ------------------------------------------------------------ */
function road(x, y, w, h, kind) { return { x, y, w, h, kind: kind || 'street' }; }

/**
 * One strongpoint. `tier` (0-8) drives garrison strength, boss health
 * and the recommended level; it is also the intended clear order.
 */
function plot(id, name, sub, arch, x, y, w, h, tier, over) {
  const a = archetype(arch, over);
  return Object.assign({
    id, name, sub, arch,
    x, y, w, h, elev: Math.round(h * 0.95),
    tier, lvl: STRONGPOINT_LEVELS[tier]
  }, a);
}

/** Recommended player level per tier — shared by every stage. */
const STRONGPOINT_LEVELS = [6, 14, 22, 30, 40, 50, 60, 72, 88];

/* ============================================================
   THE CAMPAIGN

   Chronological. Each stage names the president most associated with
   it. That is a DEFAULT and a highlight on the campaign map, not a
   restriction — any president can be taken into any stage, because
   forcing Lincoln on Gettysburg would throw away the eleven other
   builds the arsenal system exists to create.
   ============================================================ */
const STAGES = [

  /* ---------------------------------------------------------- 1 */
  {
    id: 'williamsburg', no: 1, name: 'COLONIAL WILLIAMSBURG', year: '1781',
    president: 'washington', palette: 'colonial',
    blurb: 'Nine armies have dug into the restored capital of Virginia. Duke of Gloucester Street is a shooting gallery.',
    w: 3400, h: 2300, start: { x: 620, y: 1680 },
    zones: [
      road(120, 1180, 3160, 180), road(1120, 560, 230, 640, 'green'),
      road(900, 830, 2100, 120), road(500, 1620, 2300, 120),
      road(1450, 1080, 480, 460, 'dirt')
    ],
    factions: ['crown'],
    minis: ['crier', 'bootsergeant'],
    bosses: ['ferguson', 'tarleton', 'andre', 'arnold', 'graves',
             'phillips', 'rawdon', 'cornwallis2', 'georgeiii'],
    /* HIDDEN ROSTER UNLOCK. Walk into it — it is not on the minimap and
       nothing points at it. The lectern prop at the same spot is the only
       tell, which is the point: a marked secret is not a secret.

       Behind the Wren Building because that is the College of William &
       Mary, where Jefferson actually studied. It sits by the first
       strongpoint in the game, so the reward for wandering off the
       street is available on the run you are most likely to wander on. */
    secret: {
      unlocks: 'jefferson', x: 250, y: 880, r: 46,
      title: 'A LOCKED CASE',
      sub: 'Left in the college garden. The hand inside is unmistakable.'
    },
    props: [
      { x: 250, y: 880, kind: 'lectern' },
      { x: 300, y: 1330, kind: 'flag_uk' }, { x: 1000, y: 1120, kind: 'flag_uk' },
      { x: 1640, y: 1100, kind: 'flag_uk' }, { x: 1680, y: 1550, kind: 'flag_uk' },
      { x: 1400, y: 800, kind: 'flag_uk' },  { x: 2320, y: 1120, kind: 'flag_uk' },
      { x: 1240, y: 520, kind: 'flag_uk' },  { x: 2810, y: 750, kind: 'flag_uk' },
      { x: 3050, y: 1300, kind: 'flag_uk' },
      { x: 760, y: 1240, kind: 'cannon' },   { x: 1900, y: 1300, kind: 'cannon' },
      { x: 1500, y: 1250, kind: 'muskets' }, { x: 2500, y: 1240, kind: 'tent' },
      { x: 900, y: 1420, kind: 'tent' },     { x: 2100, y: 1420, kind: 'barricade' }
    ],
    buildings: [
      plot('wren', 'THE WREN BUILDING', 'College of William & Mary, 1695 — the oldest college building in America.', 'brickhouse', 170, 1150, 250, 130, 0, { wall: '#9a5a48', cupola: 1 }),
      plot('bruton', 'BRUTON PARISH CHURCH', 'Built 1715. The bell rang for independence.', 'church', 880, 980, 170, 120, 1),
      plot('courthouse', 'THE COURTHOUSE', 'Market Square, 1770. Public trials, public stocks, public opinion.', 'civic', 1520, 960, 200, 120, 2),
      plot('magazine', 'THE MAGAZINE', 'Octagonal powder magazine, 1715. Emptying it nearly started the war early.', 'magazine', 1610, 1400, 130, 130, 3),
      plot('randolph', 'PEYTON RANDOLPH HOUSE', 'Home of the first President of the Continental Congress.', 'brickhouse', 1290, 660, 200, 120, 4, { wall: '#8c4a3c', trim: '#e6e0d2' }),
      plot('raleigh', 'THE RALEIGH TAVERN', 'Where the burgesses met after the Governor dissolved them. Repeatedly.', 'clapboard', 2200, 980, 230, 120, 5),
      plot('palace', "THE GOVERNOR'S PALACE", 'Seat of royal authority in Virginia. Seven governors, then none.', 'brickhouse', 1080, 350, 300, 160, 6, { cupola: 1, dormers: 5, trim: '#e6e0d2' }),
      plot('gaol', 'THE PUBLIC GAOL', "Held debtors, runaways, and fifteen of Blackbeard's crew.", 'gaol', 2720, 620, 170, 110, 7),
      plot('capitol', 'THE CAPITOL', 'Where Patrick Henry spoke against the Stamp Act. The King has taken it back.', 'civic', 2900, 1130, 280, 150, 8, { dormers: 4, trim: '#e6e0d2' })
    ],
    boss: 'georgeiii'
  },

  /* ---------------------------------------------------------- 2 */
  {
    id: 'gettysburg', no: 2, name: 'GETTYSBURG', year: '1863',
    president: 'lincoln', palette: 'civilwar',
    blurb: 'Three days that did not end. The dead of both armies are still holding the high ground.',
    w: 3600, h: 2600, start: { x: 500, y: 2200 },
    zones: [
      road(200, 1900, 3200, 150), road(1500, 400, 150, 1600),
      road(300, 900, 2600, 130), road(2400, 1000, 140, 1100, 'dirt'),
      road(1250, 1750, 520, 420, 'dirt')
    ],
    factions: ['csa'],
    minis: ['picketman', 'bootsergeant'],
    bosses: ['heth', 'early', 'ewell', 'hood', 'mclaws',
             'stuart', 'pickett', 'longstreet', 'lee'],
    /* Hidden roster unlock — see the note on stage 1. Grant was NOT at
       Gettysburg; he was a thousand miles away taking Vicksburg, which
       surrendered the day after Pickett's Charge failed. The case is his
       all the same, and the flavour text says so rather than pretending
       he was on this field. */
    secret: {
      unlocks: 'grant', x: 3320, y: 2380, r: 46,
      title: 'A FIELD CASE',
      sub: 'He was at Vicksburg that week. It fell the day after the charge failed.'
    },
    props: [
      { x: 3320, y: 2380, kind: 'fieldcase' },
      { x: 370, y: 1940, kind: 'flag_csa' },  { x: 1010, y: 1780, kind: 'flag_csa' },
      { x: 1350, y: 2280, kind: 'flag_csa' }, { x: 2160, y: 2340, kind: 'flag_csa' },
      { x: 2730, y: 2080, kind: 'flag_csa' }, { x: 1850, y: 1580, kind: 'flag_csa' },
      { x: 2850, y: 1330, kind: 'flag_csa' }, { x: 1020, y: 780, kind: 'flag_csa' },
      { x: 2050, y: 580, kind: 'flag_csa' },
      { x: 700, y: 1960, kind: 'flag_csa' },  { x: 1600, y: 1960, kind: 'flag_csa' },
      { x: 2400, y: 1960, kind: 'flag_csa' }, { x: 1560, y: 900, kind: 'flag_csa' },
      { x: 1560, y: 1400, kind: 'flag_csa' },
      { x: 850, y: 1930, kind: 'cannon' },    { x: 1800, y: 1930, kind: 'cannon' },
      { x: 2500, y: 1930, kind: 'cannon' },   { x: 1200, y: 1990, kind: 'muskets' },
      { x: 2000, y: 2020, kind: 'muskets' },  { x: 600, y: 2050, kind: 'tent' },
      { x: 1450, y: 2050, kind: 'tent' },     { x: 2650, y: 1870, kind: 'barricade' },
      { x: 1700, y: 1870, kind: 'barricade' }
    ],
    buildings: [
      plot('mcpherson', "McPHERSON'S BARN", 'First day. The line broke here before it broke anywhere else.', 'barn', 260, 1860, 220, 130, 0),
      plot('seminary', 'LUTHERAN SEMINARY', 'Its cupola was the best observation post on the field. Both sides used it.', 'civic', 900, 1700, 210, 130, 1, { wall: '#c9b98e', brick: 1 }),
      plot('peachorchard', 'THE PEACH ORCHARD', 'Sickles advanced without orders. The orchard is what was left.', 'farmhouse', 1250, 2200, 200, 120, 2),
      plot('devilsden', "DEVIL'S DEN", 'A jumble of boulders that swallowed a regiment.', 'ruin', 2050, 2260, 230, 140, 3, { wall: '#8a8278', rubble: 1 }),
      plot('littleround', 'LITTLE ROUND TOP', 'Chamberlain fixed bayonets and charged downhill. It worked.', 'ruin', 2600, 2000, 260, 150, 4, { wall: '#7e7a70' }),
      plot('wheatfield', 'THE WHEATFIELD', 'Changed hands six times in four hours.', 'farmhouse', 1750, 1500, 200, 120, 5),
      plot('spanglers', "SPANGLER'S SPRING", 'The only water on the line. Both armies drank from it at night.', 'barn', 2750, 1250, 200, 120, 6),
      plot('culpshill', "CULP'S HILL", 'Held all night with breastworks and stubbornness.', 'ruin', 900, 700, 240, 140, 7, { wall: '#74706a' }),
      plot('cemeteryridge', 'CEMETERY RIDGE', "The high-water mark. Pickett's men reached the wall and no further.", 'civic', 1900, 500, 300, 160, 8, { wall: '#b8ab86', brick: 1, cupola: 1 })
    ],
    boss: 'genlee'
  },

  /* ---------------------------------------------------------- 3 */
  {
    id: 'west', no: 3, name: 'THE EXPANDING WEST', year: '1898',
    president: 'teddy', palette: 'frontier',
    blurb: 'A territorial boom town at the end of the frontier, garrisoned by the Spanish colonial army that never sailed home.',
    w: 3200, h: 2400, start: { x: 520, y: 1300 },
    zones: [
      road(150, 1200, 2900, 200), road(1400, 300, 180, 900),
      road(1400, 1400, 180, 900), road(700, 1850, 1900, 140),
      road(1150, 1050, 500, 420, 'dirt')
    ],
    factions: ['colonial', 'plains'],
    minis: ['railbaron', 'cornetero'],
    bosses: ['linares', 'torral', 'varadelrey', 'cervera', 'quanah',
             'victorio', 'lozen', 'blanco', 'weyler'],
    props: [
      { x: 330, y: 1060, kind: 'flag_spain' }, { x: 990, y: 1520, kind: 'flag_spain' },
      { x: 1770, y: 1020, kind: 'flag_spain' }, { x: 2320, y: 1520, kind: 'flag_spain' },
      { x: 1250, y: 670, kind: 'flag_spain' },  { x: 2600, y: 780, kind: 'flag_spain' },
      { x: 610, y: 1970, kind: 'flag_spain' },  { x: 2580, y: 2020, kind: 'flag_spain' },
      { x: 1450, y: 280, kind: 'flag_spain' },
      { x: 800, y: 1280, kind: 'cannon' },      { x: 2000, y: 1280, kind: 'barricade' },
      { x: 1300, y: 1320, kind: 'tent' },       { x: 1900, y: 1900, kind: 'tent' }
    ],
    buildings: [
      plot('assayoffice', 'THE ASSAY OFFICE', 'Where a claim became a fortune, or more often did not.', 'saloon', 220, 1000, 210, 120, 0),
      plot('watertower', 'THE WATER TOWER', 'The only reason the town exists at this particular spot.', 'depot', 900, 1450, 160, 130, 1),
      plot('saloon', 'THE LAST CHANCE SALOON', 'Named optimistically. Accurately, as it turned out.', 'saloon', 1650, 950, 230, 120, 2),
      plot('livery', 'THE LIVERY STABLE', 'Forty horses, and every one of them still here.', 'barn', 2200, 1450, 220, 130, 3),
      plot('telegraph', 'THE TELEGRAPH OFFICE', 'Still clicking. Nobody is sending.', 'depot', 1150, 600, 180, 110, 4),
      plot('mission', 'THE OLD MISSION', 'Spanish, 1698. Older than the town by two centuries.', 'church', 2500, 700, 190, 130, 5, { wall: '#cbb98c' }),
      plot('minehead', 'THE MINE HEAD', 'The shaft goes down four hundred feet. Something came back up.', 'tin', 500, 1900, 220, 130, 6),
      plot('railhead', 'THE RAILHEAD', 'End of track. The line was supposed to keep going.', 'depot', 2450, 1950, 260, 140, 7),
      plot('garrison', 'THE SPANISH GARRISON', 'Surrendered at Santiago in 1898. Nobody told this detachment.', 'compound', 1300, 200, 300, 160, 8)
    ],
    boss: 'elgobernador'
  },

  /* ---------------------------------------------------------- 4 */
  {
    id: 'wwii', no: 4, name: 'THE WESTERN FRONT', year: '1944',
    president: 'fdr', palette: 'wwii',
    blurb: 'A Norman town taken, lost and taken again. The Wehrmacht is still holding every building it fortified.',
    w: 3600, h: 2400, start: { x: 480, y: 1900 },
    zones: [
      road(150, 1750, 3300, 170), road(1200, 300, 170, 1500),
      road(2300, 500, 170, 1300), road(600, 900, 1700, 140),
      road(1450, 1300, 700, 400, 'dirt')
    ],
    factions: ['reich'],
    minis: ['ironsgt', 'drager'],
    bosses: ['meyer', 'peiper', 'dietrich', 'rundstedt', 'rommel',
             'goring', 'himmler', 'bormann', 'hitler'],
    /* Hidden roster unlock. He planned this beach. */
    secret: {
      unlocks: 'eisenhower', x: 3330, y: 2180, r: 46,
      title: 'A FIELD CASE',
      sub: 'Inside, a note taking the whole blame for a landing that had not happened yet.'
    },
    props: [
      { x: 3330, y: 2180, kind: 'fieldcase' },
      { x: 340, y: 1660, kind: 'flag_reich' }, { x: 910, y: 1420, kind: 'flag_reich' },
      { x: 1590, y: 1120, kind: 'flag_reich' }, { x: 2365, y: 1420, kind: 'flag_reich' },
      { x: 3030, y: 1680, kind: 'flag_reich' }, { x: 820, y: 770, kind: 'flag_reich' },
      { x: 2625, y: 870, kind: 'flag_reich' },  { x: 1490, y: 570, kind: 'flag_reich' },
      { x: 3050, y: 370, kind: 'flag_reich' },
      { x: 700, y: 1820, kind: 'barricade' },   { x: 1800, y: 1820, kind: 'barricade' },
      { x: 2600, y: 1820, kind: 'cannon' },     { x: 1200, y: 1700, kind: 'cannon' },
      { x: 2000, y: 1500, kind: 'tent' }
    ],
    buildings: [
      plot('hedgerow', 'THE HEDGEROW LINE', 'Bocage. Every field is a fortress and there are ten thousand fields.', 'ruin', 220, 1600, 240, 130, 0, { wall: '#6a7256' }),
      plot('farm', 'THE STONE FARM', 'Changed hands four times before breakfast.', 'farmhouse', 800, 1350, 220, 130, 1, { wall: '#b8b0a0' }),
      plot('church', 'THE CHURCH TOWER', 'A paratrooper hung from this steeple for two hours pretending to be dead.', 'church', 1500, 1050, 180, 130, 2, { wall: '#a89e8a' }),
      plot('crossroads', 'THE CROSSROADS', 'Whoever holds it holds the road, and the road is the campaign.', 'ruin', 2250, 1350, 230, 130, 3),
      plot('batterie', 'THE COASTAL BATTERY', 'Four 155mm guns in six feet of reinforced concrete.', 'bunker', 2900, 1600, 260, 150, 4),
      plot('depot', 'THE FUEL DEPOT', 'The entire advance stops without it. So does theirs.', 'warehouse', 700, 700, 240, 130, 5),
      plot('rail', 'THE MARSHALLING YARD', 'Bombed eleven times. Repaired eleven times.', 'depot', 2500, 800, 250, 140, 6),
      plot('chateau', 'THE CHÂTEAU', 'Divisional headquarters. The maps are still on the table.', 'brickhouse', 1350, 500, 280, 150, 7, { wall: '#c0b49a', dormers: 5, cupola: 1 }),
      plot('bunker', 'THE COMMAND BUNKER', 'Twelve metres down. They never got the surrender order.', 'bunker', 2900, 300, 300, 160, 8)
    ],
    boss: 'feldmarschall'
  },

  /* ---------------------------------------------------------- 5 */
  {
    id: 'dallas', no: 5, name: 'DALLAS', year: '1962',
    president: 'jfk', palette: 'sixties',
    blurb: 'The Missile Crisis went differently here. Soviet forward elements hold the city block by block.',
    w: 3200, h: 2200, start: { x: 500, y: 1750 },
    zones: [
      road(100, 1650, 3000, 180), road(900, 300, 180, 1400),
      road(1900, 300, 180, 1400), road(400, 800, 2400, 150),
      road(1080, 1100, 820, 400, 'dirt')
    ],
    factions: ['coldwar', 'redarmy'],
    minis: ['commissar', 'ironsgt', 'lobbyist'],
    buildings: [
      plot('drivein', 'THE DRIVE-IN', 'Still showing. Nobody has left their car since 1962.', 'tin', 200, 1400, 230, 120, 0),
      plot('diner', 'THE BLUE BONNET DINER', 'Open twenty-four hours, as advertised.', 'tin', 700, 1250, 200, 120, 1, { wall: '#c8d8dc', trim: '#c02a3a' }),
      plot('school', 'THE HIGH SCHOOL', 'Duck-and-cover drills every Tuesday. It did not help.', 'schoolbook', 1200, 900, 240, 130, 2),
      plot('fallout', 'THE FALLOUT SHELTER', 'Stocked for two weeks. It has been considerably longer.', 'bunker', 2100, 1300, 210, 130, 3),
      plot('motel', 'THE STARLITE MOTEL', 'Vacancy.', 'tin', 2600, 1000, 240, 120, 4, { wall: '#d8c8a8' }),
      plot('refinery', 'THE REFINERY', 'The reason anyone is fighting over Texas at all.', 'warehouse', 400, 400, 260, 140, 5),
      plot('bank', 'THE REPUBLIC BANK', 'Forty storeys of green glass, and a vault nobody can open.', 'officeblk', 1500, 400, 250, 150, 6),
      plot('airbase', 'CARSWELL AIR BASE', 'Strategic Air Command. The alert birds never launched.', 'bunker', 2500, 500, 280, 150, 7),
      plot('cityhall', 'CITY HALL', 'The last building holding out, and the one they wanted most.', 'plaza', 2750, 1700, 300, 160, 8)
    ],
    boss: 'premier'
  },

  /* ---------------------------------------------------------- 6 */
  {
    id: 'vietnam', no: 6, name: 'THE CENTRAL HIGHLANDS', year: '1968',
    president: 'nixon', palette: 'jungle',
    blurb: 'A firebase and the valley below it. The North Vietnamese Army holds the treeline, and the treeline is everywhere.',
    w: 3400, h: 2600, start: { x: 1700, y: 500 },
    zones: [
      road(1550, 300, 300, 500, 'dirt'), road(300, 1300, 2900, 160),
      road(1600, 800, 150, 1700), road(700, 2000, 2000, 140),
      road(2400, 1450, 140, 1000)
    ],
    factions: ['nva', 'jungle'],
    minis: ['tunnelrat', 'divinewind', 'drager'],
    buildings: [
      plot('lz', 'LANDING ZONE BRAVO', 'One helicopter wide. Everything comes through here.', 'tin', 1500, 750, 240, 130, 0),
      plot('wire', 'THE WIRE', 'Three belts of concertina and a minefield. Insufficient.', 'bunker', 950, 1150, 220, 120, 1),
      plot('village', 'THE VILLAGE', 'Empty since 1965. The wells still work.', 'hut', 500, 1600, 230, 120, 2),
      plot('rubber', 'THE RUBBER PLANTATION', 'French, 1923. Perfectly straight rows in every direction.', 'hut', 1900, 1650, 240, 130, 3),
      plot('tunnels', 'THE TUNNEL COMPLEX', 'Four levels, a hospital and a kitchen. Nobody has mapped it.', 'bunker', 2500, 1500, 220, 130, 4),
      plot('bridge', 'THE BRIDGE', 'Dropped twice, rebuilt twice, dropped again.', 'ruin', 2900, 1000, 240, 130, 5),
      plot('temple', 'THE TEMPLE', 'Twelfth century. Both sides agreed not to shell it, then shelled it.', 'mosque', 700, 2200, 230, 140, 6, { wall: '#9aa07e' }),
      plot('fsb', 'FIRE SUPPORT BASE', 'Six 105mm howitzers on a hilltop, firing outward in every direction.', 'bunker', 2700, 2150, 260, 150, 7),
      plot('hilltop', 'HILL 937', 'Taken at enormous cost and abandoned a week later.', 'ruin', 1450, 2250, 300, 160, 8)
    ],
    boss: 'thegeneral'
  },

  /* ---------------------------------------------------------- 7 */
  {
    id: 'berlin', no: 7, name: 'BERLIN', year: '1987', president: 'reagan',
    palette: 'coldwar',
    blurb: 'The Wall runs the length of the map. Everything on the far side is still garrisoned.',
    w: 3600, h: 2200, start: { x: 500, y: 1700 },
    zones: [
      road(0, 1050, 3600, 120, 'dirt'),
      road(150, 1600, 3300, 170), road(1000, 1200, 170, 800),
      road(2400, 1200, 170, 800), road(600, 300, 2400, 150)
    ],
    factions: ['stasi', 'redarmy'],
    minis: ['commissar', 'ironsgt', 'mothersgt'],
    /* Hidden roster unlock, on the apron at Tempelhof — already a
       strongpoint on this stage, and it already says what happened there. */
    secret: {
      unlocks: 'truman', x: 1430, y: 1990, r: 46,
      title: 'A FIELD CASE',
      sub: 'Left on the apron at Tempelhof. Two million tons came through here.'
    },
    props: [
      { x: 1430, y: 1990, kind: 'fieldcase' }
    ],
    buildings: [
      plot('checkpointc', 'CHECKPOINT CHARLIE', 'You are leaving the American sector.', 'checkpoint', 250, 1400, 220, 120, 0),
      plot('kudamm', 'THE KURFÜRSTENDAMM', 'Neon, department stores, and a bombed church left standing as a reminder.', 'officeblk', 800, 1750, 230, 130, 1),
      plot('tempelhof', 'TEMPELHOF', 'The airlift landed here every ninety seconds for eleven months.', 'warehouse', 1500, 1700, 270, 140, 2),
      plot('reichstag', 'THE REICHSTAG', 'Burned in 1933, shelled in 1945, empty ever since.', 'plaza', 1250, 1200, 260, 140, 3),
      plot('watchtower', 'WATCHTOWER 47', 'Two guards, one searchlight, and standing orders.', 'checkpoint', 2100, 1300, 180, 130, 4),
      plot('deathstrip', 'THE DEATH STRIP', 'Raked sand, so footprints show. There are a great many footprints.', 'bunker', 2600, 1400, 240, 130, 5),
      plot('stasihq', 'STASI HEADQUARTERS', 'One informant for every 6.5 citizens. The files fill 111 kilometres of shelving.', 'officeblk', 2900, 1750, 260, 140, 6),
      plot('brandenburg', 'THE BRANDENBURG GATE', 'Mr Gorbachev.', 'plaza', 1700, 400, 300, 150, 7),
      plot('palast', 'PALAST DER REPUBLIK', 'Bronze glass, asbestos, and the People\'s Chamber.', 'officeblk', 2800, 350, 300, 160, 8)
    ],
    boss: 'generalsekretar'
  },

  /* ---------------------------------------------------------- 8 */
  {
    id: 'iraq', no: 8, name: 'THE ROAD TO BAGHDAD', year: '2003',
    president: 'bush43', palette: 'desert',
    blurb: 'Highway 8, and the Republican Guard divisions that were reported destroyed.',
    w: 3800, h: 2200, start: { x: 400, y: 1100 },
    zones: [
      road(0, 1000, 3800, 220), road(1200, 200, 180, 800),
      road(1200, 1220, 180, 900), road(2600, 200, 180, 800),
      road(800, 1500, 2200, 150)
    ],
    factions: ['republican', 'revguard'],
    minis: ['mothersgt', 'ironsgt', 'lobbyist'],
    buildings: [
      plot('checkpoint', 'THE CHECKPOINT', 'Sandbags, a chicane, and a very long queue.', 'checkpoint', 200, 1300, 220, 120, 0, { wall: '#c8b88a' }),
      plot('palmgrove', 'THE PALM GROVE', 'Irrigated for six thousand years. Excellent cover.', 'hut', 800, 700, 230, 120, 1),
      plot('bridge8', 'HIGHWAY 8 BRIDGE', 'The only crossing for forty kilometres.', 'ruin', 1500, 1350, 250, 130, 2),
      plot('barracks', 'THE BARRACKS', 'Abandoned in good order. Boots still lined up.', 'compound', 2100, 700, 240, 130, 3),
      plot('mosque', 'THE GREAT MOSQUE', 'Nobody wants to be the one who damages it.', 'mosque', 1700, 300, 240, 140, 4),
      plot('oilhead', 'THE WELLHEAD', 'Wired to burn. Everything here is wired to burn.', 'warehouse', 2900, 1350, 250, 140, 5),
      plot('airfield', 'THE AIRFIELD', 'Runway cratered, hardened shelters intact.', 'bunker', 3200, 700, 260, 150, 6),
      plot('palace', 'THE PRESIDENTIAL PALACE', 'Marble, gold taps, and a bunker underneath the swimming pool.', 'plaza', 2500, 1650, 300, 160, 7, { wall: '#d8c898' }),
      plot('greenzone', 'THE GREEN ZONE', 'Ten square kilometres behind twelve-foot blast walls.', 'bunker', 3350, 1500, 300, 160, 8)
    ],
    boss: 'thedeck'
  },

  /* ---------------------------------------------------------- 9 */
  {
    id: 'afghanistan', no: 9, name: 'THE KORENGAL', year: '2010',
    president: 'obama', palette: 'mountain',
    blurb: 'A valley six miles long that took ten years and was handed back.',
    w: 3000, h: 2800, start: { x: 1500, y: 400 },
    zones: [
      road(1350, 200, 300, 500, 'dirt'), road(400, 900, 2300, 150),
      road(1400, 1050, 160, 1500), road(300, 1900, 2400, 150),
      road(2200, 1050, 150, 900)
    ],
    factions: ['holdouts', 'mountain'],
    minis: ['ridgerunner', 'divinewind', 'drager'],
    buildings: [
      plot('cop', 'COMBAT OUTPOST', 'Sandbags, HESCO barriers, and a view of nothing but ridgeline.', 'bunker', 1350, 650, 240, 130, 0),
      plot('village', 'THE VILLAGE', 'Mud brick, four hundred years old, holds a mortar round fine.', 'compound', 700, 1150, 230, 120, 1),
      plot('terraces', 'THE TERRACES', 'Wheat, on slopes at forty degrees. Farmed since Alexander.', 'hut', 1900, 1250, 220, 120, 2),
      plot('sawmill', 'THE SAWMILL', 'Timber is the valley\'s only export and the reason for half the fighting.', 'tin', 500, 1650, 230, 130, 3),
      plot('bridgek', 'THE RIVER CROSSING', 'Snowmelt. Waist deep in April, impassable in May.', 'ruin', 1500, 1750, 240, 130, 4),
      plot('madrassa', 'THE MADRASSA', 'The only building in the valley with a second storey.', 'mosque', 2250, 1700, 230, 140, 5),
      plot('cave', 'THE CAVE COMPLEX', 'Dug by hand, deepened with Soviet explosives, never fully cleared.', 'ruin', 400, 2300, 250, 140, 6),
      plot('ridge', 'ABBAS GHAR RIDGE', 'Nine thousand feet. Whoever holds it sees the whole valley.', 'bunker', 2400, 2350, 270, 150, 7),
      plot('pass', 'THE PASS', 'The only way in, and the only way out.', 'compound', 1350, 2400, 300, 160, 8)
    ],
    boss: 'themullah'
  },

  /* ---------------------------------------------------------- 10 */
  {
    id: 'pandemic', no: 10, name: 'WUHAN', year: '2020',
    president: 'biden', palette: 'pandemic',
    blurb: 'Where it started. Eleven million people, a sealed city, and an institute on the far side of the river.',
    // Hostile projectiles are virions on this stage rather than energy
    // bolts. Flavour only — same speed, damage and radius as everywhere.
    shot: 'virion',
    w: 3400, h: 2400, start: { x: 520, y: 1300 },
    zones: [
      road(100, 1200, 3200, 200), road(1100, 300, 180, 900),
      road(2200, 300, 180, 900), road(1100, 1400, 180, 900),
      road(2200, 1400, 180, 900), road(600, 700, 2200, 140),
      road(600, 1800, 2200, 140)
    ],
    factions: ['variants', 'combined'],
    minis: ['superspreader', 'lobbyist', 'mothersgt'],
    buildings: [
      plot('market', 'THE WET MARKET', 'Six hundred stalls, hosed down every night, and closed on the first of January.', 'tin', 200, 1450, 220, 120, 0, { wall: '#dfe6e8' }),
      plot('hankou', 'HANKOU STATION', 'Three hundred thousand people left through here before the trains stopped.', 'depot', 750, 950, 220, 120, 1),
      plot('block', 'THE SEALED BLOCK', 'Welded shut from the outside. Groceries come up on a rope.', 'officeblk', 1400, 900, 240, 130, 2),
      plot('tendays', 'THE TEN-DAY HOSPITAL', 'A thousand beds on a field that was mud a week and a half ago.', 'hospital', 2400, 950, 260, 140, 3),
      plot('jinyintan', 'THE INFECTIOUS DISEASES HOSPITAL', 'Took the first forty-one cases. Nobody there had a name for it yet.', 'hospital', 1500, 1500, 250, 140, 4),
      plot('bridge', 'THE YANGTZE BRIDGE', 'A mile of empty deck, and a checkpoint at each end.', 'plaza', 2500, 1550, 270, 150, 5),
      plot('coldchain', 'THE COLD CHAIN DEPOT', 'Minus seventy degrees. Something in here should not be viable, and is.', 'warehouse', 700, 1900, 250, 140, 6),
      plot('sequencing', 'THE SEQUENCING LAB', 'Read the whole genome in a weekend, then spent a month being told not to publish it.', 'hospital', 2900, 1900, 260, 150, 7),
      plot('institute', 'THE INSTITUTE', 'Biosafety level four. The freezer logs stop on the last day of the year.', 'bunker', 1400, 2100, 300, 160, 8)
    ],
    /* Tiers 0-6 come from the faction pool; these two are named. PATIENT
       ZERO keeps its place on the ladder one rung below the Institute. */
    bosses: { 7: 'omicron' },
    boss: 'wiv'
  },

  /* ---------------------------------------------------------- 11 */
  {
    id: 'iran', no: 11, name: 'THE STRAIT', year: '2026',
    president: 'trump', palette: 'arid',
    blurb: 'A port on the Strait of Hormuz, held by the Revolutionary Guard and everything they have ever bought.',
    w: 3600, h: 2400, start: { x: 500, y: 1200 },
    zones: [
      road(100, 1100, 3400, 200), road(1300, 300, 180, 800),
      road(2400, 1300, 180, 900), road(700, 1800, 2200, 150),
      road(1500, 1350, 700, 400, 'dirt')
    ],
    factions: ['revguard', 'republican'],
    minis: ['mothersgt', 'lobbyist', 'ridgerunner'],
    buildings: [
      plot('dock', 'THE FISHING DOCK', 'Dhows, nets, and a great deal more radio equipment than fishing requires.', 'tin', 200, 1400, 220, 120, 0),
      plot('bazaar', 'THE BAZAAR', 'Four hundred stalls under one roof. Excellent for an ambush.', 'compound', 850, 800, 240, 130, 1),
      plot('refinery', 'THE REFINERY', 'Twelve percent of the world\'s oil passes within sight of it.', 'warehouse', 1600, 750, 250, 140, 2),
      plot('missile', 'THE MISSILE BATTERY', 'Anti-ship, road-mobile, and currently not mobile.', 'bunker', 2500, 800, 230, 130, 3),
      plot('garrison', 'THE GARRISON', 'Barracks for two thousand. Occupied by considerably more.', 'compound', 1000, 1500, 240, 130, 4),
      plot('boatyard', 'THE FAST BOAT YARD', 'Forty hulls, each with a machine gun bolted where the seats were.', 'warehouse', 2900, 1500, 250, 140, 5),
      plot('mosqueh', 'THE FRIDAY MOSQUE', 'Fourteenth century, blue tile, and a very modern basement.', 'mosque', 1900, 1900, 240, 140, 6),
      plot('nuclear', 'THE ENRICHMENT SITE', 'Eighty metres of granite on top of it.', 'bunker', 3150, 2000, 270, 150, 7),
      plot('hq', 'GUARD HEADQUARTERS', 'Answers to nobody in the government, and knows it.', 'plaza', 600, 2050, 300, 160, 8)
    ],
    boss: 'thecommander'
  },

  /* ---------------------------------------------------------- 12
     THE FINALE.

     Four heads as the last four strongpoints, and behind Lincoln the
     Hall of Records — the chamber Borglum actually cut in 1938 to hold
     the Declaration, the Constitution and the Bill of Rights so that
     whoever came next would know who was on the mountain. He got
     eighteen feet in and died, and it sat open and empty until 1998.
     Nothing here is invented; it is the most useful true thing on the
     mountain and it is where the campaign ends.

     The nine are held by the commanders of the first eight stages, in
     campaign order, so the ladder replays the whole war before the
     last door. `allies` puts the other carved presidents on the field
     beside whoever you brought.
     ---------------------------------------------------------- */
  {
    id: 'rushmore', no: 12, name: 'MOUNT RUSHMORE', year: '1941',
    president: 'washington', palette: 'blackhills',
    blurb: 'Every army you have beaten is on the mountain. Behind Lincoln there is a room that was never finished, and something has finished it.',
    note: 'The Black Hills are Lakota land, guaranteed by treaty in 1868 and taken in 1877. The Supreme Court said so in 1980. The award has never been accepted.',
    allies: ['washington', 'lincoln', 'teddy'],
    w: 3400, h: 2400, start: { x: 500, y: 2050 },
    zones: [
      road(1450, 700, 260, 1500),                 // the Avenue of Flags
      road(300, 1850, 2800, 200),                 // the approach road
      road(700, 1250, 2000, 160, 'dirt'),         // the talus trail
      road(600, 620, 2200, 120, 'dirt')           // the ledge under the faces
    ],
    factions: ['combined', 'redarmy'],
    minis: ['ursa', 'mothersgt', 'lobbyist'],
    buildings: [
      plot('studio', "THE SCULPTOR'S STUDIO", 'Plaster models at one-twelfth scale. The mountain was carved from these.', 'depot', 300, 1950, 230, 120, 0),
      plot('flags', 'THE AVENUE OF FLAGS', 'Fifty-six flags. Nothing is flying straight any more.', 'plaza', 1420, 1600, 260, 130, 1),
      plot('talus', 'THE TALUS SLOPE', 'Four hundred thousand tons of granite blasted off the front and left where it fell.', 'granite', 2600, 1750, 250, 140, 2),
      plot('hoist', 'THE HOIST HOUSE', 'The tramway to the top. One cable, one bucket, five hundred feet.', 'tin', 850, 1300, 220, 120, 3),
      plot('washington', "WASHINGTON'S HEAD", 'Dedicated 1930. Sixty feet from chin to brow.', 'granitehead', 620, 480, 300, 210, 4, { who: 'washington' }),
      plot('jefferson', "JEFFERSON'S HEAD", 'Started on Washington\'s right, blasted off, and begun again on his left.', 'granitehead', 1180, 430, 300, 210, 5, { who: 'jefferson' }),
      plot('roosevelt', "ROOSEVELT'S HEAD", 'The last one finished, and the deepest set into the rock.', 'granitehead', 1760, 450, 300, 210, 6, { who: 'roosevelt' }),
      plot('lincoln', "LINCOLN'S HEAD", 'Dedicated 1937. The beard is eighteen feet of granite.', 'granitehead', 2340, 470, 300, 210, 7, { who: 'lincoln' }),
      plot('hall', 'THE HALL OF RECORDS', 'Eighteen feet into the canyon wall, then nothing. It was meant to explain us.', 'granite', 2680, 180, 320, 170, 8)
    ],
    /* The first eight stages' commanders, in the order you met them. */
    bosses: ['georgeiii', 'genlee', 'elgobernador', 'feldmarschall',
             'premier', 'thegeneral', 'generalsekretar', 'thedeck'],
    boss: 'theunfinished'
  }
];


/** id -> stage, and a stable index. */
const STAGE_BY_ID = {};
for (let i = 0; i < STAGES.length; i++) {
  STAGES[i].index = i;
  STAGE_BY_ID[STAGES[i].id] = STAGES[i];
}

/** Every archetype a stage uses, for pre-warming its sprites. */
function stageArchetypes(stage) {
  const set = new Set();
  for (const b of stage.buildings) set.add(b.arch);
  return [...set];
}

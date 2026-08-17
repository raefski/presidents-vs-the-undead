/* ============================================================
   enemies.js — nine undead armies.

   These no longer arrive on a timer. All nine are already dug into
   Colonial Williamsburg when the stage starts, one army per building
   (see world.js). Each faction supplies the garrison for its
   strongpoint, the boss who holds it, and the roaming troops that fill
   the streets once you've taken it.

   These are historical *military forces*, reanimated. The joke is the
   uniform, not the people who wore it.

   TUNING NOTES
     hp   : base health. The spawner multiplies it — by strongpoint tier
            for garrisons, by strongpoints-cleared for roamers.
     dmg  : damage per contact; each enemy has its own 0.55s touch cooldown.
     speed: world units/sec. The player's baseline is 62.
     ai   : see updateEnemies() in entities.js for what each behavior does.
   ============================================================ */

const FACTIONS = [
  /* ---------------------------------------------------------- 0:00 */
  {
    id: 'whiskey', minute: 0,
    name: 'THE WHISKEY REBELS',
    banner: 'THE WHISKEY REBELS RISE',
    sub: 'Pennsylvania, 1794. They are still extremely drunk.',
    tint: 'rgba(120,90,40,0.05)',
    units: [
      {
        id: 'rebel', name: 'Sotted Rebel', hp: 12, speed: 31, dmg: 7, r: 8, xp: 1,
        ai: 'drunk', weight: 3,
        sprite: { key: 'e_rebel', undead: 1, coat: '#6a5a3a', pants: '#5a4a30', shirt: '#c9bc9a', hair: '#4a3a24', hairStyle: 'crop', hold: 'bottle', eye: '#c8ff4a', scale: 0.75 }
      },
      {
        id: 'jugger', name: 'Jug Hauler', hp: 26, speed: 26, dmg: 10, r: 10, xp: 2,
        ai: 'drunk', weight: 1, knockRes: 0.3,
        sprite: { key: 'e_jugger', undead: 1, coat: '#54462c', pants: '#443722', shirt: '#b0a488', hair: '#3a2c1a', hairStyle: 'part', hat: 'fedora', hatCol: '#4a3a24', hold: 'bottle', eye: '#c8ff4a', scale: 0.86 }
      }
    ],
    boss: {
      id: 'barrelbaron', name: 'THE BARREL BARON', hp: 900, speed: 26, dmg: 26, r: 26, xp: 170,
      ai: 'boss_charge', scale: 2.2, knockRes: 0.92, abilities: ['summon'],
      sprite: { key: 'b_barrel', undead: 1, boss: 1, bossRim: 'rgba(200,150,60,.9)', coat: '#7a5a34', coatAlt: '#5a4326', pants: '#5a4326', shirt: '#c9b07a', hair: '#3a2c1a', hairStyle: 'part', face: 'fullbeard', facialCol: '#4a3a24', hat: 'fedora', hatCol: '#4a3524', hold: 'bottle', eye: '#ffe14a', scale: 2.2 }
    }
  },

  /* ---------------------------------------------------------- 1:00 */
  {
    id: 'redcoats', minute: 1,
    name: 'THE REDCOATS',
    banner: 'THE REDCOATS ARE COMING',
    sub: 'They are, in fact, still coming. Two centuries late.',
    tint: 'rgba(150,40,50,0.06)',
    units: [
      {
        id: 'redcoat', name: 'Line Infantry', hp: 30, speed: 37, dmg: 10, r: 8, xp: 2,
        ai: 'march', weight: 3,
        sprite: { key: 'e_redcoat', undead: 1, coat: '#b8242e', coatAlt: '#efe8d4', pants: '#d8d0b8', shirt: '#efe8d4', hair: '#e8e6dc', hairStyle: 'wig', hat: 'shako', hatCol: '#191922', hatAccent: '#c9a24a', hold: 'musket', eye: '#c8ff4a', scale: 0.775 }
      },
      {
        id: 'grenadier', name: 'Grenadier', hp: 56, speed: 32, dmg: 14, r: 10, xp: 3,
        ai: 'march', weight: 1, knockRes: 0.35,
        sprite: { key: 'e_gren', undead: 1, coat: '#c8323a', coatAlt: '#f2c14e', pants: '#d8d0b8', shirt: '#efe8d4', hair: '#e8e6dc', hairStyle: 'wig', hat: 'shako', hatCol: '#0f0f16', hatAccent: '#f2c14e', hold: 'musket', eye: '#c8ff4a', scale: 0.89 }
      },
      {
        id: 'dragoon', name: 'Dragoon', hp: 36, speed: 53, dmg: 13, r: 8, xp: 3,
        ai: 'charger', weight: 1,
        sprite: { key: 'e_drag', undead: 1, coat: '#9a1c26', coatAlt: '#c9a24a', pants: '#c9b07a', shirt: '#efe8d4', hair: '#c8c4b8', hairStyle: 'wig', hat: 'brodie', hatCol: '#3a3a44', hold: 'saber', eye: '#c8ff4a', scale: 0.775 }
      }
    ],
    boss: {
      id: 'cornwallis', name: 'GENERAL CORNWALLIS', hp: 2400, speed: 32, dmg: 31, r: 26, xp: 340,
      ai: 'boss_charge', scale: 2.1, knockRes: 0.94, abilities: ['summon', 'volley'],
      sprite: { key: 'b_corn', undead: 1, boss: 1, bossRim: 'rgba(242,193,78,.9)', coat: '#d8324a', coatAlt: '#f2c14e', pants: '#efe8d4', shirt: '#efe8d4', hair: '#f4f2ea', hairStyle: 'wig', hat: 'tricorn', hatCol: '#0f0f16', hatAccent: '#f2c14e', hold: 'saber', eye: '#ffe14a', scale: 2.1 }
    }
  },

  /* ---------------------------------------------------------- 2:00 */
  {
    id: 'santaanna', minute: 2,
    name: "SANTA ANNA'S ARMY",
    banner: "SANTA ANNA'S ARMY ADVANCES",
    sub: 'The Mexican–American War, 1846. Nobody told them it ended.',
    tint: 'rgba(140,110,40,0.07)',
    units: [
      {
        id: 'soldado', name: 'Line Soldado', hp: 56, speed: 43, dmg: 13, r: 8, xp: 3,
        ai: 'march', weight: 3,
        sprite: { key: 'e_sold', undead: 1, coat: '#3a5a8a', coatAlt: '#c9a24a', pants: '#d8d0b8', shirt: '#efe8d4', hair: '#241a12', hairStyle: 'crop', hat: 'shako', hatCol: '#22222c', hatAccent: '#c9a24a', hold: 'musket', eye: '#c8ff4a', scale: 0.79 }
      },
      {
        id: 'lancer', name: 'Lancer', hp: 48, speed: 61, dmg: 15, r: 8, xp: 4,
        ai: 'charger', weight: 2,
        sprite: { key: 'e_lanc', undead: 1, coat: '#2a4a7a', coatAlt: '#d8324a', pants: '#3a3a48', shirt: '#efe8d4', hair: '#1a1410', hairStyle: 'crop', hat: 'sombrero', hatCol: '#5a4a2e', hatAccent: '#c9a24a', hold: 'saber', eye: '#c8ff4a', scale: 0.8 }
      },
      {
        id: 'zapador', name: 'Sapper', hp: 112, speed: 33, dmg: 19, r: 11, xp: 5,
        ai: 'tank', weight: 1, knockRes: 0.5,
        sprite: { key: 'e_zap', undead: 1, coat: '#2f4a6a', coatAlt: '#8a8f9e', pants: '#3a3a48', shirt: '#c9bc9a', hair: '#241a12', hairStyle: 'part', face: 'fullbeard', facialCol: '#241a12', hat: 'brodie', hatCol: '#4a4a54', eye: '#c8ff4a', scale: 0.975 }
      }
    ],
    boss: {
      id: 'theleg', name: "SANTA ANNA'S LEG", hp: 5200, speed: 44, dmg: 36, r: 26, xp: 600,
      ai: 'boss_charge', scale: 2.25, knockRes: 0.95, abilities: ['summon', 'slam'],
      sprite: { key: 'b_leg', undead: 1, boss: 1, bossRim: 'rgba(242,193,78,.9)', goldleg: 1, coat: '#1f3352', coatAlt: '#f2c14e', pants: '#d8d0b8', shirt: '#efe8d4', hair: '#1a1410', hairStyle: 'part', face: 'fullbeard', facialCol: '#1a1410', hat: 'shako', hatCol: '#14141c', hatAccent: '#f2c14e', hold: 'saber', eye: '#ffe14a', scale: 2.25 }
    }
  },

  /* ---------------------------------------------------------- 3:00 */
  {
    id: 'kaiser', minute: 3,
    name: "THE KAISER'S STORMTROOPERS",
    banner: 'THE KAISER SENDS HIS STORMTROOPERS',
    sub: 'Out of the trenches of 1917, and quite unhappy about it.',
    tint: 'rgba(90,100,70,0.09)',
    units: [
      {
        id: 'trooper', name: 'Sturmtruppen', hp: 100, speed: 41, dmg: 17, r: 8, xp: 5,
        ai: 'march', weight: 3,
        sprite: { key: 'e_sturm', undead: 1, coat: '#4a5240', coatAlt: '#3a4032', pants: '#3e4434', shirt: '#5a6248', hair: '#3a2c1a', hairStyle: 'crop', hat: 'stahlhelm', hatCol: '#3a4038', hold: 'rifle', eye: '#c8ff4a', scale: 0.81 }
      },
      {
        id: 'gasman', name: 'Gas Trooper', hp: 88, speed: 49, dmg: 19, r: 8, xp: 6,
        ai: 'charger', weight: 2,
        sprite: { key: 'e_gas', undead: 1, coat: '#424a38', coatAlt: '#2e3428', pants: '#363c2c', shirt: '#4a5240', face: 'gasmask', hat: 'brodie', hatCol: '#33392f', hold: 'rifle', eye: '#c8ff4a', scale: 0.81 }
      },
      {
        id: 'pickel', name: 'Uhlan Guard', hp: 190, speed: 35, dmg: 24, r: 11, xp: 8,
        ai: 'tank', weight: 1, knockRes: 0.55,
        sprite: { key: 'e_pick', undead: 1, coat: '#3a4438', coatAlt: '#c9a24a', pants: '#2e3428', shirt: '#5a6248', hair: '#4a3a24', hairStyle: 'part', stache: true, facialCol: '#4a3a24', hat: 'pickelhaube', hatCol: '#2a2e26', hatAccent: '#c9a24a', eye: '#c8ff4a', scale: 1 }
      }
    ],
    boss: {
      id: 'redbaron', name: 'THE RED BARON', hp: 9800, speed: 96, dmg: 40, r: 30, xp: 1100,
      ai: 'boss_flyer', scale: 1.7, knockRes: 1, flying: 1, abilities: ['strafe'],
      fxArt: 'plane', fxTint: 'rgba(200,30,50,0.55)', fxScale: 3.4
    }
  },

  /* ---------------------------------------------------------- 4:00 */
  {
    id: 'wehrmacht', minute: 4,
    name: 'THE WEHRMACHT',
    banner: 'THE WEHRMACHT BREAKS THROUGH',
    sub: 'History\'s most punchable uniform, now with a pulse. Sort of.',
    tint: 'rgba(70,80,70,0.11)',
    units: [
      {
        id: 'soldat', name: 'Landser', hp: 175, speed: 42, dmg: 21, r: 8, xp: 8,
        ai: 'march', weight: 3,
        sprite: { key: 'e_soldat', undead: 1, coat: '#4a5240', coatAlt: '#2e3428', pants: '#3a4034', shirt: '#5a6248', hair: '#2e2418', hairStyle: 'crop', hat: 'stahlhelm', hatCol: '#333a32', hold: 'rifle', eye: '#c8ff4a', scale: 0.825 }
      },
      {
        id: 'panzergren', name: 'Panzergrenadier', hp: 330, speed: 36, dmg: 28, r: 11, xp: 12,
        ai: 'tank', weight: 2, knockRes: 0.6,
        sprite: { key: 'e_pgren', undead: 1, coat: '#2a2e28', coatAlt: '#42483c', pants: '#24281f', shirt: '#3a4034', hair: '#2e2418', hairStyle: 'crop', hat: 'stahlhelm', hatCol: '#282e26', eye: '#ff6a4a', scale: 1 }
      },
      {
        id: 'fallschirm', name: 'Fallschirmjäger', hp: 148, speed: 62, dmg: 24, r: 8, xp: 10,
        ai: 'charger', weight: 2,
        sprite: { key: 'e_fall', undead: 1, coat: '#565c44', coatAlt: '#3a4032', pants: '#464c38', shirt: '#5a6248', hair: '#3a2c1a', hairStyle: 'crop', hat: 'brodie', hatCol: '#3e443a', hold: 'rifle', eye: '#c8ff4a', scale: 0.825 }
      }
    ],
    boss: {
      id: 'panzergeist', name: 'THE PANZER GEIST', hp: 17500, speed: 34, dmg: 42, r: 34, xp: 3400,
      ai: 'boss_tank', scale: 1.5, knockRes: 1, abilities: ['shell', 'summon'],
      fxArt: 'tank', fxScale: 3.0
    }
  },

  /* ---------------------------------------------------------- 5:00 */
  {
    id: 'imperial', minute: 5,
    name: 'THE IMPERIAL JAPANESE ARMY',
    banner: 'THE IMPERIAL ARMY CHARGES',
    sub: 'They have not stopped charging since 1944.',
    tint: 'rgba(150,50,40,0.10)',
    units: [
      {
        id: 'infantry', name: 'Rikugun Infantry', hp: 245, speed: 52, dmg: 20, r: 8, xp: 12,
        ai: 'charger', weight: 3,
        sprite: { key: 'e_riku', undead: 1, coat: '#8a7a4a', coatAlt: '#6a5c36', pants: '#7a6c40', shirt: '#9a8c5c', hair: '#1a1410', hairStyle: 'crop', hat: 'kepi', hatCol: '#6a5c36', hatAccent: '#c9a24a', hold: 'rifle', eye: '#ff6a4a', scale: 0.8 }
      },
      {
        id: 'banzai', name: 'Shock Trooper', hp: 190, speed: 74, dmg: 24, r: 8, xp: 14,
        ai: 'swarm', weight: 2,
        sprite: { key: 'e_banz', undead: 1, coat: '#7a6a3e', coatAlt: '#d8324a', pants: '#6a5c34', shirt: '#8a7c50', hair: '#1a1410', hairStyle: 'crop', hat: 'none', hold: 'saber', eye: '#ff4a4a', scale: 0.79 }
      },
      {
        id: 'kaigun', name: 'Naval Marine', hp: 430, speed: 32, dmg: 28, r: 11, xp: 18,
        ai: 'tank', weight: 1, knockRes: 0.62,
        sprite: { key: 'e_kaig', undead: 1, coat: '#e2ddd0', coatAlt: '#2a3550', pants: '#dad4c4', shirt: '#f0ece0', hair: '#1a1410', hairStyle: 'crop', hat: 'cap', hatCol: '#f0ece0', hatAccent: '#c9a24a', eye: '#ff6a4a', scale: 1 }
      }
    ],
    boss: {
      id: 'thezero', name: 'THE ZERO', hp: 30000, speed: 118, dmg: 46, r: 30, xp: 5200,
      ai: 'boss_flyer', scale: 1.65, knockRes: 1, flying: 1, abilities: ['strafe', 'bomb'],
      fxArt: 'plane', fxTint: 'rgba(210,205,180,0.5)', fxScale: 3.3
    }
  },

  /* ---------------------------------------------------------- 6:00 */
  {
    id: 'republican', minute: 6,
    name: 'THE REPUBLICAN GUARD',
    banner: 'THE REPUBLICAN GUARD DEPLOYS',
    sub: 'Desert, 1991. No relation to the party. Probably.',
    tint: 'rgba(170,140,70,0.10)',
    units: [
      {
        id: 'guard', name: 'Guardsman', hp: 400, speed: 34, dmg: 25, r: 9, xp: 18,
        ai: 'march', weight: 3,
        sprite: { key: 'e_guard', undead: 1, coat: '#8a7a56', coatAlt: '#6a5c40', pants: '#7a6c4a', shirt: '#9a8c68', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'peaked', hatCol: '#5a5238', hatAccent: '#5ec26a', hold: 'rifle', eye: '#c8ff4a', scale: 0.83 }
      },
      {
        id: 'rpg', name: 'RPG Gunner', hp: 330, speed: 26, dmg: 22, r: 9, xp: 20,
        ai: 'shooter', weight: 2, shootRange: 200, shootRate: 2.6, shotDmg: 18, shotSpeed: 130,
        sprite: { key: 'e_rpg', undead: 1, coat: '#6a6244', coatAlt: '#4a4630', pants: '#5a5438', shirt: '#7a7250', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'turban', hatCol: '#5a5238', eye: '#c8ff4a', scale: 0.83 }
      },
      {
        id: 'medina', name: 'Medina Heavy', hp: 780, speed: 28, dmg: 32, r: 12, xp: 26,
        ai: 'tank', weight: 1, knockRes: 0.68,
        sprite: { key: 'e_med', undead: 1, coat: '#4a4a38', coatAlt: '#2e2e22', pants: '#3e3e2e', shirt: '#5a5a44', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'brodie', hatCol: '#3e4034', eye: '#ff6a4a', scale: 1.05 }
      }
    ],
    boss: {
      id: 'aceofspades', name: 'THE ACE OF SPADES', hp: 48000, speed: 40, dmg: 52, r: 28, xp: 8000,
      ai: 'boss_charge', scale: 2.3, knockRes: 0.96, abilities: ['summon', 'volley', 'slam'],
      sprite: { key: 'b_ace', undead: 1, boss: 1, bossRim: 'rgba(210,215,230,.9)', coat: '#1a1a22', coatAlt: '#c8ccd6', pants: '#22222c', shirt: '#e8e4d8', hair: '#1a1410', hairStyle: 'part', face: 'fullbeard', facialCol: '#1a1410', hat: 'peaked', hatCol: '#101018', hatAccent: '#c8ccd6', hold: 'flag', holdCol: '#3a3a44', flagCol: '#1a1a22', eye: '#ffe14a', scale: 2.3 }
    }
  },

  /* ---------------------------------------------------------- 7:00 */
  {
    id: 'revguard', minute: 7,
    name: 'THE REVOLUTIONARY GUARD',
    banner: 'THE REVOLUTIONARY GUARD SWARMS',
    sub: 'They arrive in numbers that frankly seem administrative.',
    tint: 'rgba(60,120,70,0.10)',
    units: [
      {
        id: 'basij', name: 'Basij Runner', hp: 480, speed: 72, dmg: 26, r: 8, xp: 24,
        ai: 'swarm', weight: 4,
        sprite: { key: 'e_basij', undead: 1, coat: '#3a4a3a', coatAlt: '#2a352a', pants: '#33422f', shirt: '#4a5a44', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'turban', hatCol: '#22222c', eye: '#5ec26a', scale: 0.8 }
      },
      {
        id: 'pasdar', name: 'Pasdaran', hp: 720, speed: 40, dmg: 30, r: 9, xp: 28,
        ai: 'march', weight: 2,
        sprite: { key: 'e_pasdar', undead: 1, coat: '#4a5a4a', coatAlt: '#33422f', pants: '#3f4c3c', shirt: '#5a6a54', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'cap', hatCol: '#3a4a3a', eye: '#5ec26a', scale: 0.86 }
      },
      {
        id: 'artillery', name: 'Mortar Crew', hp: 560, speed: 22, dmg: 28, r: 9, xp: 30,
        ai: 'shooter', weight: 1, shootRange: 240, shootRate: 2.2, shotDmg: 24, shotSpeed: 120,
        sprite: { key: 'e_mortar', undead: 1, coat: '#565a3e', coatAlt: '#3a3e28', pants: '#4a4e34', shirt: '#666a4a', hair: '#1a1410', hairStyle: 'crop', hat: 'brodie', hatCol: '#42462f', eye: '#5ec26a', scale: 0.86 }
      }
    ],
    boss: {
      id: 'grandmarshal', name: 'THE GRAND MARSHAL', hp: 72000, speed: 46, dmg: 58, r: 28, xp: 12000,
      ai: 'boss_charge', scale: 2.35, knockRes: 0.96, abilities: ['summon', 'slam', 'volley'],
      sprite: { key: 'b_marshal', undead: 1, boss: 1, bossRim: 'rgba(94,194,106,.9)', coat: '#22322a', coatAlt: '#5ec26a', pants: '#1e2c24', shirt: '#3a4a3a', hair: '#e8e4dc', hairStyle: 'crop', face: 'fullbeard', facialCol: '#e8e4dc', hat: 'turban', hatCol: '#14181a', eye: '#8cff9a', scale: 2.35 }
    }
  },

  /* ---------------------------------------------------------- 8:00 */
  {
    id: 'redarmy', minute: 8,
    name: 'THE RED ARMY',
    banner: 'THE RED ARMY MARCHES',
    sub: 'Nineteen eighty-three. The parade never stopped.',
    tint: 'rgba(170,30,40,0.12)',
    units: [
      {
        id: 'soldat_ru', name: 'Red Conscript', hp: 1000, speed: 32, dmg: 36, r: 9, xp: 34,
        ai: 'march', weight: 3,
        sprite: { key: 'e_ru', undead: 1, coat: '#5a5238', coatAlt: '#d8324a', pants: '#4a4430', shirt: '#6a6244', hair: '#3a2c1a', hairStyle: 'crop', hat: 'ushanka', hatCol: '#4a3f2c', hold: 'rifle', eye: '#ff4a4a', scale: 0.85 }
      },
      {
        id: 'komissar', name: 'Komissar', hp: 1450, speed: 40, dmg: 40, r: 10, xp: 42,
        ai: 'charger', weight: 2,
        sprite: { key: 'e_kom', undead: 1, coat: '#3a4a5a', coatAlt: '#d8324a', pants: '#2f3c48', shirt: '#4a5a68', hair: '#2e2418', hairStyle: 'part', stache: true, facialCol: '#2e2418', hat: 'peaked', hatCol: '#2a3038', hatAccent: '#d8324a', hold: 'saber', eye: '#ff4a4a', scale: 0.89 }
      },
      {
        id: 'shock_ru', name: 'Shock Guard', hp: 2400, speed: 26, dmg: 48, r: 13, xp: 55,
        ai: 'tank', weight: 1, knockRes: 0.75,
        sprite: { key: 'e_shock', undead: 1, coat: '#4a4a3a', coatAlt: '#2e2e24', pants: '#3e3e30', shirt: '#5a5a46', hair: '#2e2418', hairStyle: 'crop', face: 'fullbeard', facialCol: '#2e2418', hat: 'stahlhelm', hatCol: '#3a3e34', eye: '#ff4a4a', scale: 1.1 }
      }
    ],
    boss: {
      id: 'ursa', name: 'COMRADE URSA', hp: 110000, speed: 44, dmg: 66, r: 34, xp: 20000,
      ai: 'boss_charge', scale: 2.8, knockRes: 0.98, abilities: ['summon', 'slam', 'charge2'],
      sprite: { key: 'b_ursa', undead: 1, boss: 1, bossRim: 'rgba(216,50,74,.9)', skin: '#6a4f36', coat: '#4a3626', coatAlt: '#3a2a1c', pants: '#3f2d1e', shirt: '#5c452f', hair: '#3a2a1c', hairStyle: 'crop', face: 'fullbeard', facialCol: '#2e2016', hat: 'ushanka', hatCol: '#5a4632', eye: '#ff4a4a', scale: 2.8 }
    }
  },

  /* ---------------------------------------------------------- 9:00 */
  {
    id: 'combined', minute: 9,
    name: 'THE COMBINED HORDE',
    banner: 'ALL ARMIES CONVERGE',
    sub: 'They have set aside two centuries of differences. To get you.',
    tint: 'rgba(90,20,90,0.13)',
    mixed: true,                 // pulls units from every earlier faction
    units: [],
    boss: {
      id: 'lobbyist', name: 'THE LOBBYIST', hp: 190000, speed: 52, dmg: 72, r: 30, xp: 30000,
      ai: 'boss_charge', scale: 2.4, knockRes: 0.97, abilities: ['summon', 'volley', 'slam', 'charge2'],
      sprite: { key: 'b_lobby', undead: 1, boss: 1, bossRim: 'rgba(94,194,106,.9)', skin: '#a8b88a', coat: '#22262e', coatAlt: '#5ec26a', pants: '#1a1e24', shirt: '#e8e4d8', tie: '#5ec26a', hair: '#8a8578', hairStyle: 'part', hat: 'fedora', hatCol: '#1a1e24', hold: 'lantern', eye: '#8cff9a', scale: 2.4 }
    }
  }
];

/* ------------------------------------------------------------
   The 20-minute closer. Thematically, the guy who started it.
   ------------------------------------------------------------ */
const FINAL_BOSS = {
  id: 'georgeiii', name: 'KING GEORGE III', hp: 300000, speed: 50, dmg: 90, r: 40, xp: 100000,
  ai: 'boss_final', scale: 3.5, knockRes: 1, isFinal: true,
  abilities: ['summon', 'volley', 'slam', 'charge2', 'rings'],
  sprite: {
    key: 'b_george', undead: 1, boss: 1, bossRim: 'rgba(242,193,78,.95)',
    skin: '#b8c49a', coat: '#8a1f3a', coatAlt: '#f2c14e', pants: '#efe8d4',
    shirt: '#efe8d4', hair: '#f4f2ea', hairStyle: 'wig', hat: 'crown',
    hold: 'saber', holdCol: '#f2c14e', eye: '#ffe14a', scale: 3.5
  }
};

/* ============================================================
   MINI-BOSSES

   These don't hold a building. They roam the stage hunting you, one
   at a time, on a timer. Tough enough to be a real decision — fight
   or leave town — without being a strongpoint assault. They pay well.

   `tier` gates when they can appear: a mini-boss only shows up once
   you've cleared that many strongpoints.
   ============================================================ */
const MINI_BOSSES = [
  {
    id: 'crier', name: 'THE TOWN CRIER', tier: 0, lvl: 9,
    sub: 'Still announcing the news. The news is very old and he is very loud.',
    hp: 2600, speed: 46, dmg: 24, r: 15, xp: 260, gold: 90,
    ai: 'march', scale: 1.3, knockRes: 0.6, mini: 1, abilities: ['summon'],
    sprite: { key: 'm_crier', undead: 1, boss: 1, bossRim: 'rgba(200,170,90,.85)', coat: '#6a5a3a', coatAlt: '#c9b07a', pants: '#5a4a30', shirt: '#efe8d4', hair: '#e8e6dc', hairStyle: 'wig', hat: 'tricorn', hatCol: '#2a2a34', hatAccent: '#c9a24a', hold: 'lantern', eye: '#c8ff4a', scale: 1.3 }
  },
  {
    id: 'bootsergeant', name: 'SERGEANT MAJOR BOOT', tier: 1, lvl: 18,
    sub: 'Drilled the 33rd Regiment of Foot. Is still drilling the 33rd Regiment of Foot.',
    hp: 6200, speed: 40, dmg: 30, r: 16, xp: 480, gold: 150,
    ai: 'march', scale: 1.4, knockRes: 0.7, mini: 1, abilities: ['summon', 'volley'],
    sprite: { key: 'm_boot', undead: 1, boss: 1, bossRim: 'rgba(216,50,74,.85)', coat: '#c8323a', coatAlt: '#f2c14e', pants: '#d8d0b8', shirt: '#efe8d4', hair: '#e8e6dc', hairStyle: 'wig', hat: 'shako', hatCol: '#0f0f16', hatAccent: '#f2c14e', hold: 'saber', eye: '#c8ff4a', scale: 1.4 }
  },
  {
    id: 'cornetero', name: 'EL CORNETERO', tier: 2, lvl: 27,
    sub: 'Sounded the Degüello at the Alamo. Has not stopped sounding it.',
    hp: 13000, speed: 56, dmg: 36, r: 16, xp: 800, gold: 230,
    ai: 'charger', scale: 1.4, knockRes: 0.7, mini: 1, abilities: ['summon', 'slam'],
    sprite: { key: 'm_corn', undead: 1, boss: 1, bossRim: 'rgba(242,193,78,.85)', coat: '#2a4a7a', coatAlt: '#d8324a', pants: '#3a3a48', shirt: '#efe8d4', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'sombrero', hatCol: '#5a4a2e', hatAccent: '#c9a24a', eye: '#c8ff4a', scale: 1.4 }
  },
  {
    id: 'drager', name: 'FELDWEBEL DRÄGER', tier: 3, lvl: 36,
    sub: 'Carried the gas cylinders at Ypres. The cylinders are still leaking.',
    hp: 26000, speed: 42, dmg: 44, r: 17, xp: 1400, gold: 340,
    ai: 'shooter', scale: 1.45, knockRes: 0.75, mini: 1,
    shootRange: 230, shootRate: 1.7, shotDmg: 34, shotSpeed: 150,
    abilities: ['summon', 'volley'],
    sprite: { key: 'm_drager', undead: 1, boss: 1, bossRim: 'rgba(140,200,90,.85)', coat: '#424a38', coatAlt: '#2e3428', pants: '#363c2c', shirt: '#4a5240', face: 'gasmask', hat: 'stahlhelm', hatCol: '#33392f', hold: 'rifle', eye: '#8cff4a', scale: 1.45 }
  },
  {
    id: 'ironsgt', name: 'THE IRON SERGEANT', tier: 4, lvl: 45,
    sub: 'Awarded the Close Combat Clasp in gold. Wears it. Uses it.',
    hp: 52000, speed: 34, dmg: 62, r: 20, xp: 2400, gold: 500,
    ai: 'tank', scale: 1.65, knockRes: 0.9, mini: 1, abilities: ['slam', 'charge2'],
    sprite: { key: 'm_iron', undead: 1, boss: 1, bossRim: 'rgba(180,190,210,.85)', coat: '#2a2e28', coatAlt: '#5a6050', pants: '#24281f', shirt: '#3a4034', hair: '#2e2418', hairStyle: 'crop', face: 'fullbeard', facialCol: '#2e2418', hat: 'stahlhelm', hatCol: '#282e26', eye: '#ff6a4a', scale: 1.65 }
  },
  {
    id: 'divinewind', name: 'THE DIVINE WIND', tier: 5, lvl: 54,
    sub: 'Named for the typhoon that wrecked Kublai Khan\'s fleet. Moves like one.',
    hp: 88000, speed: 96, dmg: 68, r: 17, xp: 3600, gold: 700,
    ai: 'charger', scale: 1.45, knockRes: 0.85, mini: 1, abilities: ['charge2', 'slam'],
    sprite: { key: 'm_wind', undead: 1, boss: 1, bossRim: 'rgba(255,90,90,.85)', coat: '#7a6a3e', coatAlt: '#d8324a', pants: '#6a5c34', shirt: '#8a7c50', hair: '#1a1410', hairStyle: 'crop', hat: 'none', hold: 'saber', eye: '#ff4a4a', scale: 1.45 }
  },
  {
    id: 'mothersgt', name: 'THE MOTHER OF ALL SERGEANTS', tier: 6, lvl: 63,
    sub: 'Promised the mother of all battles. Delivered roughly a cousin of one.',
    hp: 150000, speed: 40, dmg: 80, r: 20, xp: 5600, gold: 1000,
    ai: 'shooter', scale: 1.65, knockRes: 0.9, mini: 1,
    shootRange: 270, shootRate: 1.4, shotDmg: 56, shotSpeed: 170,
    abilities: ['summon', 'volley', 'slam'],
    sprite: { key: 'm_mother', undead: 1, boss: 1, bossRim: 'rgba(94,194,106,.85)', coat: '#4a4a38', coatAlt: '#2e2e22', pants: '#3e3e2e', shirt: '#5a5a44', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'peaked', hatCol: '#3e4034', hatAccent: '#5ec26a', hold: 'rifle', eye: '#ff6a4a', scale: 1.65 }
  },
  {
    id: 'ursa', name: 'COMRADE URSA', tier: 7, lvl: 72,
    sub: 'The Red Army bear. Enlisted 1942, promoted to corporal, never discharged.',
    hp: 260000, speed: 58, dmg: 110, r: 26, xp: 11000, gold: 1900,
    ai: 'charger', scale: 2.3, knockRes: 0.95, mini: 1, abilities: ['slam', 'charge2', 'summon'],
    sprite: { key: 'm_ursa', undead: 1, boss: 1, bossRim: 'rgba(216,50,74,.9)', skin: '#6a4f36', coat: '#4a3626', coatAlt: '#3a2a1c', pants: '#3f2d1e', shirt: '#5c452f', hair: '#3a2a1c', hairStyle: 'crop', face: 'fullbeard', facialCol: '#2e2016', hat: 'ushanka', hatCol: '#5a4632', eye: '#ff4a4a', scale: 2.3 }
  },
  {
    id: 'lobbyist', name: 'THE LOBBYIST', tier: 3, lvl: 36,
    sub: 'Not a soldier. Represents a coalition of interests. Extremely hard to kill.',
    hp: 40000, speed: 62, dmg: 50, r: 17, xp: 2000, gold: 3800,
    ai: 'charger', scale: 1.45, knockRes: 0.88, mini: 1, rare: 1, abilities: ['summon'],
    sprite: { key: 'm_lobby', undead: 1, boss: 1, bossRim: 'rgba(94,194,106,.9)', skin: '#a8b88a', coat: '#22262e', coatAlt: '#5ec26a', pants: '#1a1e24', shirt: '#e8e4d8', tie: '#5ec26a', hair: '#8a8578', hairStyle: 'part', hat: 'fedora', hatCol: '#1a1e24', hold: 'lantern', eye: '#8cff9a', scale: 1.45 }
  }
];

/* Index of every unit definition, for the mixed-horde phase. */
const ALL_UNITS = [];
const ALL_UNIT_DEFS = [];
for (const f of FACTIONS) {
  for (const u of f.units) { ALL_UNITS.push({ unit: u, faction: f }); ALL_UNIT_DEFS.push(u); }
}

/** Flat list of the nine bosses in order, plus the finale. */
const BOSS_ORDER = FACTIONS.map(f => f.boss).concat([FINAL_BOSS]);

/* ============================================================
   CAMPAIGN CONTENT — the eight eras added after Williamsburg.

   Same shape as the original nine factions: a `units` array of pooled
   enemy definitions and, for stage bosses, an entry in STAGE_BOSSES.
   Nothing here introduces a new entity type — every one of these goes
   through spawnEnemy() into the same fixed-size pool, so the O(1)
   swap-remove and the zero-allocation hot loop are untouched.

   Sprite `scale` values are in the post-2x-detail range (~0.75-1.15).
   ============================================================ */

const CAMPAIGN_FACTIONS = [
  {
    id: 'confederate', name: 'THE ARMY OF NORTHERN VIRGINIA',
    banner: 'THE ARMY OF NORTHERN VIRGINIA ADVANCES',
    sub: 'Pennsylvania, July 1863. They have not been told it ended.',
    units: [
      { id: 'reb', name: 'Infantryman', hp: 44, speed: 39, dmg: 12, r: 8, xp: 3, ai: 'march', weight: 3,
        sprite: { key: 'e_reb', undead: 1, coat: '#7a7060', coatAlt: '#5e5648', pants: '#6a6252', shirt: '#8a8272', hair: '#3a2c1a', hairStyle: 'crop', hat: 'kepi', hatCol: '#5a5346', hold: 'musket', eye: '#c8ff4a', scale: 0.79 } },
      { id: 'skirm', name: 'Skirmisher', hp: 38, speed: 56, dmg: 14, r: 8, xp: 4, ai: 'charger', weight: 2,
        sprite: { key: 'e_skirm', undead: 1, coat: '#6a6252', coatAlt: '#4a4438', pants: '#5c5646', shirt: '#7a7264', hair: '#2e2418', hairStyle: 'crop', face: 'fullbeard', facialCol: '#2e2418', hat: 'fedora', hatCol: '#4a4438', hold: 'rifle', eye: '#c8ff4a', scale: 0.79 } },
      { id: 'artillery_cw', name: 'Gun Crew', hp: 108, speed: 26, dmg: 20, r: 11, xp: 6, ai: 'shooter', weight: 1,
        shootRange: 250, shootRate: 2.4, shotDmg: 22, shotSpeed: 140,
        sprite: { key: 'e_gun_cw', undead: 1, coat: '#5a5446', coatAlt: '#c9a24a', pants: '#4a4438', shirt: '#6a6252', hair: '#3a2c1a', hairStyle: 'part', stache: true, facialCol: '#3a2c1a', hat: 'kepi', hatCol: '#44403a', eye: '#c8ff4a', scale: 0.98 } }
    ]
  },
  {
    id: 'spanish', name: 'THE SPANISH COLONIAL ARMY',
    banner: 'THE COLONIAL GARRISON TURNS OUT',
    sub: 'Surrendered at Santiago, 1898. This detachment did not get the message.',
    units: [
      { id: 'rayadillo', name: 'Rayadillo Infantry', hp: 82, speed: 40, dmg: 17, r: 8, xp: 5, ai: 'march', weight: 3,
        sprite: { key: 'e_rayad', undead: 1, coat: '#b8c4cc', coatAlt: '#8a96a0', pants: '#a8b4bc', shirt: '#c8d4dc', hair: '#1a1410', hairStyle: 'crop', hat: 'cap', hatCol: '#9aa6ae', hold: 'rifle', eye: '#c8ff4a', scale: 0.82 } },
      { id: 'guardia', name: 'Guardia Civil', hp: 148, speed: 31, dmg: 23, r: 11, xp: 8, ai: 'tank', weight: 1, knockRes: 0.5,
        sprite: { key: 'e_guardia', undead: 1, coat: '#2a3038', coatAlt: '#c9a24a', pants: '#232830', shirt: '#3a4048', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'tricorn', hatCol: '#14181c', hatAccent: '#c9a24a', eye: '#c8ff4a', scale: 1.0 } }
    ]
  },
  {
    id: 'frontier', name: 'THE TERRITORIAL IRREGULARS',
    banner: 'THE IRREGULARS RIDE IN',
    sub: 'Claim-jumpers, rustlers, and one very persistent posse.',
    units: [
      { id: 'rustler', name: 'Rustler', hp: 60, speed: 52, dmg: 15, r: 8, xp: 4, ai: 'charger', weight: 3,
        sprite: { key: 'e_rustler', undead: 1, coat: '#6a5232', coatAlt: '#4a3a22', pants: '#5a4628', shirt: '#9a8a66', hair: '#3a2c1a', hairStyle: 'crop', stache: true, facialCol: '#3a2c1a', hat: 'campaign', hatCol: '#5a4632', hold: 'saber', eye: '#c8ff4a', scale: 0.8 } },
      { id: 'prospector', name: 'Sotted Prospector', hp: 96, speed: 27, dmg: 19, r: 10, xp: 5, ai: 'drunk', weight: 1, knockRes: 0.35,
        sprite: { key: 'e_prosp', undead: 1, coat: '#7a6a4a', coatAlt: '#5a4c32', pants: '#6a5c3e', shirt: '#a89a76', hair: '#8a8272', hairStyle: 'thin', face: 'fullbeard', facialCol: '#8a8272', hat: 'fedora', hatCol: '#5a4a30', hold: 'bottle', eye: '#c8ff4a', scale: 0.92 } }
    ]
  },
  {
    id: 'coldwar', name: 'SOVIET FORWARD ELEMENTS',
    banner: 'FORWARD ELEMENTS DETECTED',
    sub: 'They were never supposed to be on this continent.',
    units: [
      { id: 'spetsnaz', name: 'Spetsnaz', hp: 210, speed: 58, dmg: 26, r: 8, xp: 12, ai: 'charger', weight: 3,
        sprite: { key: 'e_spets', undead: 1, coat: '#3a4438', coatAlt: '#2a3228', pants: '#333c30', shirt: '#48523f', hair: '#2e2418', hairStyle: 'crop', face: 'gasmask', hat: 'brodie', hatCol: '#333a30', hold: 'rifle', eye: '#ff6a4a', scale: 0.83 } },
      { id: 'rocketman', name: 'Rocket Crew', hp: 260, speed: 24, dmg: 30, r: 11, xp: 16, ai: 'shooter', weight: 1,
        shootRange: 260, shootRate: 2.1, shotDmg: 30, shotSpeed: 155,
        sprite: { key: 'e_rocket', undead: 1, coat: '#4a5060', coatAlt: '#d8324a', pants: '#3e4452', shirt: '#5a6070', hair: '#2e2418', hairStyle: 'part', hat: 'ushanka', hatCol: '#3a4048', eye: '#ff6a4a', scale: 1.02 } }
    ]
  },
  {
    id: 'nva', name: 'THE NORTH VIETNAMESE ARMY',
    banner: 'THE NVA HOLDS THE TREELINE',
    sub: 'They have been in these tunnels since the French were here.',
    units: [
      { id: 'nvaregular', name: 'NVA Regular', hp: 300, speed: 50, dmg: 30, r: 8, xp: 16, ai: 'march', weight: 3,
        sprite: { key: 'e_nva', undead: 1, coat: '#5a6a4a', coatAlt: '#44523a', pants: '#4e5c40', shirt: '#68785a', hair: '#1a1410', hairStyle: 'crop', hat: 'brodie', hatCol: '#4a5840', hold: 'rifle', eye: '#8cff4a', scale: 0.82 } },
      { id: 'sapper', name: 'Sapper', hp: 240, speed: 72, dmg: 36, r: 8, xp: 20, ai: 'swarm', weight: 2,
        sprite: { key: 'e_sapper', undead: 1, coat: '#3a4a34', coatAlt: '#2a3626', pants: '#33422d', shirt: '#48583e', hair: '#1a1410', hairStyle: 'crop', hat: 'none', hold: 'saber', eye: '#8cff4a', scale: 0.8 } }
    ]
  },
  {
    id: 'jungle', name: 'THE VALLEY ITSELF',
    banner: 'THE VALLEY IS NOT EMPTY',
    sub: 'Whatever the defoliant did, it did not do this.',
    units: [
      { id: 'creeper', name: 'Creeping Growth', hp: 420, speed: 34, dmg: 34, r: 12, xp: 22, ai: 'tank', weight: 2, knockRes: 0.7,
        sprite: { key: 'e_creep', undead: 1, skin: '#5a7a3a', coat: '#3a5228', coatAlt: '#2a3c1c', pants: '#33481f', shirt: '#4a6630', hair: '#2a4018', hairStyle: 'crop', face: 'fullbeard', facialCol: '#2a4018', eye: '#c8ff4a', scale: 1.08 } }
    ]
  },
  {
    id: 'stasi', name: 'THE MINISTRY FOR STATE SECURITY',
    banner: 'THE MINISTRY IS WATCHING',
    sub: 'One informant for every 6.5 citizens. All of them reported in.',
    units: [
      { id: 'informant', name: 'Informant', hp: 380, speed: 46, dmg: 32, r: 8, xp: 20, ai: 'march', weight: 3,
        sprite: { key: 'e_inform', undead: 1, coat: '#4a4a52', coatAlt: '#3a3a42', pants: '#42424a', shirt: '#e8e4d8', tie: '#5a5a62', hair: '#4a4438', hairStyle: 'part', hat: 'fedora', hatCol: '#3a3a42', eye: '#c8ccd6', scale: 0.82 } },
      { id: 'grenztruppen', name: 'Border Troop', hp: 560, speed: 38, dmg: 40, r: 10, xp: 26, ai: 'shooter', weight: 2,
        shootRange: 280, shootRate: 1.9, shotDmg: 34, shotSpeed: 170,
        sprite: { key: 'e_grenz', undead: 1, coat: '#5a6250', coatAlt: '#3a4034', pants: '#4e5646', shirt: '#68705e', hair: '#3a3428', hairStyle: 'crop', hat: 'peaked', hatCol: '#48503e', hatAccent: '#c9a24a', hold: 'rifle', eye: '#ff6a4a', scale: 0.9 } }
    ]
  },
  {
    id: 'holdouts', name: 'THE VALLEY HOLDOUTS',
    banner: 'THE HOLDOUTS COME DOWN FROM THE RIDGE',
    sub: 'They fought the Soviets here too, with the same rifles.',
    units: [
      { id: 'ridgeman', name: 'Ridge Fighter', hp: 620, speed: 54, dmg: 42, r: 8, xp: 28, ai: 'charger', weight: 3,
        sprite: { key: 'e_ridge', undead: 1, coat: '#7a7258', coatAlt: '#5a5440', pants: '#6a6450', shirt: '#8a8268', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'turban', hatCol: '#6a6450', hold: 'rifle', eye: '#c8ff4a', scale: 0.84 } },
      { id: 'mortarman', name: 'Mortar Team', hp: 700, speed: 22, dmg: 44, r: 11, xp: 34, ai: 'shooter', weight: 1,
        shootRange: 300, shootRate: 2.0, shotDmg: 44, shotSpeed: 130,
        sprite: { key: 'e_mortar_af', undead: 1, coat: '#6a6450', coatAlt: '#4a4638', pants: '#5a5644', shirt: '#7a7460', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'turban', hatCol: '#5a5644', eye: '#c8ff4a', scale: 1.0 } }
    ]
  },
  {
    id: 'mountain', name: 'THE MOUNTAIN', banner: 'THE MOUNTAIN DOES NOT CARE',
    sub: 'Nine thousand feet, and everything up here has been dead a long time.',
    units: [
      { id: 'rockfall', name: 'Scree Walker', hp: 900, speed: 30, dmg: 50, r: 13, xp: 40, ai: 'tank', weight: 2, knockRes: 0.8,
        sprite: { key: 'e_scree', undead: 1, skin: '#8a8276', coat: '#6a6458', coatAlt: '#4a4640', pants: '#5a564c', shirt: '#7a7468', hair: '#5a5648', hairStyle: 'crop', face: 'fullbeard', facialCol: '#5a5648', eye: '#c8ccd6', scale: 1.15 } }
    ]
  },
  {
    id: 'variants', name: 'THE VARIANTS',
    banner: 'A NEW VARIANT OF CONCERN',
    sub: 'It keeps changing. The alphabet is running out.',
    units: [
      { id: 'spike', name: 'Spike Carrier', hp: 780, speed: 58, dmg: 44, r: 9, xp: 34, ai: 'swarm', weight: 3,
        sprite: { key: 'e_spike', undead: 1, skin: '#c86a9a', coat: '#a03a6a', coatAlt: '#7a2a50', pants: '#8a3258', shirt: '#c05a86', hair: '#6a1a3a', hairStyle: 'crop', eye: '#ff4aa0', scale: 0.85 } },
      { id: 'aerosol', name: 'Aerosol Cloud', hp: 640, speed: 44, dmg: 40, r: 11, xp: 36, ai: 'drunk', weight: 2,
        sprite: { key: 'e_aero', undead: 1, skin: '#8ad0c8', coat: '#4a8a86', coatAlt: '#356a66', pants: '#3f7a76', shirt: '#5aa09a', hair: '#2a5a56', hairStyle: 'none', face: 'gasmask', eye: '#5affe0', scale: 0.9 } },
      { id: 'longhauler', name: 'Long Hauler', hp: 1400, speed: 24, dmg: 54, r: 13, xp: 48, ai: 'tank', weight: 1, knockRes: 0.75,
        sprite: { key: 'e_long', undead: 1, skin: '#9aa0a8', coat: '#5a6068', coatAlt: '#3e444c', pants: '#4e545c', shirt: '#dfe6e8', hair: '#6a7078', hairStyle: 'thin', face: 'gasmask', eye: '#8ad0c8', scale: 1.12 } }
    ]
  }
];

/* ---- stage bosses, keyed by id so a stage can name one ---- */
const STAGE_BOSSES = {
  georgeiii: FINAL_BOSS,

  genlee: {
    id: 'genlee', name: 'THE GREY COMMANDER', hp: 5200, speed: 40, dmg: 34, r: 26, xp: 900,
    sub: 'Ordered the charge across three-quarters of a mile of open ground.',
    ai: 'boss_charge', scale: 2.2, knockRes: 0.94, abilities: ['summon', 'volley'],
    sprite: { key: 'b_lee', undead: 1, boss: 1, bossRim: 'rgba(180,190,200,.9)', coat: '#6a7078', coatAlt: '#c9a24a', pants: '#5a6068', shirt: '#e8e4d8', hair: '#d8d4cc', hairStyle: 'part', face: 'fullbeard', facialCol: '#d8d4cc', hat: 'campaign', hatCol: '#4a5058', hold: 'saber', eye: '#ffe14a', scale: 2.2 }
  },
  elgobernador: {
    id: 'elgobernador', name: 'EL GOBERNADOR', hp: 16000, speed: 44, dmg: 40, r: 26, xp: 2200,
    sub: 'The last colonial governor. Never received the surrender order, and would not have signed it.',
    ai: 'boss_charge', scale: 2.3, knockRes: 0.95, abilities: ['summon', 'slam', 'volley'],
    sprite: { key: 'b_gob', undead: 1, boss: 1, bossRim: 'rgba(242,193,78,.9)', coat: '#2a3038', coatAlt: '#f2c14e', pants: '#232830', shirt: '#efe8d4', hair: '#1a1410', hairStyle: 'part', face: 'fullbeard', facialCol: '#1a1410', hat: 'tricorn', hatCol: '#14181c', hatAccent: '#f2c14e', hold: 'saber', eye: '#ffe14a', scale: 2.3 }
  },
  feldmarschall: {
    id: 'feldmarschall', name: 'THE FELDMARSCHALL', hp: 42000, speed: 38, dmg: 52, r: 28, xp: 4800,
    sub: 'Commanded the Atlantic Wall. Reported it impregnable, in writing, twice.',
    ai: 'boss_tank', scale: 2.4, knockRes: 1, abilities: ['shell', 'summon', 'slam'],
    sprite: { key: 'b_feld', undead: 1, boss: 1, bossRim: 'rgba(200,205,220,.9)', coat: '#3a4038', coatAlt: '#c9a24a', pants: '#32382f', shirt: '#4a5044', hair: '#8a8578', hairStyle: 'thin', hat: 'peaked', hatCol: '#2a2f28', hatAccent: '#c9a24a', hold: 'club', eye: '#ff6a4a', scale: 2.4 }
  },
  premier: {
    id: 'premier', name: 'THE PREMIER', hp: 96000, speed: 42, dmg: 62, r: 28, xp: 9000,
    sub: 'Took his shoe off at the United Nations. Still holding it.',
    ai: 'boss_charge', scale: 2.4, knockRes: 0.96, abilities: ['summon', 'volley', 'rings'],
    sprite: { key: 'b_prem', undead: 1, boss: 1, bossRim: 'rgba(216,50,74,.9)', skin: '#c8a888', coat: '#4a5060', coatAlt: '#d8324a', pants: '#3e4452', shirt: '#efe8d4', tie: '#d8324a', hair: '#c8c4b8', hairStyle: 'bald', hat: 'none', eye: '#ff4a4a', scale: 2.4 }
  },
  thegeneral: {
    id: 'thegeneral', name: 'THE GENERAL OF THE TUNNELS', hp: 175000, speed: 52, dmg: 74, r: 28, xp: 15000,
    sub: 'Beat the French at Dien Bien Phu with bicycles and patience.',
    ai: 'boss_charge', scale: 2.4, knockRes: 0.96, abilities: ['summon', 'slam', 'charge2', 'volley'],
    sprite: { key: 'b_gen', undead: 1, boss: 1, bossRim: 'rgba(140,255,74,.9)', coat: '#4a5840', coatAlt: '#c9a24a', pants: '#3e4a36', shirt: '#5a6a4e', hair: '#1a1410', hairStyle: 'crop', hat: 'brodie', hatCol: '#3e4a36', hold: 'rifle', eye: '#8cff4a', scale: 2.4 }
  },
  generalsekretar: {
    id: 'generalsekretar', name: 'THE GENERAL SECRETARY', hp: 300000, speed: 46, dmg: 84, r: 28, xp: 24000,
    sub: 'Signed the order for the Wall in 1961. Has not signed anything since.',
    ai: 'boss_charge', scale: 2.4, knockRes: 0.97, abilities: ['summon', 'volley', 'slam', 'rings'],
    sprite: { key: 'b_gensek', undead: 1, boss: 1, bossRim: 'rgba(216,50,74,.9)', coat: '#3a3f4a', coatAlt: '#d8324a', pants: '#32363f', shirt: '#efe8d4', tie: '#d8324a', hair: '#c8c4b8', hairStyle: 'thin', face: 'glasses', hat: 'ushanka', hatCol: '#2f333c', eye: '#ff4a4a', scale: 2.4 }
  },
  thedeck: {
    id: 'thedeck', name: 'THE ACE OF SPADES', hp: 480000, speed: 44, dmg: 96, r: 30, xp: 38000,
    sub: 'Number one in the deck of fifty-five. Still at large, technically.',
    ai: 'boss_charge', scale: 2.5, knockRes: 0.97, abilities: ['summon', 'volley', 'slam', 'charge2'],
    sprite: { key: 'b_deck', undead: 1, boss: 1, bossRim: 'rgba(210,215,230,.9)', coat: '#1a1a22', coatAlt: '#c8ccd6', pants: '#22222c', shirt: '#e8e4d8', hair: '#1a1410', hairStyle: 'part', face: 'fullbeard', facialCol: '#1a1410', hat: 'peaked', hatCol: '#101018', hatAccent: '#c8ccd6', hold: 'flag', holdCol: '#3a3a44', flagCol: '#1a1a22', eye: '#ffe14a', scale: 2.5 }
  },
  themullah: {
    id: 'themullah', name: 'THE ONE-EYED COMMANDER', hp: 760000, speed: 50, dmg: 110, r: 30, xp: 56000,
    sub: 'Ran a country from a motorcycle and a mud compound.',
    ai: 'boss_charge', scale: 2.5, knockRes: 0.98, abilities: ['summon', 'slam', 'charge2', 'volley'],
    sprite: { key: 'b_mullah', undead: 1, boss: 1, bossRim: 'rgba(94,194,106,.9)', coat: '#3a4038', coatAlt: '#5ec26a', pants: '#32382f', shirt: '#6a7060', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'turban', hatCol: '#20241f', eye: '#8cff9a', scale: 2.5 }
  },
  thecommander: {
    id: 'thecommander', name: 'THE QUDS COMMANDER', hp: 1200000, speed: 54, dmg: 126, r: 30, xp: 82000,
    sub: 'Ran every proxy from Beirut to Basra out of one small office.',
    ai: 'boss_final', scale: 2.6, knockRes: 0.98, isFinal: true,
    abilities: ['summon', 'volley', 'slam', 'charge2', 'rings'],
    sprite: { key: 'b_quds', undead: 1, boss: 1, bossRim: 'rgba(94,194,106,.95)', coat: '#22322a', coatAlt: '#5ec26a', pants: '#1e2c24', shirt: '#3a4a3a', hair: '#c8c4b8', hairStyle: 'crop', face: 'fullbeard', facialCol: '#c8c4b8', hat: 'peaked', hatCol: '#14181a', hatAccent: '#5ec26a', eye: '#8cff9a', scale: 2.6 }
  },
  omicron: {
    id: 'omicron', name: 'PATIENT ZERO', hp: 1900000, speed: 58, dmg: 140, r: 32, xp: 120000,
    sub: 'The original sample. Everything since has been a copy of a copy of this.',
    ai: 'boss_final', scale: 2.8, knockRes: 1,
    abilities: ['summon', 'volley', 'slam', 'charge2', 'rings', 'bomb'],
    sprite: { key: 'b_zero', undead: 1, boss: 1, bossRim: 'rgba(255,74,160,.95)', skin: '#d87ab0', coat: '#8a2a60', coatAlt: '#ff4aa0', pants: '#701f4e', shirt: '#c05a86', hair: '#5a1030', hairStyle: 'none', face: 'gasmask', eye: '#ff4aa0', scale: 2.8 }
  },

  /* Wuhan's ninth strongpoint. The boss is the INSTITUTION, drawn as an
     anonymous figure in a positive-pressure suit — no real researcher is
     named or caricatured, which keeps this inside the same line the nine
     armies sit behind: the joke is the uniform, not the people in it. */
  wiv: {
    id: 'wiv', name: 'THE INSTITUTE', hp: 1900000, speed: 50, dmg: 140, r: 32, xp: 120000,
    sub: 'Biosafety level four. The freezer logs stop on the last day of the year.',
    ai: 'boss_final', scale: 2.8, knockRes: 1,
    abilities: ['summon', 'volley', 'slam', 'rings', 'bomb'],
    sprite: { key: 'b_wiv', undead: 1, boss: 1, bossRim: 'rgba(74,255,224,.95)', skin: '#cfe4e2', coat: '#e6eef0', coatAlt: '#4ad0c0', pants: '#c4d2d4', shirt: '#f2f8fa', hair: '#38484a', hairStyle: 'none', face: 'gasmask', eye: '#4affe0', scale: 2.8 }
  }
};

/* ---- mini-bosses added by the campaign ---- */
const CAMPAIGN_MINIS = [
  { id: 'picketman', name: 'THE COLOUR BEARER', tier: 1, lvl: 18,
    sub: 'Carried the flag up the ridge. Four men carried it before him.',
    hp: 9000, speed: 46, dmg: 32, r: 16, xp: 520, gold: 170,
    ai: 'march', scale: 1.5, knockRes: 0.7, mini: 1, abilities: ['summon', 'volley'],
    sprite: { key: 'm_colour', undead: 1, boss: 1, bossRim: 'rgba(200,180,150,.85)', coat: '#7a7060', coatAlt: '#c9a24a', pants: '#6a6252', shirt: '#8a8272', hair: '#3a2c1a', hairStyle: 'crop', hat: 'kepi', hatCol: '#5a5346', hold: 'flag', holdCol: '#6a5238', flagCol: '#b8323a', eye: '#c8ff4a', scale: 1.5 } },
  { id: 'railbaron', name: 'THE RAILROAD BARON', tier: 2, lvl: 27,
    sub: 'Owns the track, the town, and the sheriff. Owned. Present tense is doing a lot of work.',
    hp: 20000, speed: 42, dmg: 40, r: 16, xp: 900, gold: 900,
    ai: 'charger', scale: 1.5, knockRes: 0.75, mini: 1, abilities: ['summon', 'slam'],
    sprite: { key: 'm_baron', undead: 1, boss: 1, bossRim: 'rgba(242,193,78,.85)', coat: '#2a2a34', coatAlt: '#f2c14e', pants: '#22222c', shirt: '#efe8d4', tie: '#8a2a3a', hair: '#8a8272', hairStyle: 'part', stache: true, facialCol: '#8a8272', hat: 'stovepipe', hatCol: '#1a1a22', hold: 'lantern', eye: '#ffe14a', scale: 1.5 } },
  { id: 'commissar', name: 'THE POLITICAL OFFICER', tier: 4, lvl: 45,
    sub: 'Attached to the unit to ensure enthusiasm. Enthusiasm is mandatory.',
    hp: 90000, speed: 50, dmg: 62, r: 17, xp: 3200, gold: 620,
    ai: 'charger', scale: 1.55, knockRes: 0.85, mini: 1, abilities: ['summon', 'volley', 'slam'],
    sprite: { key: 'm_comm', undead: 1, boss: 1, bossRim: 'rgba(216,50,74,.85)', coat: '#3a4a5a', coatAlt: '#d8324a', pants: '#2f3c48', shirt: '#4a5a68', hair: '#2e2418', hairStyle: 'part', stache: true, facialCol: '#2e2418', hat: 'peaked', hatCol: '#2a3038', hatAccent: '#d8324a', hold: 'saber', eye: '#ff4a4a', scale: 1.55 } },
  { id: 'tunnelrat', name: 'THE TUNNEL KING', tier: 5, lvl: 54,
    sub: 'Lived underground for six years. Prefers it. Comes up only for this.',
    hp: 160000, speed: 88, dmg: 72, r: 15, xp: 5200, gold: 800,
    ai: 'charger', scale: 1.45, knockRes: 0.88, mini: 1, abilities: ['charge2', 'summon'],
    sprite: { key: 'm_tunnel', undead: 1, boss: 1, bossRim: 'rgba(140,255,74,.85)', coat: '#3a4a34', coatAlt: '#2a3626', pants: '#33422d', shirt: '#48583e', hair: '#1a1410', hairStyle: 'crop', hat: 'none', hold: 'saber', eye: '#8cff4a', scale: 1.45 } },
  { id: 'ridgerunner', name: 'THE RIDGE RUNNER', tier: 6, lvl: 63,
    sub: 'Covers nine thousand feet of vertical in a day, in sandals.',
    hp: 280000, speed: 100, dmg: 86, r: 16, xp: 8000, gold: 1100,
    ai: 'swarm', scale: 1.5, knockRes: 0.9, mini: 1, abilities: ['charge2', 'slam'],
    sprite: { key: 'm_ridge', undead: 1, boss: 1, bossRim: 'rgba(200,255,120,.85)', coat: '#7a7258', coatAlt: '#5a5440', pants: '#6a6450', shirt: '#8a8268', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'turban', hatCol: '#6a6450', hold: 'rifle', eye: '#c8ff4a', scale: 1.5 } },
  { id: 'superspreader', name: 'THE SUPERSPREADER', tier: 7, lvl: 72,
    sub: 'One event. Three hundred and eleven confirmed cases.',
    hp: 460000, speed: 62, dmg: 104, r: 20, xp: 13000, gold: 1600,
    ai: 'charger', scale: 1.8, knockRes: 0.93, mini: 1, abilities: ['summon', 'summon', 'rings'],
    sprite: { key: 'm_spread', undead: 1, boss: 1, bossRim: 'rgba(255,74,160,.9)', skin: '#d87ab0', coat: '#a03a6a', coatAlt: '#ff4aa0', pants: '#8a3258', shirt: '#c05a86', hair: '#6a1a3a', hairStyle: 'crop', eye: '#ff4aa0', scale: 1.8 } }
];

/* ------------------------------------------------------------
   Indexes. Everything downstream now looks factions and bosses up
   BY ID rather than by array position, so stages can name them.
   ------------------------------------------------------------ */
for (const f of CAMPAIGN_FACTIONS) { f.units = f.units || []; FACTIONS.push(f); }
for (const m of CAMPAIGN_MINIS) MINI_BOSSES.push(m);

const FACTION_BY_ID = {};
for (const f of FACTIONS) FACTION_BY_ID[f.id] = f;

const MINI_BY_ID = {};
for (const m of MINI_BOSSES) MINI_BY_ID[m.id] = m;

/* Original nine faction bosses are addressable by id too, so a stage
   can hand any of them a building. */
for (const f of FACTIONS) if (f.boss) STAGE_BOSSES[f.boss.id] = f.boss;

/* Rebuild the flat unit index now that the campaign factions are in. */
ALL_UNITS.length = 0; ALL_UNIT_DEFS.length = 0;
for (const f of FACTIONS) {
  for (const u of f.units) { ALL_UNITS.push({ unit: u, faction: f }); ALL_UNIT_DEFS.push(u); }
}

/* ============================================================
   PERIOD FACTIONS AND NAMED HISTORICAL COMMANDERS

   Two changes to how enemies are built:

   1. LIVING, NOT UNDEAD. A faction marked `living` has the undead
      treatment stripped from its unit sprites at load — no green skin,
      no hollow eyes, no slack jaw. Williamsburg fields redcoats,
      Gettysburg fields Confederates, and they look like soldiers.

   2. NAMED COMMANDERS. Every strongpoint on every stage is held by a
      real historical figure with a real reason to be there, rather than
      a boss definition recycled across tiers. Stats still come from the
      tier curve in spawner.js, so a name is one line: the ladder from
      level 6 to level 88 is unaffected by who is standing on it.
   ============================================================ */

const PERIOD_FACTIONS = [
  {
    id: 'crown', name: 'HIS MAJESTY\'S FORCES', living: 1,
    banner: 'THE REDCOATS HOLD THE TOWN',
    sub: 'The 33rd Regiment of Foot, and they have not been relieved.',
    units: [
      { id: 'foot33', name: 'Regular of Foot', hp: 30, speed: 37, dmg: 10, r: 8, xp: 2, ai: 'march', weight: 4,
        sprite: { key: 'p_foot33', coat: '#b8242e', coatAlt: '#efe8d4', pants: '#d8d0b8', shirt: '#efe8d4', hair: '#e8e6dc', hairStyle: 'wig', hat: 'shako', hatCol: '#191922', hatAccent: '#c9a24a', hold: 'musket', scale: 0.78 } },
      { id: 'grenadier2', name: 'Grenadier', hp: 56, speed: 32, dmg: 14, r: 10, xp: 3, ai: 'march', weight: 2, knockRes: 0.35,
        sprite: { key: 'p_gren2', coat: '#c8323a', coatAlt: '#f2c14e', pants: '#d8d0b8', shirt: '#efe8d4', hair: '#e8e6dc', hairStyle: 'wig', hat: 'shako', hatCol: '#0f0f16', hatAccent: '#f2c14e', hold: 'musket', scale: 0.89 } },
      { id: 'hessian', name: 'Hessian Jäger', hp: 44, speed: 40, dmg: 12, r: 8, xp: 3, ai: 'march', weight: 2,
        sprite: { key: 'p_hess', coat: '#2f4a30', coatAlt: '#c9a24a', pants: '#d8d0b8', shirt: '#efe8d4', hair: '#3a2c1a', hairStyle: 'wig', stache: true, facialCol: '#3a2c1a', hat: 'pickelhaube', hatCol: '#2a2418', hatAccent: '#c9a24a', hold: 'rifle', scale: 0.78 } },
      { id: 'dragoon2', name: 'Light Dragoon', hp: 36, speed: 53, dmg: 13, r: 8, xp: 3, ai: 'charger', weight: 1,
        sprite: { key: 'p_drag2', coat: '#9a1c26', coatAlt: '#c9a24a', pants: '#c9b07a', shirt: '#efe8d4', hair: '#c8c4b8', hairStyle: 'wig', hat: 'brodie', hatCol: '#3a3a44', hold: 'saber', scale: 0.78 } }
    ]
  },
  {
    id: 'csa', name: 'THE ARMY OF NORTHERN VIRGINIA', living: 1,
    banner: 'THE CONFEDERATE LINE ADVANCES',
    sub: 'Pennsylvania, July 1863. Seventy-five thousand of them came north.',
    units: [
      { id: 'csainf', name: 'Infantryman', hp: 44, speed: 39, dmg: 12, r: 8, xp: 3, ai: 'march', weight: 4,
        sprite: { key: 'p_csainf', coat: '#8a8270', coatAlt: '#6a6252', pants: '#7a7262', shirt: '#9a9282', hair: '#3a2c1a', hairStyle: 'crop', face: 'fullbeard', facialCol: '#3a2c1a', hat: 'kepi', hatCol: '#5a6a52', hold: 'musket', scale: 0.79 } },
      { id: 'csavet', name: 'Veteran of the Valley', hp: 60, speed: 36, dmg: 15, r: 9, xp: 4, ai: 'march', weight: 2,
        sprite: { key: 'p_csavet', coat: '#6a7258', coatAlt: '#4a5240', pants: '#5a6248', shirt: '#8a8272', hair: '#8a8272', hairStyle: 'thin', face: 'fullbeard', facialCol: '#8a8272', hat: 'fedora', hatCol: '#4a4438', hold: 'rifle', scale: 0.85 } },
      { id: 'csacav', name: "Stuart's Cavalry", hp: 38, speed: 56, dmg: 14, r: 8, xp: 4, ai: 'charger', weight: 1, mounted: 1,
        sprite: { key: 'p_csacav', mounted: 1, coat: '#6a6252', coatAlt: '#c9a24a', pants: '#5c5646', shirt: '#7a7264', hair: '#2e2418', hairStyle: 'crop', face: 'fullbeard', facialCol: '#2e2418', hat: 'campaign', hatCol: '#4a4438', hold: 'saber', scale: 0.8 } },
      { id: 'csagun', name: 'Napoleon Gun Crew', hp: 108, speed: 26, dmg: 20, r: 11, xp: 6, ai: 'shooter', weight: 1,
        shootRange: 250, shootRate: 2.4, shotDmg: 22, shotSpeed: 140,
        sprite: { key: 'p_csagun', coat: '#5a5446', coatAlt: '#c9a24a', pants: '#4a4438', shirt: '#6a6252', hair: '#3a2c1a', hairStyle: 'part', stache: true, facialCol: '#3a2c1a', hat: 'kepi', hatCol: '#44403a', scale: 0.98 } }
    ]
  },
  {
    id: 'colonial', name: 'THE SPANISH COLONIAL ARMY', living: 1,
    banner: 'THE COLONIAL GARRISON TURNS OUT',
    sub: 'Rayadillo blues, Mauser rifles, and orders from a Madrid that has stopped writing.',
    units: [
      { id: 'rayad2', name: 'Rayadillo Infantry', hp: 82, speed: 40, dmg: 17, r: 8, xp: 5, ai: 'march', weight: 4,
        sprite: { key: 'p_rayad2', skin: '#d8a878', coat: '#b8c4cc', coatAlt: '#8a96a0', pants: '#a8b4bc', shirt: '#c8d4dc', hair: '#1a1410', hairStyle: 'crop', stache: true, facialCol: '#1a1410', hat: 'cap', hatCol: '#9aa6ae', hold: 'rifle', scale: 0.82 } },
      { id: 'guardia2', name: 'Guardia Civil', hp: 148, speed: 31, dmg: 23, r: 11, xp: 8, ai: 'tank', weight: 2, knockRes: 0.5,
        sprite: { key: 'p_guardia2', skin: '#d8a878', coat: '#2a3038', coatAlt: '#c9a24a', pants: '#232830', shirt: '#3a4048', hair: '#1a1410', hairStyle: 'crop', face: 'fullbeard', facialCol: '#1a1410', hat: 'tricorn', hatCol: '#14181c', hatAccent: '#c9a24a', scale: 1.0 } },
      { id: 'soldadera', name: 'Mexican Irregular', hp: 70, speed: 44, dmg: 18, r: 8, xp: 5, ai: 'march', weight: 2,
        sprite: { key: 'p_soldad', skin: '#c8945e', coat: '#8a7450', coatAlt: '#c02a3a', pants: '#7a6644', shirt: '#c8bc9a', hair: '#1a1410', hairStyle: 'crop', stache: true, facialCol: '#1a1410', hat: 'sombrero', hatCol: '#6a5636', hatAccent: '#c9a24a', hold: 'rifle', scale: 0.82 } }
    ]
  },
  {
    /* Named nations and their actual horse warriors, treated the same way
       every other army here is: real leaders, real tactics, no caricature.
       Deliberately fast and deliberately rare — a small number of superb
       light cavalry, which is what they were. */
    /* A small share on purpose: superb light cavalry, not a mob. */
    id: 'plains', name: 'THE COMANCHE AND APACHE HORSE WARRIORS', living: 1, share: 0.2,
    banner: 'HORSE WARRIORS ON THE RIDGE',
    sub: 'The finest light cavalry on the continent, and they know this ground.',
    units: [
      { id: 'horseman', name: 'Mounted Warrior', hp: 66, speed: 74, dmg: 20, r: 9, xp: 7, ai: 'charger', weight: 1, mounted: 1,
        sprite: { key: 'p_horse', mounted: 1, skin: '#b8804e', coat: '#8a5a38', coatAlt: '#c9a24a', pants: '#7a4f30', shirt: '#a8703f', hair: '#1a1410', hairStyle: 'tall', hat: 'none', hold: 'saber', scale: 0.84 } },
      { id: 'scout', name: 'Scout', hp: 54, speed: 82, dmg: 17, r: 8, xp: 7, ai: 'swarm', weight: 1, mounted: 1,
        sprite: { key: 'p_scout', mounted: 1, skin: '#b8804e', coat: '#6a4a30', coatAlt: '#8a6a3a', pants: '#5c3f26', shirt: '#8a6040', hair: '#1a1410', hairStyle: 'tall', hat: 'none', hold: 'rifle', scale: 0.82 } }
    ]
  },
  {
    /* The Third Reich. Insignia is the Iron Cross and SS-style bolts —
       the actual party symbol is left out, as every mainstream WWII game
       does, because it is illegal to display in several countries and
       adds nothing the uniform doesn't already say. */
    id: 'reich', name: 'THE THIRD REICH', living: 1,
    banner: 'THE SS HOLDS THE LINE',
    sub: 'Waffen-SS and Wehrmacht, dug in and refusing the order to withdraw.',
    units: [
      { id: 'landser2', name: 'Landser', hp: 155, speed: 36, dmg: 16, r: 8, xp: 8, ai: 'march', weight: 4,
        sprite: { key: 'p_landser', coat: '#4a5240', coatAlt: '#2e3428', pants: '#3a4034', shirt: '#5a6248', hair: '#c8b884', hairStyle: 'crop', hat: 'stahlhelm', hatCol: '#333a32', hold: 'rifle', scale: 0.83 } },
      { id: 'sspanzer', name: 'SS Panzergrenadier', hp: 290, speed: 34, dmg: 22, r: 11, xp: 12, ai: 'tank', weight: 2, knockRes: 0.6,
        sprite: { key: 'p_sspz', coat: '#22252a', coatAlt: '#c8ccd6', pants: '#1c1f24', shirt: '#3a4034', hair: '#c8b884', hairStyle: 'crop', hat: 'stahlhelm', hatCol: '#1e2126', hatAccent: '#c8ccd6', scale: 1.0 } },
      { id: 'fallschirm2', name: 'Fallschirmjäger', hp: 130, speed: 56, dmg: 18, r: 8, xp: 10, ai: 'charger', weight: 1,
        sprite: { key: 'p_fall2', coat: '#565c44', coatAlt: '#3a4032', pants: '#464c38', shirt: '#5a6248', hair: '#c8b884', hairStyle: 'crop', hat: 'brodie', hatCol: '#3e443a', hold: 'rifle', scale: 0.83 } }
    ]
  }
];

for (const f of PERIOD_FACTIONS) FACTIONS.push(f);

/* Living factions lose the undead treatment on every sprite they own. */
for (const f of FACTIONS) {
  if (!f.living) continue;
  for (const u of f.units) if (u.sprite) { delete u.sprite.undead; delete u.sprite.eye; }
}

/* ------------------------------------------------------------
   NAMED COMMANDERS

   `bs(id, name, note, sprite)` — the stats come from the tier curve,
   so all a commander needs is who they were and what they look like.
   ------------------------------------------------------------ */
function bs(id, name, sub, sprite) {
  /* hp and dmg are supplied by the tier curve at deploy time, but speed,
     radius and xp must still be real numbers here — leaving them out
     produced NaN positions on every named commander. */
  return { id, name, sub, ai: 'boss_charge', knockRes: 0.94,
           hp: 5000, dmg: 30, speed: 42, r: 26, xp: 900,
           abilities: ['summon', 'volley', 'slam'], scale: 2.2,
           sprite: Object.assign({ key: 'cmd_' + id, boss: 1, scale: 2.2 }, sprite) };
}

/* Shared uniform bases, so a commander is one line. */
const U_BRIT   = { coat: '#d8324a', coatAlt: '#f2c14e', pants: '#efe8d4', shirt: '#efe8d4', hair: '#f4f2ea', hairStyle: 'wig', hat: 'tricorn', hatCol: '#0f0f16', hatAccent: '#f2c14e', hold: 'saber', bossRim: 'rgba(242,193,78,.9)' };
const U_CSA    = { coat: '#6a7258', coatAlt: '#c9a24a', pants: '#5a6248', shirt: '#e8e4d8', hair: '#c8c0b0', hairStyle: 'part', face: 'fullbeard', facialCol: '#c8c0b0', hat: 'campaign', hatCol: '#4a5240', hold: 'saber', bossRim: 'rgba(180,190,200,.9)' };
const U_SPAIN  = { skin: '#d8a878', coat: '#2a3038', coatAlt: '#f2c14e', pants: '#232830', shirt: '#efe8d4', hair: '#1a1410', hairStyle: 'part', face: 'fullbeard', facialCol: '#1a1410', hat: 'tricorn', hatCol: '#14181c', hatAccent: '#f2c14e', hold: 'saber', bossRim: 'rgba(242,193,78,.9)' };
const U_PLAINS = { skin: '#b8804e', coat: '#8a5a38', coatAlt: '#c9a24a', pants: '#7a4f30', shirt: '#a8703f', hair: '#1a1410', hairStyle: 'tall', hat: 'none', hold: 'saber', bossRim: 'rgba(216,140,60,.9)' };
const U_REICH  = { coat: '#22252a', coatAlt: '#c8ccd6', pants: '#1c1f24', shirt: '#3a4034', hair: '#c8b884', hairStyle: 'part', hat: 'peaked', hatCol: '#1a1d21', hatAccent: '#c8ccd6', hold: 'club', bossRim: 'rgba(200,205,220,.9)' };

Object.assign(STAGE_BOSSES, {
  /* ---------------- 1. WILLIAMSBURG, 1781 ---------------- */
  ferguson:  bs('ferguson', 'MAJOR PATRICK FERGUSON', 'Invented a breech-loading rifle the army ignored. Died at King\'s Mountain.', U_BRIT),
  tarleton:  bs('tarleton', 'BANASTRE TARLETON', '"Bloody Ban". His name became a byword after the Waxhaws.', Object.assign({}, U_BRIT, { hat: 'brodie', hatCol: '#2a2a34' })),
  andre:     bs('andre', 'MAJOR JOHN ANDRÉ', 'Ran Benedict Arnold as an agent. Hanged as a spy at Tappan.', Object.assign({}, U_BRIT, { hat: 'fedora' })),
  arnold:    bs('arnold', 'BENEDICT ARNOLD', 'Hero of Saratoga, then the most famous traitor in the language. Burned Richmond in 1781.', Object.assign({}, U_BRIT, { coat: '#1f3352', coatAlt: '#c9b07a' })),
  graves:    bs('graves', 'ADMIRAL THOMAS GRAVES', 'Lost the Battle of the Chesapeake, and with it Cornwallis\'s only way out.', Object.assign({}, U_BRIT, { coat: '#14213f', hat: 'tricorn' })),
  phillips:  bs('phillips', 'GENERAL WILLIAM PHILLIPS', 'Commanded the Virginia raids. Died of fever at Petersburg with the war unfinished.', U_BRIT),
  rawdon:    bs('rawdon', 'LORD RAWDON', 'Twenty-six years old and commanding the whole southern interior.', U_BRIT),
  cornwallis2: bs('cornwallis2', 'GENERAL CHARLES CORNWALLIS', 'Surrendered here in 1781 and sent a deputy to hand over the sword.', U_BRIT),

  /* ---------------- 2. GETTYSBURG, 1863 ---------------- */
  heth:      bs('heth', 'GENERAL HENRY HETH', 'Went looking for shoes on 1 July and started the largest battle of the war.', U_CSA),
  early:     bs('early', 'GENERAL JUBAL EARLY', 'Took the town on the first day. Spent the rest of his life arguing about the second.', U_CSA),
  ewell:     bs('ewell', 'GENERAL RICHARD EWELL', 'Told to take Cemetery Hill "if practicable". Judged it not practicable.', Object.assign({}, U_CSA, { hairStyle: 'bald' })),
  hood:      bs('hood', 'GENERAL JOHN BELL HOOD', 'Asked three times to go round the Round Tops. Refused three times, attacked, and lost the use of an arm.', U_CSA),
  mclaws:    bs('mclaws', 'GENERAL LAFAYETTE McLAWS', 'Took the Peach Orchard and could not hold what taking it cost.', U_CSA),
  stuart:    bs('stuart', 'GENERAL J.E.B. STUART', 'Rode round the entire Union army and arrived two days after he was needed.', Object.assign({}, U_CSA, { hat: 'campaign', hatAccent: '#c9a24a', coatAlt: '#f2c14e' })),
  pickett:   bs('pickett', 'GENERAL GEORGE PICKETT', 'Thirteen thousand men across three-quarters of a mile of open ground. Half came back.', U_CSA),
  longstreet: bs('longstreet', 'GENERAL JAMES LONGSTREET', 'Lee\'s "old war horse", who argued against the charge and was overruled.', U_CSA),
  lee:       bs('lee', 'GENERAL ROBERT E. LEE', 'Rode out to meet the survivors saying "it is all my fault". It was.', Object.assign({}, U_CSA, { coat: '#8a9280', bossRim: 'rgba(242,193,78,.95)' })),

  /* ---------------- 3. THE EXPANDING WEST, 1898 ---------------- */
  weyler:    bs('weyler', 'GOVERNOR-GENERAL VALERIANO WEYLER', 'Invented the reconcentration camp. The press called him the Butcher and were not exaggerating.', U_SPAIN),
  linares:   bs('linares', 'GENERAL ARSENIO LINARES', 'Held Santiago with a garrison he knew could not be relieved.', U_SPAIN),
  varadelrey: bs('varadelrey', 'GENERAL JOAQUÍN VARA DEL REY', 'Held El Caney all day against ten times his number. Both armies saluted the body.', U_SPAIN),
  cervera:   bs('cervera', 'ADMIRAL PASCUAL CERVERA', 'Sailed out of Santiago into a battle he had written to Madrid to say he would lose.', Object.assign({}, U_SPAIN, { coat: '#14213f' })),
  quanah:    bs('quanah', 'QUANAH PARKER', 'Last war chief of the Comanche. Never lost a battle to the army and negotiated the terms himself.', U_PLAINS),
  victorio:  bs('victorio', 'VICTORIO', 'Ran a campaign across two countries with sixty men and was never once caught in the open.', U_PLAINS),
  lozen:     bs('lozen', 'LOZEN', 'Warrior and strategist of the Chihenne Apache. Her brother called her a shield to her people.', Object.assign({}, U_PLAINS, { hairStyle: 'poof' })),
  torral:    bs('torral', 'GENERAL JOSÉ TORAL', 'Signed the surrender of eastern Cuba and was court-martialled at home for it.', U_SPAIN),
  blanco:    bs('blanco', 'GOVERNOR-GENERAL RAMÓN BLANCO', 'Sent to undo Weyler. Arrived far too late for it to matter.', U_SPAIN),

  /* ---------------- 4. THE WESTERN FRONT, 1944 ---------------- */
  meyer:     bs('meyer', 'SS-STANDARTENFÜHRER KURT MEYER', 'Convicted for the murder of Canadian prisoners at the Ardenne Abbey.', U_REICH),
  peiper:    bs('peiper', 'SS-OBERSTURMBANNFÜHRER JOACHIM PEIPER', 'His column murdered eighty-four American prisoners in a field at Malmedy.', U_REICH),
  dietrich:  bs('dietrich', 'SEPP DIETRICH', 'Hitler\'s former bodyguard, given an army he was nowhere near able to command.', U_REICH),
  rundstedt: bs('rundstedt', 'FIELD MARSHAL GERD VON RUNDSTEDT', 'Asked what to do about the invasion, said: make peace, you fools.', Object.assign({}, U_REICH, { coat: '#3a4038' })),
  rommel:    bs('rommel', 'FIELD MARSHAL ERWIN ROMMEL', 'Built the Atlantic Wall, then was handed poison and a choice about how the news would read.', Object.assign({}, U_REICH, { coat: '#5a6250', hatCol: '#4a5040' })),
  goring:    bs('goring', 'REICHSMARSCHALL HERMANN GÖRING', 'Promised the Luftwaffe could stop the landings. It could not find them.', Object.assign({}, U_REICH, { coat: '#8a94a0', scale: 2.4 })),
  himmler:   bs('himmler', 'HEINRICH HIMMLER', 'Ran the camps from a desk and fainted the one time he watched.', Object.assign({}, U_REICH, { face: 'glasses' })),
  bormann:   bs('bormann', 'MARTIN BORMANN', 'Controlled who reached Hitler, which by 1944 was most of the power there was.', U_REICH),
  hitler:    bs('hitler', 'ADOLF HITLER', 'Directed divisions that no longer existed from a bunker under a burning city.', Object.assign({}, U_REICH, { coat: '#3a4038', stache: true, facialCol: '#2a2418', hat: 'peaked', bossRim: 'rgba(216,50,74,.95)', scale: 2.5 }))
});

/* Re-index now that the period factions and commanders are in. */
for (const f of PERIOD_FACTIONS) FACTION_BY_ID[f.id] = f;
for (const f of FACTIONS) if (f.boss) STAGE_BOSSES[f.boss.id] = f.boss;
ALL_UNITS.length = 0; ALL_UNIT_DEFS.length = 0;
for (const f of FACTIONS) {
  for (const u of f.units) { ALL_UNITS.push({ unit: u, faction: f }); ALL_UNIT_DEFS.push(u); }
}

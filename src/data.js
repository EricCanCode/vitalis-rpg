export const ASSETS = {
  town: 'assets/environment/town_hub.png',
  ruins: 'assets/intro/ruins.png',
  heroKael: 'assets/sprites/hero_kael.png?v=motion2',
  heroMira: 'assets/sprites/hero_mira.png?v=motion2',
  heroRowan: 'assets/sprites/hero_rowan.png?v=motion2',
  heroNyx: 'assets/sprites/hero_nyx.png?v=motion2',
  heroKaelBattle: 'assets/sprites/hero_kael_battle.png?v=motion2',
  heroMiraBattle: 'assets/sprites/hero_mira_battle.png?v=motion2',
  heroRowanBattle: 'assets/sprites/hero_rowan_battle.png?v=motion2',
  heroNyxBattle: 'assets/sprites/hero_nyx_battle.png?v=motion2',
  villagerIdle: 'assets/sprites/villager_idle.png?v=motion2',
  goblinIdle: 'assets/sprites/goblin_idle.png?v=motion2',
  orcIdle: 'assets/sprites/orc_idle.png?v=motion2',
  trollIdle: 'assets/sprites/troll_idle.png?v=motion2',
  caveLizardIdle: 'assets/sprites/cave_lizard_idle.png?v=motion2'
};

export const WEAPONS = {
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', type: 'weapon', atk: 4, mag: 0, cost: 0 },
  ember_staff: { id: 'ember_staff', name: 'Ember Staff', type: 'weapon', atk: 1, mag: 5, cost: 45 },
  oak_wand: { id: 'oak_wand', name: 'Oak Wand', type: 'weapon', atk: 1, mag: 3, cost: 28 },
  twin_daggers: { id: 'twin_daggers', name: 'Twin Daggers', type: 'weapon', atk: 5, mag: 0, cost: 36 },
  guardian_mace: { id: 'guardian_mace', name: 'Guardian Mace', type: 'weapon', atk: 3, mag: 2, cost: 38 }
};

export const ITEMS = {
  potion: { id: 'potion', name: 'Potion', kind: 'heal', amount: 22, cost: 12, target: 'ally', description: 'Restores 22 HP.' },
  ether: { id: 'ether', name: 'Ether', kind: 'mp', amount: 10, cost: 18, target: 'ally', description: 'Restores 10 MP.' },
  fire_bomb: { id: 'fire_bomb', name: 'Fire Bomb', kind: 'damageAll', amount: 14, cost: 26, target: 'allEnemies', description: 'Deals 14 damage to all enemies.' },
  vitalis_shard: { id: 'vitalis_shard', name: 'Vitalis Shard', kind: 'key', amount: 0, cost: 0, target: 'none', description: 'A warm fragment from the crystal cave.' }
};

export const SPELLS = {
  firebolt: { id: 'firebolt', name: 'Firebolt', mp: 4, power: 10, target: 'enemy', stat: 'mag' },
  flame_wave: { id: 'flame_wave', name: 'Flame Wave', mp: 8, power: 8, target: 'allEnemies', stat: 'mag' },
  spark: { id: 'spark', name: 'Spark', mp: 3, power: 7, target: 'enemy', stat: 'mag' },
  quick_strike: { id: 'quick_strike', name: 'Quick Strike', mp: 4, power: 6, target: 'enemy', stat: 'atk' },
  mend: { id: 'mend', name: 'Mend', mp: 5, power: 12, target: 'ally', stat: 'mag' },
  shield_prayer: { id: 'shield_prayer', name: 'Shield Prayer', mp: 7, power: 6, target: 'partyShield', stat: 'mag' },
  rally: { id: 'rally', name: 'Rally', mp: 4, power: 6, target: 'party', stat: 'atk' },
  guard_break: { id: 'guard_break', name: 'Guard Break', mp: 5, power: 8, target: 'enemy', stat: 'atk' },
  cleave: { id: 'cleave', name: 'Cleave', mp: 6, power: 5, target: 'allEnemies', stat: 'atk' },
  inferno: { id: 'inferno', name: 'Inferno', mp: 11, power: 13, target: 'allEnemies', stat: 'mag' },
  renewal: { id: 'renewal', name: 'Renewal', mp: 10, power: 22, target: 'ally', stat: 'mag' },
  shadowstep: { id: 'shadowstep', name: 'Shadowstep', mp: 7, power: 13, target: 'enemy', stat: 'atk' }
};

export const ABILITY_UNLOCKS = [
  { characterId: 'kael', level: 2, spellId: 'cleave' },
  { characterId: 'mira', level: 2, spellId: 'inferno' },
  { characterId: 'rowan', level: 2, spellId: 'renewal' },
  { characterId: 'nyx', level: 2, spellId: 'shadowstep' }
];

export const AREA_THEMES = {
  forest_road: {
    battleKey: 'town',
    tint: 0x1d3324,
    tintAlpha: 0.24,
    ground: 0x17211f,
    accent: 0x66d17b,
    note: 'Open road. Goblins are quick, but fragile.'
  },
  old_ruins: {
    battleKey: 'ruins',
    tint: 0x2a231e,
    tintAlpha: 0.34,
    ground: 0x17120f,
    accent: 0xf3c65f,
    note: 'Broken stone. Orcs brace and hit harder.'
  },
  crystal_cave: {
    battleKey: 'ruins',
    tint: 0x12263b,
    tintAlpha: 0.44,
    ground: 0x101926,
    accent: 0x69a7ff,
    note: 'Cold echoes. Cave beasts strike fast around trolls.'
  }
};

export const ENEMY_TYPES = {
  goblin: { texture: 'goblinIdle', scale: 0.86 },
  orc: { texture: 'orcIdle', scale: 0.94 },
  troll: { texture: 'trollIdle', scale: 1.02 },
  cave_lizard: { texture: 'caveLizardIdle', scale: 0.86 }
};

export const BESTIARY = {
  goblin: {
    name: 'Hollow Goblin',
    family: 'Skirmisher',
    trait: 'Fast and fragile. They pressure wounded party members but fall quickly to focused attacks.',
    advice: 'Basic attacks are enough. Save expensive magic unless two are standing together.',
    intent: 'Usually attacks, sometimes winds up for a heavier strike.'
  },
  orc: {
    name: 'Orc Bruiser',
    family: 'Frontliner',
    trait: 'Sturdier than goblins and fond of guarding before hitting hard.',
    advice: 'Guard Break helps cut through their defenses. Rest before fighting two at once.',
    intent: 'Mixes normal attacks, heavy attacks, and guarding.'
  },
  troll: {
    name: 'Moss Troll',
    family: 'Anchor',
    trait: 'High health and heavy pressure. A troll can grind down an unprepared party.',
    advice: 'Use buffs, Fire Bombs, and level-2 abilities. Keep Rowan ready to heal.',
    intent: 'Usually threatens heavy attacks, with occasional guarding.'
  },
  cave_lizard: {
    name: 'Cave Lizard',
    family: 'Ambusher',
    trait: 'Lower health than a troll, but quick enough to punish delays.',
    advice: 'Remove it early so the troll cannot control the pace of the battle.',
    intent: 'Uses attacks and Quick Bite.'
  }
};

export const LOOT_TABLES = {
  goblin: [
    { itemId: 'potion', chance: 0.34, quantity: 1 },
    { itemId: 'fire_bomb', chance: 0.12, quantity: 1 }
  ],
  orc: [
    { itemId: 'potion', chance: 0.24, quantity: 1 },
    { itemId: 'ether', chance: 0.2, quantity: 1 }
  ],
  troll: [
    { itemId: 'ether', chance: 0.36, quantity: 1 },
    { itemId: 'fire_bomb', chance: 0.18, quantity: 1 }
  ],
  cave_lizard: [
    { itemId: 'ether', chance: 0.28, quantity: 1 },
    { itemId: 'potion', chance: 0.2, quantity: 1 }
  ]
};

export const STORY_EVENTS = [
  {
    id: 'prologue',
    title: 'A Quiet Village',
    body: 'The party gathers where the lanterns still hold. Beyond the market road, something hollow has begun to move through the trees.'
  },
  {
    id: 'secure-road',
    title: 'The Road Breathes Again',
    body: 'With the ambushes broken, traders return by dusk. The Quartermaster marks an older route on the map: a ruin swallowed by roots and old stone.'
  },
  {
    id: 'read-ruins',
    title: 'Names in the Stone',
    body: 'The ruins remember Vitalis as a promise, not a weapon. Beneath the carved arch, a blue path points toward the cold mouth of the Crystal Cave.'
  },
  {
    id: 'claim-crystal',
    title: 'The First Shard',
    body: 'The cave quiets around a single warm shard. It is not enough to heal the world, but it proves the light can still answer.'
  }
];

export const NPC_DIALOGUE = {
  quartermaster: {
    name: 'Quartermaster',
    lines: [
      'Roads tell the truth before people do. If the path is quiet, the village can breathe.',
      'Those ruins were sealed before I was born. Take supplies, and do not trust still water.',
      'Crystal light draws hungry things. If you bring back a shard, bring back everyone too.'
    ]
  },
  innkeeper: {
    name: 'Innkeeper',
    lines: [
      'A full room and a hot meal can keep fear from becoming a habit.',
      'The old stories say Vitalis responds to mercy as much as courage.',
      'Rest when you need to. Brave parties still lose when they mistake exhaustion for duty.'
    ]
  }
};

export const PARTY_TEMPLATE = [
  {
    id: 'kael',
    name: 'Kael',
    role: 'Vanguard',
    color: 0x4f83ff,
    portrait: 'assets/portraits/kael.png',
    spriteKey: 'heroKael',
    battleSpriteKey: 'heroKaelBattle',
    level: 1,
    xp: 0,
    hp: 34,
    maxHp: 34,
    mp: 8,
    maxMp: 8,
    stats: { atk: 8, mag: 2, def: 5, spd: 4 },
    weapon: 'iron_sword',
    spells: ['rally', 'guard_break']
  },
  {
    id: 'mira',
    name: 'Mira',
    role: 'Pyromancer',
    color: 0xef6f6c,
    portrait: 'assets/portraits/mira.png',
    spriteKey: 'heroMira',
    battleSpriteKey: 'heroMiraBattle',
    level: 1,
    xp: 0,
    hp: 24,
    maxHp: 24,
    mp: 18,
    maxMp: 18,
    stats: { atk: 3, mag: 9, def: 2, spd: 5 },
    weapon: 'ember_staff',
    spells: ['firebolt', 'flame_wave']
  },
  {
    id: 'rowan',
    name: 'Rowan',
    role: 'Warden',
    color: 0x66d17b,
    portrait: 'assets/portraits/rowan.png',
    spriteKey: 'heroRowan',
    battleSpriteKey: 'heroRowanBattle',
    level: 1,
    xp: 0,
    hp: 28,
    maxHp: 28,
    mp: 16,
    maxMp: 16,
    stats: { atk: 4, mag: 7, def: 4, spd: 3 },
    weapon: 'guardian_mace',
    spells: ['mend', 'shield_prayer']
  },
  {
    id: 'nyx',
    name: 'Nyx',
    role: 'Wayfinder',
    color: 0xc982ff,
    portrait: 'assets/portraits/nyx.png',
    spriteKey: 'heroNyx',
    battleSpriteKey: 'heroNyxBattle',
    level: 1,
    xp: 0,
    hp: 26,
    maxHp: 26,
    mp: 10,
    maxMp: 10,
    stats: { atk: 7, mag: 3, def: 3, spd: 8 },
    weapon: 'twin_daggers',
    spells: ['spark', 'quick_strike']
  }
];

export const AREAS = [
  {
    id: 'forest_road',
    name: 'Forest Road',
    subtitle: 'A trade path where hollow things gather.',
    recommendedLevel: 1,
    fieldEvent: {
      title: 'Lanterns on the Trade Road',
      body: 'The party follows fresh cart tracks between mossy stones. Something has been watching from the tree line.',
      scout: 'Expect goblins first, then a scout with heavier armor.',
      cacheItemId: 'potion'
    },
    unlocksAt: 0,
    questId: 'secure-road',
    encounters: [
      {
        id: 'roadside',
        name: 'Roadside Ambush',
        backdrop: 'forest road',
        enemies: [
          { id: 'goblin_1', name: 'Hollow Goblin', type: 'goblin', hp: 22, maxHp: 22, atk: 5, def: 2, xp: 10, gold: 8 },
          { id: 'goblin_2', name: 'Hollow Goblin', type: 'goblin', hp: 22, maxHp: 22, atk: 5, def: 2, xp: 10, gold: 8 }
        ]
      },
      {
        id: 'road_watch',
        name: 'Broken Watchfire',
        backdrop: 'forest road',
        enemies: [
          { id: 'goblin_3', name: 'Hollow Goblin', type: 'goblin', hp: 24, maxHp: 24, atk: 6, def: 2, xp: 12, gold: 10 },
          { id: 'orc_scout', name: 'Orc Scout', type: 'orc', hp: 32, maxHp: 32, atk: 7, def: 3, xp: 18, gold: 14 }
        ]
      }
    ]
  },
  {
    id: 'old_ruins',
    name: 'Old Ruins',
    subtitle: 'A swallowed archway where the old sickness breathes.',
    recommendedLevel: 2,
    fieldEvent: {
      title: 'The Root-Choked Gate',
      body: 'Old blocks lean over the path. The air tastes like rain and rust, and boot prints vanish under crawling vines.',
      scout: 'Orcs hold this route. They guard often, then answer with heavy blows.',
      cacheItemId: 'ether'
    },
    unlocksAt: 1,
    questId: 'read-ruins',
    encounters: [
      {
        id: 'orc_patrol',
        name: 'Orc Patrol',
        backdrop: 'old road',
        enemies: [
          { id: 'orc_1', name: 'Orc Bruiser', type: 'orc', hp: 36, maxHp: 36, atk: 7, def: 4, xp: 22, gold: 18 },
          { id: 'goblin_4', name: 'Hollow Goblin', type: 'goblin', hp: 22, maxHp: 22, atk: 5, def: 2, xp: 10, gold: 8 }
        ]
      },
      {
        id: 'ruin_guard',
        name: 'Ruin Guard',
        backdrop: 'old road',
        enemies: [
          { id: 'orc_2', name: 'Orc Bruiser', type: 'orc', hp: 39, maxHp: 39, atk: 8, def: 4, xp: 24, gold: 20 },
          { id: 'orc_3', name: 'Orc Bruiser', type: 'orc', hp: 39, maxHp: 39, atk: 8, def: 4, xp: 24, gold: 20 }
        ]
      }
    ]
  },
  {
    id: 'crystal_cave',
    name: 'Crystal Cave',
    subtitle: 'A cold cave where crystals echo with Vitalis.',
    recommendedLevel: 3,
    fieldEvent: {
      title: 'Blue Light Under Stone',
      body: 'A cold glow moves across the cave wall like water. Every footstep returns twice from the dark.',
      scout: 'Trolls anchor these fights. Cave lizards are faster and should not be ignored.',
      cacheItemId: 'fire_bomb'
    },
    unlocksAt: 2,
    questId: 'claim-crystal',
    encounters: [
      {
        id: 'troll_bridge',
        name: 'Bridge Troll',
        backdrop: 'stone bridge',
        enemies: [
          { id: 'troll_1', name: 'Moss Troll', type: 'troll', hp: 56, maxHp: 56, atk: 10, def: 5, xp: 48, gold: 35 }
        ]
      },
      {
        id: 'cave_troll',
        name: 'Crystal Hoarder',
        backdrop: 'stone bridge',
        enemies: [
          { id: 'troll_2', name: 'Moss Troll', type: 'troll', hp: 64, maxHp: 64, atk: 11, def: 6, xp: 58, gold: 42 },
          { id: 'lizard_1', name: 'Cave Lizard', type: 'cave_lizard', hp: 30, maxHp: 30, atk: 8, def: 3, xp: 22, gold: 14 }
        ]
      }
    ]
  }
];

export const QUESTS = [
  {
    id: 'secure-road',
    title: 'Secure the Forest Road',
    areaId: 'forest_road',
    description: 'Win 2 battles on the Forest Road.',
    requiredWins: 2,
    reward: 'Unlocks the Old Ruins'
  },
  {
    id: 'read-ruins',
    title: 'Read the Old Ruins',
    areaId: 'old_ruins',
    description: 'Win 2 battles in the Old Ruins.',
    requiredWins: 2,
    reward: 'Unlocks the Crystal Cave'
  },
  {
    id: 'claim-crystal',
    title: 'Claim the Crystal Cave',
    areaId: 'crystal_cave',
    description: 'Win 2 battles in the Crystal Cave.',
    requiredWins: 2,
    reward: 'Completes this chapter'
  }
];

import { AREAS, AREA_THEMES, ASSETS, CHARACTER_SPRITESHEET_FORMAT, CHARACTER_WALK_SHEETS, ENDING_SCENES, ENEMY_IDLE_FORMAT, ENEMY_TYPES, ITEMS, QUESTS, SPELLS, WEAPONS } from './data.js';
import {
  buyItem,
  buyPotion,
  camp,
  castSpell,
  drainAchievementToasts,
  equipWeapon,
  firstLivingEnemy,
  getAbilityUnlocks,
  getAchievements,
  getBestiaryEntries,
  getNpcDialogue,
  getStoryEvents,
  gameState,
  getAreaReadiness,
  getNextEncounterPreview,
  getQuestProgress,
  getUnlockedAreas,
  getWeapon,
  guard,
  isAreaUnlocked,
  markEndingSeen,
  partyAttack,
  pushLog,
  resetGame,
  returnToTown,
  saveExistedAtBoot,
  saveGame,
  scoutArea,
  searchAreaCache,
  startEncounter,
  useItem,
  usePotion,
  xpToNextLevel
} from './state.js';
import { IntroScene } from './intro.js';
import { playSound } from './audio.js';
import { DIFFICULTIES, effectsEnabled, getDifficulty, settings, updateSetting } from './settings.js';

const hud = {
  root: document.getElementById('hud'),
  titleScreen: document.getElementById('title-screen'),
  continueGame: document.getElementById('continue-game'),
  newGameTitle: document.getElementById('new-game-title'),
  title: document.getElementById('scene-title'),
  mission: document.getElementById('mission-pill'),
  gold: document.getElementById('gold-pill'),
  potions: document.getElementById('potions-pill'),
  save: document.getElementById('save-pill'),
  menu: document.getElementById('menu-toggle'),
  settingsTop: document.getElementById('settings-top'),
  titleSettings: document.getElementById('title-settings'),
  reset: document.getElementById('new-game-top'),
  party: document.getElementById('party-list'),
  copy: document.getElementById('context-copy'),
  actions: document.getElementById('action-bar'),
  log: document.getElementById('log-panel'),
  victoryOverlay: document.getElementById('victory-overlay'),
  victoryCopy: document.getElementById('victory-copy'),
  victoryActions: document.getElementById('victory-actions')
};

let currentScene = null;
let townPanelMode = 'map';
let selectedMemberId = gameState.party[0]?.id || 'kael';
let expeditionAreaId = gameState.currentAreaId || 'forest_road';
let lastAnimatedFxKey = '';
let previewTargetId = null;
let menuOpen = false;
let lastVictoryChime = null;
let townCollisionDebugVisible = false;
const PLAYER_MOVE_SPEED = 170;
const PLAYER_BODY = {
  width: 22,
  height: 14
};
const PLAYER_COLLISION_STEP = 4;
const COLLISION_EDGE_GAP = 0.5;
const TOWN_INTERACT_RADIUS = 90;
const FOLLOW_TRAIL_STEP = 2;
const FOLLOW_SPACING = 26;
const FOLLOW_SNAP_DISTANCE = 2;
const TOWN_NPCS = [
  { panel: 'npc:quartermaster', name: 'Quartermaster', x: 0.18, y: 0.48, tint: 0xf3c65f },
  { panel: 'npc:innkeeper', name: 'Innkeeper', x: 0.77, y: 0.48, tint: 0xef6f6c }
];
const TOWN_MAP_MARKERS = [
  ['forest_road', 0.35, 0.31],
  ['old_ruins', 0.62, 0.35],
  ['crystal_cave', 0.78, 0.64],
  ['blackroot_fen', 0.25, 0.78]
];
const TOWN_COLLISION_CONFIG = {
  playableArea: {
    label: 'townPlayableBounds',
    left: 0.05,
    top: 0.28,
    right: 0.94,
    bottom: 0.98
  },
  zones: [
    // Tune each rectangle with canvas percentages:
    // x = center position from left to right, y = center position from top to bottom.
    // width = rectangle width, height = rectangle height.
    { label: 'leftHouseWall', x: 0.08, y: 0.385, width: 0.145, height: 0.105 },
    { label: 'leftHouseSteps', x: 0.13, y: 0.435, width: 0.06, height: 0.035 },
    { label: 'leftHouseBarrel', x: 0.23, y: 0.405, width: 0.035, height: 0.05 },
    { label: 'leftFence', x: 0.07, y: 0.53, width: 0.13, height: 0.05 },
    { label: 'noticeBoard', x: 0.10, y: 0.64, width: 0.085, height: 0.105 },
    { label: 'townHallCounter', x: 0.40, y: 0.34, width: 0.17, height: 0.07 },
    { label: 'townHallDoorBase', x: 0.50, y: 0.35, width: 0.10, height: 0.11 },
    { label: 'townHallCrates', x: 0.57, y: 0.35, width: 0.08, height: 0.10 },
    { label: 'townHallLamp', x: 0.27, y: 0.36, width: 0.03, height: 0.10 },
    { label: 'innWallBase', x: 0.78, y: 0.355, width: 0.16, height: 0.085 },
    { label: 'innFrontCounter', x: 0.765, y: 0.445, width: 0.18, height: 0.06 },
    { label: 'innRightAnnex', x: 0.905, y: 0.395, width: 0.08, height: 0.12 },
    { label: 'innBarrels', x: 0.845, y: 0.485, width: 0.045, height: 0.045 },
    { label: 'innLampPost', x: 0.69, y: 0.405, width: 0.02, height: 0.085 },
    { label: 'southRockCluster', x: 0.45, y: 0.9, width: 0.2, height: 0.2 },
    { label: 'workshopWallBase', x: 0.835, y: 0.65, width: 0.155, height: 0.095 },
    { label: 'workshopForge', x: 0.795, y: 0.70, width: 0.095, height: 0.08 },
    { label: 'workshopAnvil', x: 0.73, y: 0.72, width: 0.055, height: 0.055 },
    { label: 'workshopRightWall', x: 0.915, y: 0.69, width: 0.06, height: 0.125 },
    { label: 'workshopBarrels', x: 0.88, y: 0.765, width: 0.045, height: 0.055 }
  ]
};

hud.continueGame.hidden = !saveExistedAtBoot;

hud.continueGame.addEventListener('click', () => {
  hud.titleScreen.classList.add('hidden');
});

hud.newGameTitle.addEventListener('click', () => {
  resetGame();
  selectedMemberId = gameState.party[0]?.id || 'kael';
  townPanelMode = 'map';
  menuOpen = false;
  hud.titleScreen.classList.add('hidden');
  currentScene?.scene.start('IntroScene');
});

hud.reset.addEventListener('click', () => {
  resetGame();
  selectedMemberId = gameState.party[0]?.id || 'kael';
  townPanelMode = 'map';
  menuOpen = false;
  currentScene?.scene.start('TownScene');
});

hud.menu.addEventListener('click', () => {
  menuOpen = !menuOpen;
  renderHud(gameState.scene === 'battle' ? 'battle' : 'town');
});

hud.settingsTop.addEventListener('click', () => {
  if (gameState.scene !== 'town') return;
  playSound('click');
  townPanelMode = 'settings';
  menuOpen = false;
  renderHud('town');
});

function renderTitleSettings() {
  hud.titleSettings.innerHTML = '';
  const options = [
    { label: `Sound ${settings.sound ? 'On' : 'Off'}`, action: () => updateSetting('sound', !settings.sound) },
    { label: `Effects ${settings.effects ? 'On' : 'Off'}`, action: () => updateSetting('effects', !settings.effects) },
    { label: `Difficulty ${getDifficulty().label}`, action: () => updateSetting('difficulty', nextDifficultyId()) }
  ];
  options.forEach(option => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.label;
    button.addEventListener('click', () => {
      option.action();
      playSound('click');
      renderTitleSettings();
    });
    hud.titleSettings.appendChild(button);
  });
}

function nextDifficultyId() {
  const index = DIFFICULTIES.findIndex(entry => entry.id === settings.difficulty);
  return DIFFICULTIES[(index + 1) % DIFFICULTIES.length].id;
}

renderTitleSettings();

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;
  if (!/^[1-9]$/.test(key)) return;
  const button = hud.actions.querySelector(`button[data-hotkey="${key}"]:not(:disabled)`);
  if (!button) return;
  event.preventDefault();
  button.click();
});

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('town', ASSETS.town);
    this.load.image('ruins', ASSETS.ruins);
    this.load.image('battleForest', ASSETS.battleForest);
    this.load.image('battleCave', ASSETS.battleCave);
    this.load.image('battleFen', ASSETS.battleFen);
    this.load.image('heroKael', ASSETS.heroKael);
    this.load.image('heroMira', ASSETS.heroMira);
    this.load.image('heroRowan', ASSETS.heroRowan);
    this.load.image('heroNyx', ASSETS.heroNyx);
    this.load.image('heroKaelBattle', ASSETS.heroKaelBattle);
    this.load.image('heroMiraBattle', ASSETS.heroMiraBattle);
    this.load.image('heroRowanBattle', ASSETS.heroRowanBattle);
    this.load.image('heroNyxBattle', ASSETS.heroNyxBattle);
    this.load.image('villagerIdle', ASSETS.villagerIdle);
    ['goblinIdle', 'orcIdle', 'trollIdle', 'caveLizardIdle', 'bogWraithIdle'].forEach(key => {
      this.load.spritesheet(key, ASSETS[key], {
        frameWidth: ENEMY_IDLE_FORMAT.frameWidth,
        frameHeight: ENEMY_IDLE_FORMAT.frameHeight
      });
    });
    loadCharacterWalkSheets(this);
  }

  create() {
    createCharacterAnimations(this);
    createEnemyIdleAnimations(this);
    this.scene.start(gameState.scene === 'battle' && gameState.battle ? 'BattleScene' : 'TownScene');
  }
}

class TownScene extends Phaser.Scene {
  constructor() {
    super('TownScene');
  }

  create() {
    currentScene = this;
    configureTownCollision(this);
    fitBackground(this, 'town');
    addAtmosphere(this);
    this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.58, this.scale.width * 0.58, this.scale.height * 0.42, 0xf0d689, 0.08);
    addTownParty(this);
    TOWN_NPCS.forEach(npc => {
      addToken(this, this.scale.width * npc.x, this.scale.height * npc.y, npc.tint, npc.name, 'villagerIdle', 0.72);
    });
    addMapMarkers(this);
    setupTownInteractables(this);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.on('keydown-C', () => toggleTownCollisionDebug(this));
    this.input.keyboard.on('keydown-F3', () => toggleTownCollisionDebug(this));
    this.input.keyboard.on('keydown-SPACE', () => activateTownInteractable(this));
    this.input.keyboard.on('keydown-E', () => activateTownInteractable(this));
    this.add.text(this.scale.width * 0.5, this.scale.height * 0.82, 'Village Hub', {
      fontFamily: 'Georgia, serif',
      fontSize: '28px',
      color: '#fff3cc',
      stroke: '#1a1208',
      strokeThickness: 5
    }).setOrigin(0.5);
    renderHud('town');
  }

  update(time, delta) {
    updateTownPlayer(this, delta);
    updateTownFollowers(this, delta);
    updateTownInteractions(this);
  }
}

class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create() {
    currentScene = this;
    const area = getBattleArea();
    const theme = getAreaTheme(area?.id);
    this.cameras.main.setBackgroundColor('#101918');
    fitBackground(this, theme.battleKey, theme.battleAlpha ?? 0.5);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, theme.tint, theme.tintAlpha).setOrigin(0);
    this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.72, this.scale.width, 230, theme.ground, 0.74);
    this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.78, this.scale.width, 3, theme.accent, 0.28);
    addBattleLanes(this, theme);
    addBattleAreaLabel(this, area, theme);
    this.partyViews = [];
    this.enemyViews = [];
    renderBattleActors(this);
    renderHud('battle');
  }

  update() {
    refreshBattleActors(this);
  }
}

function renderBattleActors(scene) {
  scene.partyViews.forEach(view => view.destroy());
  scene.enemyViews.forEach(view => view.destroy());
  scene.partyViews = [];
  scene.enemyViews = [];
  const partyPositions = [
    [0.15, 0.62],
    [0.28, 0.62],
    [0.19, 0.74],
    [0.32, 0.74]
  ];
  const enemyPositions = [
    [0.68, 0.52],
    [0.82, 0.58],
    [0.73, 0.71]
  ];

  gameState.party.forEach((member, index) => {
    const [xPct, yPct] = partyPositions[index] || [0.18 + index * 0.08, 0.68];
    const x = scene.scale.width * xPct;
    const y = scene.scale.height * yPct;
    const view = addToken(scene, x, y, null, member.name, member.battleSpriteKey || member.spriteKey || 'heroKael', 0.7);
    view.baseX = x;
    view.baseY = y;
    view.actorId = member.id;
    view.actorSide = 'party';
    view.motionOffsetX = 0;
    view.motionOffsetY = 0;
    scene.partyViews.push(view);
  });

  const enemies = gameState.battle?.enemies || [];
  enemies.forEach((enemy, index) => {
    const [xPct, yPct] = enemyPositions[index] || [0.74, 0.58 + index * 0.08];
    const x = scene.scale.width * xPct;
    const y = scene.scale.height * yPct;
    scene.enemyViews.push(addEnemyToken(scene, x, y, enemy));
  });
  addBattleStatus(scene);
}

function refreshBattleActors(scene) {
  if (!gameState.battle) return;
  const activeActorId = gameState.party[gameState.battle.actorIndex]?.id;
  gameState.party.forEach((member, index) => {
    const view = scene.partyViews[index];
    if (!view) return;
    view.setAlpha(member.hp > 0 ? 1 : 0.28);
    view.x = (view.baseX || view.x) + (view.motionOffsetX || 0);
    view.y = (view.baseY || view.y) + (view.motionOffsetY || 0);
    const targeted = member.hp > 0 && (previewTargetId === member.id || previewTargetId === 'allParty');
    const endangered = member.hp > 0 && member.hp / member.maxHp <= 0.35;
    view.targetRing?.setVisible(targeted);
    view.targetGlow?.setVisible(targeted || endangered);
    view.targetGlow?.setFillStyle(targeted ? 0x66d17b : 0xef6f6c, targeted ? 0.16 : 0.1);
    view.targetTag?.setVisible(targeted && previewTargetId !== 'allParty');
    view.setScale(member.id === activeActorId ? 1.04 : targeted ? 1.03 : 1);
  });
  gameState.battle.enemies.forEach((enemy, index) => {
    const view = scene.enemyViews[index];
    if (!view) return;
    view.setAlpha(enemy.hp > 0 ? 1 : 0.18);
    view.x = (view.baseX || view.x) + (view.motionOffsetX || 0);
    view.y = (view.baseY || view.y) + (view.motionOffsetY || 0);
    const targeted = enemy.hp > 0 && (previewTargetId === enemy.id || previewTargetId === 'allEnemies');
    view.targetRing?.setVisible(targeted);
    view.targetGlow?.setVisible(targeted);
    view.targetTag?.setVisible(targeted && previewTargetId !== 'allEnemies');
    view.setScale(enemy.hp > 0 ? (targeted ? 1.06 : 1) : 0.9);
  });
}

function addBattleLanes(scene, theme) {
  const partyX = scene.scale.width * 0.24;
  const enemyX = scene.scale.width * 0.74;
  const partyY = scene.scale.height * 0.71;
  const enemyY = scene.scale.height * 0.61;
  scene.add.ellipse(partyX, partyY, scene.scale.width * 0.36, 112, 0x0d1211, 0.28)
    .setStrokeStyle(2, theme.accent, 0.18);
  scene.add.ellipse(enemyX, enemyY, scene.scale.width * 0.34, 118, 0x0d1211, 0.24)
    .setStrokeStyle(2, 0xffdf7a, 0.18);
  scene.add.text(partyX, partyY + 70, 'Party', {
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#d8cfb7',
    stroke: '#111',
    strokeThickness: 4
  }).setOrigin(0.5).setAlpha(0.72);
}

function addBattleStatus(scene) {
  const battle = gameState.battle;
  const activeMember = gameState.party[battle.actorIndex];
  const activeView = scene.partyViews[battle.actorIndex];
  if (activeView) {
    const ring = scene.add.ellipse(0, 34, 74, 24)
      .setStrokeStyle(3, 0xf3c65f, 0.9);
    activeView.add(ring);
    activeView.sendToBack(ring);
  }

  scene.add.text(scene.scale.width * 0.06, scene.scale.height * 0.52, `${activeMember.name}'s turn`, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '17px',
    color: '#fff3cc',
    stroke: '#111',
    strokeThickness: 5
  });

  battle.enemies.forEach((enemy, index) => {
    const view = scene.enemyViews[index];
    if (!view || enemy.hp <= 0) return;
    const pct = Math.max(0, enemy.hp / enemy.maxHp);
    const width = 78;
    const y = -62;
    view.add(scene.add.rectangle(0, y, width, 8, 0x1b211e, 0.95).setStrokeStyle(1, 0x000000, 0.5));
    view.add(scene.add.rectangle(-width / 2, y, width * pct, 8, pct > 0.45 ? 0x66d17b : 0xef6f6c, 1).setOrigin(0, 0.5));
    view.add(scene.add.text(0, y - 15, `${enemy.hp}/${enemy.maxHp}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#fff6de',
      stroke: '#111',
      strokeThickness: 4
    }).setOrigin(0.5));

    const intent = battle.intents?.[enemy.id];
    if (intent) {
      const intentColor = intent.type === 'heavy' ? '#ffb35c' : intent.type === 'guard' ? '#9bd8ff' : '#fff3cc';
      const target = gameState.party.find(member => member.id === intent.targetId);
      const targetIndex = gameState.party.findIndex(member => member.id === intent.targetId);
      const targetView = scene.partyViews[targetIndex];
      if (targetView) addIntentLine(scene, view, targetView, intent);
      view.add(scene.add.text(0, y - 36, `${intent.label}${target ? `: ${target.name}` : ''}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: intentColor,
        stroke: '#111',
        strokeThickness: 4
      }).setOrigin(0.5));
    }
  });

  addActionFeedback(scene);
}

function addIntentLine(scene, enemyView, targetView, intent) {
  if (intent.type === 'guard') return;
  const color = intent.type === 'heavy' ? 0xffb35c : intent.type === 'quick' ? 0x9bd8ff : 0xfff3cc;
  const line = scene.add.line(0, 0, enemyView.x, enemyView.y - 48, targetView.x, targetView.y - 48, color, 0.22)
    .setOrigin(0)
    .setLineWidth(intent.type === 'heavy' ? 3 : 2);
  const marker = scene.add.ellipse(targetView.x, targetView.y + 34, 66, 22)
    .setStrokeStyle(2, color, intent.type === 'heavy' ? 0.52 : 0.34);
  line.setDepth(3);
  marker.setDepth(3);
}

function addBattleAreaLabel(scene, area, theme) {
  const label = area ? area.name : 'Wilds';
  const note = theme.note || '';
  const panel = scene.add.rectangle(28, 28, 260, 68, 0x0d1211, 0.72)
    .setOrigin(0)
    .setStrokeStyle(1, theme.accent, 0.38);
  const title = scene.add.text(44, 38, label, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '17px',
    fontStyle: 'bold',
    color: '#fff3cc'
  });
  const subtitle = scene.add.text(44, 62, note, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    color: '#cfc7b3',
    wordWrap: { width: 220 }
  });
  panel.setDepth(1);
  title.setDepth(2);
  subtitle.setDepth(2);
}

function addActionFeedback(scene) {
  const fx = gameState.battle?.lastFx;
  if (!fx) return;
  const fxKey = `${fx.id || 'fx'}-${fx.actorId || 'actor'}-${fx.targetId}-${fx.label}`;
  const views = [];
  if (fx.targetId === 'allEnemies') {
    views.push(...scene.enemyViews.filter((_, index) => gameState.battle.enemies[index]));
  } else if (fx.targetId === 'allParty') {
    views.push(...scene.partyViews.filter((_, index) => gameState.party[index]?.hp > 0));
  } else {
    const enemyIndex = gameState.battle.enemies.findIndex(enemy => enemy.id === fx.targetId);
    if (enemyIndex >= 0 && scene.enemyViews[enemyIndex]) views.push(scene.enemyViews[enemyIndex]);
    const partyIndex = gameState.party.findIndex(member => member.id === fx.targetId);
    if (partyIndex >= 0 && scene.partyViews[partyIndex]) views.push(scene.partyViews[partyIndex]);
  }
  if (fxKey !== lastAnimatedFxKey) {
    lastAnimatedFxKey = fxKey;
    animateAction(scene, fx, views);
  }
  const color = fx.type === 'heal' ? '#66d17b' : fx.type === 'shield' || fx.type === 'guard' || fx.type === 'buff' ? '#9bd8ff' : '#ffdf7a';
  views.forEach((view, index) => {
    spawnActionEffect(scene, fx, view, index, color);
  });
}

function animateAction(scene, fx, targetViews) {
  const actorView = [...scene.partyViews, ...scene.enemyViews].find(view => view.actorId === fx.actorId);
  const isHelpful = fx.type === 'heal' || fx.type === 'shield' || fx.type === 'guard' || fx.type === 'buff';
  playSound(fx.type);
  if (actorView && fx.type !== 'heal') {
    const direction = actorView.actorSide === 'party' ? 1 : -1;
    scene.tweens.add({
      targets: actorView,
      motionOffsetX: direction * 18,
      duration: 110,
      yoyo: true,
      ease: 'Cubic.easeOut'
    });
  }
  targetViews.forEach((view, index) => {
    if (isHelpful) {
      scene.tweens.add({
        targets: view,
        motionOffsetY: -10,
        duration: 150,
        yoyo: true,
        ease: 'Sine.easeOut'
      });
      return;
    }
    scene.tweens.add({
      targets: view,
      motionOffsetX: index % 2 === 0 ? 8 : -8,
      duration: 70,
      yoyo: true,
      repeat: 2,
      ease: 'Stepped'
    });
  });
}

function spawnActionEffect(scene, fx, targetView, index, color) {
  const actorView = [...scene.partyViews, ...scene.enemyViews].find(view => view.actorId === fx.actorId);
  const isHelpful = fx.type === 'heal' || fx.type === 'shield' || fx.type === 'guard' || fx.type === 'buff';
  const numberY = isHelpful ? targetView.y - 74 : targetView.y - 82 - index * 8;
  if (effectsEnabled()) {
    if (actorView && actorView !== targetView && !isHelpful) {
      addStrikeTrail(scene, actorView, targetView, fx);
    }
    if (isHelpful) addSupportBurst(scene, targetView, color, fx);
    else addImpactBurst(scene, targetView, color, fx);
  }
  addFloatingNumber(scene, targetView.x, numberY, fx.label, color);
  flashSprite(scene, targetView, isHelpful ? 0x66d17b : 0xffffff);
}

function addStrikeTrail(scene, actorView, targetView, fx) {
  const color = fx.type === 'magic' || fx.type === 'wave' ? 0x9bd8ff : fx.type === 'break' ? 0xffdf7a : 0xffffff;
  const trail = scene.add.line(0, 0, actorView.x, actorView.y - 34, targetView.x, targetView.y - 34, color, 0.78)
    .setOrigin(0)
    .setLineWidth(fx.type === 'magic' || fx.type === 'wave' ? 4 : 2);
  scene.tweens.add({
    targets: trail,
    alpha: 0,
    duration: 180,
    ease: 'Cubic.easeOut',
    onComplete: () => trail.destroy()
  });
}

function addImpactBurst(scene, view, color, fx) {
  const numericColor = colorToNumber(color);
  const flash = scene.add.circle(view.x, view.y - 14, fx.type === 'wave' ? 42 : 30, numericColor, 0.28);
  const ring = scene.add.ellipse(view.x, view.y + 26, 70, 22)
    .setStrokeStyle(3, numericColor, 0.74);
  const slash = scene.add.rectangle(view.x, view.y - 28, 76, 5, 0xffffff, 0.72)
    .setRotation(-0.36);
  scene.tweens.add({ targets: flash, scale: 1.85, alpha: 0, duration: 440, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
  scene.tweens.add({ targets: ring, scaleX: 1.5, scaleY: 1.25, alpha: 0, duration: 460, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  scene.tweens.add({ targets: slash, x: slash.x + 20, alpha: 0, duration: 170, ease: 'Cubic.easeOut', onComplete: () => slash.destroy() });
  scene.cameras.main.shake(85, fx.type === 'enemyHit' ? 0.0018 : 0.0012);
}

function addSupportBurst(scene, view, color, fx) {
  const numericColor = colorToNumber(color);
  const ring = scene.add.ellipse(view.x, view.y + 26, 76, 24)
    .setStrokeStyle(3, numericColor, 0.78);
  const glow = scene.add.circle(view.x, view.y - 10, 42, numericColor, 0.16);
  scene.tweens.add({ targets: ring, scaleX: 1.35, scaleY: 1.25, alpha: 0, duration: 560, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
  scene.tweens.add({ targets: glow, y: glow.y - 12, scale: 1.6, alpha: 0, duration: 620, ease: 'Sine.easeOut', onComplete: () => glow.destroy() });
  if (fx.type === 'shield' || fx.type === 'guard') {
    const shield = scene.add.arc(view.x, view.y - 12, 42, 205, 335, false, numericColor, 0.18)
      .setStrokeStyle(6, numericColor, 0.68);
    scene.tweens.add({ targets: shield, alpha: 0, y: shield.y - 8, duration: 620, ease: 'Sine.easeOut', onComplete: () => shield.destroy() });
  }
}

function addFloatingNumber(scene, x, y, label, color) {
  const text = scene.add.text(x, y, label, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '22px',
    fontStyle: 'bold',
    color,
    stroke: '#111',
    strokeThickness: 5
  }).setOrigin(0.5);
  text.setScale(0.72);
  scene.tweens.add({ targets: text, scale: 1, duration: 120, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: text, y: y - 36, alpha: 0, delay: 80, duration: 780, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
}

function flashSprite(scene, view, tint) {
  if (!view.sprite) return;
  view.sprite.setTintFill(tint);
  scene.time.delayedCall(95, () => {
    if (!view.sprite?.active) return;
    if (view.baseTint) view.sprite.setTint(view.baseTint);
    else view.sprite.clearTint();
  });
}

function colorToNumber(color) {
  return Number.parseInt(color.replace('#', ''), 16);
}

function fitBackground(scene, key, alpha = 1) {
  const image = scene.add.image(scene.scale.width / 2, scene.scale.height / 2, key).setAlpha(alpha);
  const scale = Math.max(scene.scale.width / image.width, scene.scale.height / image.height);
  image.setScale(scale);
  return image;
}

function loadCharacterWalkSheets(scene) {
  Object.values(CHARACTER_WALK_SHEETS).forEach(sheet => {
    if (!sheet.path) return;
    scene.load.spritesheet(sheet.key, sheet.path, {
      frameWidth: CHARACTER_SPRITESHEET_FORMAT.frameWidth,
      frameHeight: CHARACTER_SPRITESHEET_FORMAT.frameHeight
    });
  });
}

function createCharacterAnimations(scene) {
  Object.values(CHARACTER_WALK_SHEETS).forEach(sheet => {
    if (!scene.textures.exists(sheet.key)) return;
    CHARACTER_SPRITESHEET_FORMAT.directions.forEach(direction => {
      const row = CHARACTER_SPRITESHEET_FORMAT.rows[direction];
      const idleFrame = row * CHARACTER_SPRITESHEET_FORMAT.columns + CHARACTER_SPRITESHEET_FORMAT.idleColumn;
      const walkFrames = CHARACTER_SPRITESHEET_FORMAT.walkColumns.map(column => row * CHARACTER_SPRITESHEET_FORMAT.columns + column);
      scene.anims.create({
        key: getCharacterAnimKey(sheet.key, 'idle', direction),
        frames: [{ key: sheet.key, frame: idleFrame }],
        frameRate: 1
      });
      scene.anims.create({
        key: getCharacterAnimKey(sheet.key, 'walk', direction),
        frames: walkFrames.map(frame => ({ key: sheet.key, frame })),
        frameRate: 8,
        repeat: -1
      });
    });
  });
}

function createEnemyIdleAnimations(scene) {
  ['goblinIdle', 'orcIdle', 'trollIdle', 'caveLizardIdle', 'bogWraithIdle'].forEach(key => {
    if (!scene.textures.exists(key)) return;
    scene.anims.create({
      key: `${key}_breathe`,
      frames: [{ key, frame: 0 }, { key, frame: 1 }],
      frameRate: ENEMY_IDLE_FORMAT.frameRate,
      yoyo: true,
      repeat: -1
    });
  });
}

function createCharacterDisplay(scene, member, fallbackKey, y) {
  const sheet = member ? CHARACTER_WALK_SHEETS[member.id] : null;
  if (sheet && scene.textures.exists(sheet.key)) {
    const sprite = scene.add.sprite(0, y, sheet.key, 0);
    // Walk frames are 64px vs 128px single images: boost to match display size.
    sprite.walkSheetScaleBoost = 2;
    return sprite;
  }
  return scene.add.image(0, y, fallbackKey);
}

function updateTownPlayer(scene, delta) {
  const view = scene.townPlayerView;
  if (!view) return;
  const input = getMovementInput(scene);
  const moving = input.x !== 0 || input.y !== 0;
  if (moving) {
    const velocity = getNormalizedPlayerVelocity(input);
    moveTownPlayerWithVelocity(scene, view, velocity, delta);
    view.facing = getFacingFromInput(input, view.facing || 'down');
  }
  playCharacterMotion(view, moving);
  view.baseX = view.x;
  view.baseY = view.y;
  view.setDepth(Math.round(view.y));
}

function getNormalizedPlayerVelocity(input) {
  if (!input.x && !input.y) return { x: 0, y: 0 };
  const length = Math.hypot(input.x, input.y) || 1;
  return {
    x: (input.x / length) * PLAYER_MOVE_SPEED,
    y: (input.y / length) * PLAYER_MOVE_SPEED
  };
}

function moveTownPlayerWithVelocity(scene, view, velocity, delta) {
  const dx = velocity.x * (delta / 1000);
  const dy = velocity.y * (delta / 1000);
  const maxAxisDistance = Math.max(Math.abs(dx), Math.abs(dy));
  const steps = Math.max(1, Math.ceil(maxAxisDistance / PLAYER_COLLISION_STEP));
  const stepX = dx / steps;
  const stepY = dy / steps;
  for (let i = 0; i < steps; i += 1) {
    moveTownPlayerAxis(scene, view, stepX, 0);
    moveTownPlayerAxis(scene, view, 0, stepY);
  }
}

function moveTownPlayerAxis(scene, view, dx, dy) {
  if (!dx && !dy) return;
  const previousX = view.x;
  const previousY = view.y;
  const bounds = scene.townBounds || getTownBounds(scene);
  view.x = Phaser.Math.Clamp(view.x + dx, bounds.left, bounds.right);
  view.y = Phaser.Math.Clamp(view.y + dy, bounds.top, bounds.bottom);
  const obstacle = getOverlappingTownObstacle(scene, view);
  if (obstacle) {
    resolveTownObstacleCollision(view, obstacle, dx, dy, previousX, previousY);
    view.x = Phaser.Math.Clamp(view.x, bounds.left, bounds.right);
    view.y = Phaser.Math.Clamp(view.y, bounds.top, bounds.bottom);
  }
}

function getOverlappingTownObstacle(scene, view) {
  const playerRect = getTownPlayerBodyRect(view);
  return scene.townObstacleBounds?.find(obstacle => rectsOverlap(playerRect, obstacle)) || null;
}

function getTownPlayerBodyRect(view) {
  return {
    left: view.x - PLAYER_BODY.width / 2,
    right: view.x + PLAYER_BODY.width / 2,
    top: view.y - PLAYER_BODY.height,
    bottom: view.y
  };
}

function rectsOverlap(a, b) {
  return (
    a.left < b.right - COLLISION_EDGE_GAP &&
    a.right > b.left + COLLISION_EDGE_GAP &&
    a.top < b.bottom - COLLISION_EDGE_GAP &&
    a.bottom > b.top + COLLISION_EDGE_GAP
  );
}

function resolveTownObstacleCollision(view, obstacle, dx, dy, previousX, previousY) {
  if (dx > 0) view.x = obstacle.left - PLAYER_BODY.width / 2 - COLLISION_EDGE_GAP;
  else if (dx < 0) view.x = obstacle.right + PLAYER_BODY.width / 2 + COLLISION_EDGE_GAP;
  else view.x = previousX;

  if (dy > 0) view.y = obstacle.top - COLLISION_EDGE_GAP;
  else if (dy < 0) view.y = obstacle.bottom + PLAYER_BODY.height + COLLISION_EDGE_GAP;
  else view.y = previousY;
}

function getMovementInput(scene) {
  return {
    x: (scene.cursors?.left.isDown || scene.wasd?.A.isDown ? -1 : 0) + (scene.cursors?.right.isDown || scene.wasd?.D.isDown ? 1 : 0),
    y: (scene.cursors?.up.isDown || scene.wasd?.W.isDown ? -1 : 0) + (scene.cursors?.down.isDown || scene.wasd?.S.isDown ? 1 : 0)
  };
}

function getFacingFromInput(input, fallback) {
  if (Math.abs(input.x) > Math.abs(input.y)) return input.x < 0 ? 'left' : 'right';
  if (input.y !== 0) return input.y < 0 ? 'up' : 'down';
  return fallback;
}

function playCharacterMotion(view, moving) {
  const sprite = view.sprite;
  const sheetKey = view.walkSheetKey;
  if (!sprite || !sheetKey || !sprite.scene.textures.exists(sheetKey)) return;
  const direction = view.facing || 'down';
  const state = moving ? 'walk' : 'idle';
  const animationKey = getCharacterAnimKey(sheetKey, state, direction);
  if (moving) sprite.play(animationKey, true);
  else if (sprite.anims.currentAnim?.key !== animationKey) sprite.play(animationKey, true);
}

function getCharacterAnimKey(sheetKey, state, direction) {
  return `${sheetKey}_${state}_${direction}`;
}

function configureTownCollision(scene) {
  const bounds = getTownBounds(scene);
  scene.townBounds = bounds;
  scene.townObstacleBounds = [];
  scene.townCollisionDebugViews = [];
  addTownCollisionDebugView(scene, {
    label: TOWN_COLLISION_CONFIG.playableArea.label,
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    width: bounds.width,
    height: bounds.height,
    color: 0x6fb7ff
  });
  TOWN_COLLISION_CONFIG.zones.forEach(zone => {
    const centerX = scene.scale.width * zone.x;
    const centerY = scene.scale.height * zone.y;
    const width = scene.scale.width * zone.width;
    const height = scene.scale.height * zone.height;
    scene.townObstacleBounds.push({
      label: zone.label,
      left: centerX - width / 2,
      right: centerX + width / 2,
      top: centerY - height / 2,
      bottom: centerY + height / 2
    });
    addTownCollisionDebugView(scene, {
      label: zone.label,
      x: centerX,
      y: centerY,
      width,
      height,
      color: 0xffdf7a
    });
  });
  setTownCollisionDebugVisible(scene, townCollisionDebugVisible);
}

function getTownBounds(scene) {
  const { playableArea } = TOWN_COLLISION_CONFIG;
  const left = scene.scale.width * playableArea.left;
  const top = scene.scale.height * playableArea.top;
  const right = scene.scale.width * playableArea.right;
  const bottom = scene.scale.height * playableArea.bottom;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function addTownCollisionDebugView(scene, zone) {
  const outline = scene.add.rectangle(zone.x, zone.y, zone.width, zone.height, zone.color, 0.08)
    .setStrokeStyle(2, zone.color, 0.95)
    .setDepth(10000)
    .setVisible(false);
  const label = scene.add.text(zone.x - zone.width / 2 + 6, zone.y - zone.height / 2 + 6, zone.label, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    padding: { left: 5, right: 5, top: 2, bottom: 2 }
  }).setDepth(10001).setVisible(false);
  scene.townCollisionDebugViews.push(outline, label);
}

function setupTownInteractables(scene) {
  scene.townInteractables = [];
  TOWN_NPCS.forEach(npc => {
    scene.townInteractables.push({
      x: scene.scale.width * npc.x,
      y: scene.scale.height * npc.y,
      label: `Talk to ${npc.name}`,
      panel: npc.panel,
      locked: false
    });
  });
  TOWN_MAP_MARKERS.forEach(([areaId, xPct, yPct]) => {
    const area = AREAS.find(entry => entry.id === areaId);
    scene.townInteractables.push({
      x: scene.scale.width * xPct,
      y: scene.scale.height * yPct,
      label: area.name,
      panel: `expedition:${areaId}`,
      areaId,
      locked: !isAreaUnlocked(areaId)
    });
  });
  scene.activeInteractable = null;
  scene.interactPrompt = scene.add.text(0, 0, '', {
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px',
    fontStyle: 'bold',
    color: '#17120a',
    backgroundColor: '#ffdf7a',
    padding: { left: 8, right: 8, top: 4, bottom: 4 }
  }).setOrigin(0.5).setDepth(9000).setVisible(false);
}

function updateTownInteractions(scene) {
  const view = scene.townPlayerView;
  if (!view || !scene.interactPrompt) return;
  let nearest = null;
  let nearestDistance = TOWN_INTERACT_RADIUS;
  scene.townInteractables?.forEach(entry => {
    const distance = Phaser.Math.Distance.Between(view.x, view.y, entry.x, entry.y);
    if (distance < nearestDistance) {
      nearest = entry;
      nearestDistance = distance;
    }
  });
  scene.activeInteractable = nearest && !nearest.locked ? nearest : null;
  if (!nearest) {
    scene.interactPrompt.setVisible(false);
    return;
  }
  scene.interactPrompt
    .setText(nearest.locked ? `${nearest.label} (locked)` : `Space - ${nearest.label}`)
    .setPosition(nearest.x, nearest.y - 56)
    .setVisible(true);
}

function activateTownInteractable(scene) {
  const target = scene.activeInteractable;
  if (!target || gameState.scene !== 'town') return;
  if (target.areaId) expeditionAreaId = target.areaId;
  townPanelMode = target.panel;
  renderHud('town');
}

function toggleTownCollisionDebug(scene) {
  townCollisionDebugVisible = !townCollisionDebugVisible;
  setTownCollisionDebugVisible(scene, townCollisionDebugVisible);
}

function setTownCollisionDebugVisible(scene, visible) {
  scene.townCollisionDebugViews?.forEach(view => view.setVisible(visible));
}

function addAtmosphere(scene) {
  scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x0f1614, 0.18).setOrigin(0);
  scene.add.circle(scene.scale.width * 0.58, scene.scale.height * 0.18, 180, 0xfff0c0, 0.08);
}

function addTownParty(scene) {
  const positions = [
    [0.43, 0.61],
    [0.52, 0.61],
    [0.47, 0.70],
    [0.57, 0.70]
  ];
  scene.townFollowerViews = [];
  scene.townLeaderTrail = [];
  gameState.party.forEach((member, index) => {
    const [xPct, yPct] = positions[index];
    const view = addToken(scene, scene.scale.width * xPct, scene.scale.height * yPct, null, member.name, member.spriteKey || 'heroKael', 0.7, {
      member,
      footAnchored: true
    });
    view.baseX = view.x;
    view.baseY = view.y;
    view.facing = 'down';
    view.isPlayableTownHero = index === 0;
    if (index === 0) scene.townPlayerView = view;
    else scene.townFollowerViews.push(view);
  });
}

function updateTownFollowers(scene, delta) {
  const leader = scene.townPlayerView;
  const followers = scene.townFollowerViews;
  if (!leader || !followers?.length) return;
  const trail = scene.townLeaderTrail;
  const last = trail[trail.length - 1];
  if (!last || Math.hypot(leader.x - last.x, leader.y - last.y) >= FOLLOW_TRAIL_STEP) {
    trail.push({ x: leader.x, y: leader.y });
    const maxLength = FOLLOW_SPACING * (followers.length + 1) + 8;
    if (trail.length > maxLength) trail.splice(0, trail.length - maxLength);
  }
  followers.forEach((view, index) => {
    const target = trail[trail.length - 1 - FOLLOW_SPACING * (index + 1)];
    if (!target) {
      playCharacterMotion(view, false);
      return;
    }
    const dx = target.x - view.x;
    const dy = target.y - view.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= FOLLOW_SNAP_DISTANCE) {
      playCharacterMotion(view, false);
      return;
    }
    const stepDistance = Math.min(distance, PLAYER_MOVE_SPEED * 1.15 * (delta / 1000));
    view.x += (dx / distance) * stepDistance;
    view.y += (dy / distance) * stepDistance;
    view.facing = getFacingFromInput({ x: dx, y: dy }, view.facing || 'down');
    playCharacterMotion(view, true);
    view.baseX = view.x;
    view.baseY = view.y;
    view.setDepth(Math.round(view.y));
  });
}

function addMapMarkers(scene) {
  TOWN_MAP_MARKERS.forEach(([areaId, xPct, yPct]) => {
    const area = AREAS.find(entry => entry.id === areaId);
    const unlocked = isAreaUnlocked(areaId);
    const progress = getQuestProgress(area.questId);
    const x = scene.scale.width * xPct;
    const y = scene.scale.height * yPct;
    const color = unlocked ? 0xf3c65f : 0x627069;
    scene.add.circle(x, y, 16, color, unlocked ? 0.9 : 0.58)
      .setStrokeStyle(3, 0x111715, 0.8);
    scene.add.text(x, y + 24, `${area.name} ${progress.wins}/${progress.requiredWins}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: unlocked ? '#fff3cc' : '#b9b09c',
      stroke: '#111',
      strokeThickness: 4
    }).setOrigin(0.5);
  });
}

function addToken(scene, x, y, color, label, spriteKey = 'heroKael', spriteScale = 0.65, options = {}) {
  const container = scene.add.container(x, y);
  const footY = options.footAnchored ? 0 : 34;
  const spriteY = options.footAnchored ? 0 : -4;
  const nameY = options.footAnchored ? 18 : 52;
  const targetGlow = scene.add.circle(0, footY, 44, 0x66d17b, 0.16).setVisible(false);
  const shadow = scene.add.ellipse(0, footY, 52, 16, 0x000000, 0.32);
  const targetRing = scene.add.ellipse(0, footY, 72, 24)
    .setStrokeStyle(3, 0x66d17b, 0.92)
    .setVisible(false);
  const sprite = createCharacterDisplay(scene, options.member, spriteKey, spriteY);
  sprite.setScale(spriteScale * (sprite.walkSheetScaleBoost || 1));
  sprite.setOrigin(0.5, options.footAnchored ? 1 : 0.82);
  if (color !== null && color !== undefined) sprite.setTint(color);
  const targetTag = scene.add.text(0, -112, 'ALLY', {
    fontFamily: 'Arial, sans-serif',
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#0f1c14',
    backgroundColor: '#66d17b',
    padding: { left: 7, right: 7, top: 3, bottom: 3 }
  }).setOrigin(0.5).setVisible(false);
  const name = scene.add.text(0, nameY, label, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px',
    color: '#fff6de',
    stroke: '#111',
    strokeThickness: 4
  }).setOrigin(0.5);
  container.add([targetGlow, shadow, targetRing, sprite, name, targetTag]);
  container.sprite = sprite;
  container.baseTint = color || null;
  container.walkSheetKey = options.member ? CHARACTER_WALK_SHEETS[options.member.id]?.key : null;
  container.footAnchored = !!options.footAnchored;
  container.targetRing = targetRing;
  container.targetGlow = targetGlow;
  container.targetTag = targetTag;
  return container;
}

function addEnemyToken(scene, x, y, enemy) {
  const enemyType = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.goblin;
  const container = scene.add.container(x, y);
  const targetGlow = scene.add.circle(0, 0, 48, 0xffdf7a, 0.14).setVisible(false);
  const shadow = scene.add.ellipse(0, 38, 62, 18, 0x000000, 0.36);
  const targetRing = scene.add.ellipse(0, 38, 82, 28)
    .setStrokeStyle(3, 0xffdf7a, 0.92)
    .setVisible(false);
  const sprite = scene.add.sprite(0, -2, enemyType.texture, 0)
    .setScale(enemyType.scale);
  sprite.setOrigin(0.5, 0.82);
  if (enemy.hp > 0 && scene.anims.exists(`${enemyType.texture}_breathe`)) {
    sprite.play(`${enemyType.texture}_breathe`);
  }
  if (enemyType.accent) sprite.setTint(enemyType.accent);
  const targetTag = scene.add.text(0, -128, 'TARGET', {
    fontFamily: 'Arial, sans-serif',
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#17120a',
    backgroundColor: '#ffdf7a',
    padding: { left: 7, right: 7, top: 3, bottom: 3 }
  }).setOrigin(0.5).setVisible(false);
  const name = scene.add.text(0, 58, enemy.name, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px',
    color: '#fff6de',
    stroke: '#111',
    strokeThickness: 4
  }).setOrigin(0.5);
  container.add([targetGlow, shadow, targetRing, sprite, name, targetTag]);
  container.baseX = x;
  container.baseY = y;
  container.actorId = enemy.id;
  container.actorSide = 'enemy';
  container.motionOffsetX = 0;
  container.motionOffsetY = 0;
  container.targetRing = targetRing;
  container.targetGlow = targetGlow;
  container.targetTag = targetTag;
  container.sprite = sprite;
  container.baseTint = enemyType.accent || null;
  if (enemy.hp <= 0) {
    sprite.setTint(0x565656);
    name.setText(`${enemy.name} defeated`);
  }
  return container;
}

function getBattleArea() {
  return AREAS.find(area => area.id === gameState.battle?.areaId);
}

function getAreaTheme(areaId) {
  return AREA_THEMES[areaId] || AREA_THEMES.forest_road;
}

function showAchievementToasts() {
  drainAchievementToasts().forEach((achievement, index) => {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <strong>Achievement earned</strong>
      <span>${achievement.title}</span>
      <em>${achievement.description}</em>
    `;
    document.body.appendChild(toast);
    playSound('achievement');
    setTimeout(() => toast.classList.add('visible'), 40 + index * 160);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 450);
    }, 3600 + index * 500);
  });
}

function renderHud(mode) {
  showAchievementToasts();
  hud.title.textContent = mode === 'battle' ? gameState.battle.encounter.name : 'Village';
  hud.mission.textContent = getMissionText(mode);
  hud.gold.textContent = `${gameState.gold}`;
  hud.potions.textContent = `Items ${totalConsumables()}`;
  hud.save.textContent = getSaveStatusText();
  hud.save.title = gameState.lastSavedAt ? `Last saved ${new Date(gameState.lastSavedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` : 'No save has been written yet.';
  hud.menu.textContent = menuOpen ? 'Close' : 'Menu';
  hud.menu.setAttribute('aria-expanded', String(menuOpen));
  hud.menu.setAttribute('aria-controls', 'context-panel');
  hud.reset.hidden = !menuOpen;
  hud.settingsTop.hidden = !menuOpen || mode !== 'town';
  hud.root.classList.toggle('menu-open', menuOpen);
  hud.root.classList.toggle('battle-mode', mode === 'battle');
  hideVictoryOverlay();
  renderParty();
  renderLog();
  if (mode === 'battle') renderBattlePanel();
  else renderTownPanel();
}

function getMissionText(mode) {
  if (mode === 'battle') {
    const area = getBattleArea();
    const progress = area ? getQuestProgress(area.questId) : null;
    if (!area || !progress) return 'Survive the encounter';
    const remaining = Math.max(0, progress.requiredWins - progress.wins);
    return `${area.name} - ${remaining} ${remaining === 1 ? 'clear' : 'clears'} left`;
  }
  const area = AREAS.find(entry => entry.id === gameState.currentAreaId) || AREAS[0];
  const progress = getQuestProgress(area.questId);
  return `${area.name} - ${progress.wins}/${progress.requiredWins} cleared`;
}

function renderParty() {
  const activeIndex = gameState.battle?.actorIndex;
  hud.party.innerHTML = gameState.party.map((member, index) => {
    const weapon = getWeapon(member);
    const xpPercent = Math.min(100, Math.round((member.xp / xpToNextLevel(member)) * 100));
    const hpPercent = Math.max(0, Math.round((member.hp / member.maxHp) * 100));
    const mpPercent = Math.max(0, Math.round((member.mp / member.maxMp) * 100));
    const threat = getIncomingThreat(member.id);
    const classes = ['party-card'];
    if (index === activeIndex && gameState.scene === 'battle') classes.push('active');
    if (member.id === selectedMemberId && gameState.scene === 'town') classes.push('selected');
    if (member.hp <= 0) classes.push('defeated');
    if (member.hp > 0 && member.hp / member.maxHp <= 0.35) classes.push('danger');
    if (threat.count > 0) classes.push(threat.high >= Math.max(1, Math.ceil(member.hp * 0.5)) ? 'threatened' : 'watched');
    return `
      <article class="${classes.join(' ')}" data-member-id="${member.id}">
        <header>
          <img class="portrait" src="${member.portrait}" alt="${member.name} portrait">
          <div>
            <h2>${member.name}</h2>
            <div class="role">${member.role} - ${weapon.name}</div>
          </div>
          <span class="level">Lv ${member.level}</span>
        </header>
        <div class="bars">
          <div class="bar hp" title="HP"><span style="width:${hpPercent}%"></span></div>
          <div class="bar mp" title="MP"><span style="width:${mpPercent}%"></span></div>
          <div class="bar xp" title="XP"><span style="width:${xpPercent}%"></span></div>
        </div>
        <div class="stats-line">
          <span>HP ${member.hp}/${member.maxHp}</span>
          <span>MP ${member.mp}/${member.maxMp}</span>
          <span>ATK ${member.stats.atk + weapon.atk}</span>
          <span>MAG ${member.stats.mag + weapon.mag}</span>
        </div>
        <div class="party-card-meta">
          ${renderProgressMini(member)}
          ${renderPartyThreat(threat)}
        </div>
      </article>
    `;
  }).join('');
  hud.party.querySelectorAll('[data-member-id]').forEach(card => {
    card.addEventListener('click', () => {
      if (gameState.scene !== 'town') return;
      selectedMemberId = card.dataset.memberId;
      townPanelMode = 'party';
      renderHud('town');
    });
  });
}

function renderTownPanel() {
  if (townPanelMode === 'party') {
    renderPartyPanel();
    return;
  }
  if (townPanelMode === 'journal') {
    renderJournalPanel();
    return;
  }
  if (townPanelMode === 'bestiary') {
    renderBestiaryPanel();
    return;
  }
  if (townPanelMode === 'supplies') {
    renderSuppliesPanel();
    return;
  }
  if (townPanelMode === 'settings') {
    renderSettingsPanel();
    return;
  }
  if (townPanelMode.startsWith('npc:')) {
    renderNpcPanel(townPanelMode.split(':')[1]);
    return;
  }
  if (townPanelMode.startsWith('expedition:')) {
    renderExpeditionPanel(townPanelMode.split(':')[1]);
    return;
  }
  renderMapPanel();
}

function renderMapPanel() {
  const unlockedAreas = getUnlockedAreas();
  const activeArea = AREAS.find(area => area.id === gameState.currentAreaId) || unlockedAreas[0] || AREAS[0];
  const activeReadiness = getAreaReadiness(activeArea.id);
  hud.copy.innerHTML = `
    <strong>Choose the party's next path.</strong><br>
    Complete each area objective to open the next destination.
    ${renderChapterProgress()}
    <div class="area-summary">
      <span>Selected</span>
      <strong>${activeArea.name}</strong>
      <small>${activeArea.subtitle}</small>
      <em class="danger-chip ${activeReadiness.tone}">${activeReadiness.label} - ${activeReadiness.detail}</em>
    </div>
    <div class="route-grid">
      ${AREAS.map(renderRouteCard).join('')}
    </div>
    <div class="quest-list">
      ${QUESTS.map(renderQuestRow).join('')}
    </div>
  `;
  hud.actions.innerHTML = '';
  addButton('Party Management', () => {
    townPanelMode = 'party';
    renderHud('town');
  }, 'wide secondary-action');
  addButton('Journal', () => {
    townPanelMode = 'journal';
    renderHud('town');
  }, 'secondary-action');
  addButton('Bestiary', () => {
    townPanelMode = 'bestiary';
    renderHud('town');
  }, 'secondary-action');
  addButton('Supplies', () => {
    townPanelMode = 'supplies';
    renderHud('town');
  });
  addButton('Quartermaster', () => {
    townPanelMode = 'npc:quartermaster';
    renderHud('town');
  });
  addButton('Innkeeper', () => {
    townPanelMode = 'npc:innkeeper';
    renderHud('town');
  });
  AREAS.forEach(area => {
    const progress = getQuestProgress(area.questId);
    const unlocked = isAreaUnlocked(area.id);
    const readiness = getAreaReadiness(area.id);
    const button = addButton(`${area.name} ${progress.wins}/${progress.requiredWins} - ${readiness.label}`, () => {
      expeditionAreaId = area.id;
      townPanelMode = `expedition:${area.id}`;
      renderHud('town');
    }, 'area-action');
    button.disabled = !unlocked;
    button.title = readiness.detail;
  });
  addRestButton();
  addBuyItemButton('potion', 'Buy Potion 12g');
  addButton('Save', () => {
    saveGame();
    pushLog('Game saved.');
    renderHud('town');
  });
  addButton('New Game', () => {
    resetGame();
    selectedMemberId = gameState.party[0]?.id || 'kael';
    townPanelMode = 'map';
    currentScene.scene.restart();
  }, 'wide');
}

function renderSettingsPanel() {
  const difficulty = getDifficulty();
  hud.copy.innerHTML = `
    <strong>Settings</strong><br>
    Preferences persist across saves and new games.
    <div class="settings-list">
      <span><strong>Sound</strong><em>${settings.sound ? 'On' : 'Off'} - battle and interface cues</em></span>
      <span><strong>Effects</strong><em>${settings.effects ? 'On' : 'Off'} - screen shake and impact flourishes</em></span>
      <span><strong>Difficulty</strong><em>${difficulty.label} - ${difficulty.note}</em></span>
    </div>
    <small>Difficulty applies to encounters started after the change.</small>
  `;
  hud.actions.innerHTML = '';
  addButton('World Map', () => {
    townPanelMode = 'map';
    renderHud('town');
  }, 'wide secondary-action');
  addButton(`Sound: ${settings.sound ? 'On' : 'Off'}`, () => {
    updateSetting('sound', !settings.sound);
    renderTitleSettings();
    renderHud('town');
  });
  addButton(`Effects: ${settings.effects ? 'On' : 'Off'}`, () => {
    updateSetting('effects', !settings.effects);
    renderTitleSettings();
    renderHud('town');
  });
  DIFFICULTIES.forEach(entry => {
    const button = addButton(`${entry.label}${entry.id === settings.difficulty ? ' (current)' : ''}`, () => {
      updateSetting('difficulty', entry.id);
      renderTitleSettings();
      renderHud('town');
    }, entry.id === settings.difficulty ? 'area-action' : '', entry.note);
    button.disabled = entry.id === settings.difficulty;
  });
}

function renderExpeditionPanel(areaId) {
  const area = AREAS.find(entry => entry.id === areaId) || AREAS[0];
  const preview = getNextEncounterPreview(area.id);
  const readiness = getAreaReadiness(area.id);
  const progress = gameState.areaProgress[area.id] || {};
  hud.copy.innerHTML = `
    <div class="expedition-panel">
      <strong>${area.fieldEvent?.title || area.name}</strong>
      <p>${area.fieldEvent?.body || area.subtitle}</p>
      <div class="area-summary">
        <span>${area.name}</span>
        <strong>${preview?.encounter.name || 'Unknown Encounter'}</strong>
        <small>${preview ? preview.enemies.join(', ') : 'Scout the path to learn more.'}</small>
        <em class="danger-chip ${readiness.tone}">${readiness.label} - ${readiness.detail}</em>
      </div>
      ${preview ? renderEncounterPlan(preview.encounter) : ''}
      ${renderReadinessChecklist(area, preview)}
      ${renderRouteForecast(area, preview)}
      ${renderKnownEnemyAdvice(preview)}
      <div class="expedition-note">
        <strong>Scout note</strong>
        <span>${area.fieldEvent?.scout || 'No unusual signs.'}</span>
      </div>
      <small>${progress.searched ? 'Supply cache searched for this encounter.' : 'A small cache may be nearby.'}</small>
    </div>
  `;
  hud.actions.innerHTML = '';
  addButton('World Map', () => {
    townPanelMode = 'map';
    renderHud('town');
  }, 'wide secondary-action');
  addButton('Scout Path', () => {
    scoutArea(area.id);
    renderHud('town');
  });
  addButton('Bestiary', () => {
    townPanelMode = 'bestiary';
    renderHud('town');
  });
  const searchButton = addButton('Search Supplies', () => {
    searchAreaCache(area.id);
    renderHud('town');
  });
  searchButton.disabled = !!progress.searched;
  addButton(`Begin ${preview?.encounter.name || 'Encounter'}`, () => {
    if (!startEncounter(area.id)) {
      renderHud('town');
      return;
    }
    playSound('encounter');
    menuOpen = false;
    currentScene.scene.start('BattleScene');
  }, 'wide area-action');
  addRestButton();
  addButton('Supplies', () => {
    townPanelMode = 'supplies';
    renderHud('town');
  });
}

function renderEncounterPlan(encounter) {
  const xp = encounter.enemies.reduce((sum, enemy) => sum + enemy.xp, 0);
  const gold = encounter.enemies.reduce((sum, enemy) => sum + enemy.gold, 0);
  const potionCount = gameState.inventory.potion || 0;
  const etherCount = gameState.inventory.ether || 0;
  const supplyTone = potionCount <= 1 ? 'danger' : potionCount <= 2 ? 'ready' : 'safe';
  return `
    <div class="encounter-plan">
      <span>Enemies <strong>${encounter.enemies.length}</strong></span>
      <span>XP <strong>${xp}</strong></span>
      <span>Gold <strong>${gold}</strong></span>
      <span class="${supplyTone}">Supplies <strong>${potionCount}P / ${etherCount}E</strong></span>
    </div>
  `;
}

function renderChapterProgress() {
  const complete = QUESTS.filter(quest => getQuestProgress(quest.id).complete).length;
  const percent = Math.round((complete / QUESTS.length) * 100);
  const nextQuest = QUESTS.find(quest => !getQuestProgress(quest.id).complete);
  const nextArea = nextQuest ? AREAS.find(area => area.id === nextQuest.areaId) : null;
  return `
    <div class="chapter-progress">
      <div>
        <strong>Chapter progress</strong>
        <span>${complete}/${QUESTS.length} objectives complete${nextArea ? ` - Next: ${nextArea.name}` : ' - Chapter ready to close'}</span>
      </div>
      <div class="chapter-meter"><span style="width:${percent}%"></span></div>
    </div>
  `;
}

function renderReadinessChecklist(area, preview) {
  const averageLevel = Math.max(1, Math.round(gameState.party.reduce((sum, member) => sum + member.level, 0) / gameState.party.length));
  const potionCount = gameState.inventory.potion || 0;
  const etherCount = gameState.inventory.ether || 0;
  const restNeeded = shouldRecommendRest();
  const enemyCount = preview?.encounter.enemies.length || 0;
  const checks = [
    {
      label: 'Level',
      value: `Party ${averageLevel} / Route ${area.recommendedLevel}`,
      tone: averageLevel >= area.recommendedLevel ? 'safe' : 'danger'
    },
    {
      label: 'Health',
      value: restNeeded ? 'Rest advised' : 'Ready',
      tone: restNeeded ? 'ready' : 'safe'
    },
    {
      label: 'Supplies',
      value: `${potionCount} potions, ${etherCount} ethers`,
      tone: potionCount >= Math.max(2, enemyCount) ? 'safe' : potionCount > 0 ? 'ready' : 'danger'
    }
  ];
  return `
    <div class="readiness-checklist">
      ${checks.map(check => `
        <span class="${check.tone}">
          <strong>${check.label}</strong>
          <em>${check.value}</em>
        </span>
      `).join('')}
    </div>
  `;
}

function renderRouteForecast(area, preview) {
  const progress = getQuestProgress(area.questId);
  const encounter = preview?.encounter;
  if (!encounter) return '';
  const winsRemaining = Math.max(0, progress.requiredWins - progress.wins);
  const xp = encounter.enemies.reduce((sum, enemy) => sum + enemy.xp, 0);
  const nextUnlock = getNextUnlockText(area);
  const weakest = getLowestHpMember();
  return `
    <div class="route-forecast">
      <span><strong>Objective</strong>${winsRemaining} ${winsRemaining === 1 ? 'clear' : 'clears'} left</span>
      <span><strong>Growth</strong>${xp} XP if won</span>
      <span><strong>Risk</strong>${weakest.name} lowest at ${weakest.hp}/${weakest.maxHp} HP</span>
      <span><strong>Reward</strong>${nextUnlock}</span>
    </div>
  `;
}

function getNextUnlockText(area) {
  const quest = QUESTS.find(entry => entry.id === area.questId);
  if (!quest) return 'Route reward unknown';
  const progress = getQuestProgress(quest.id);
  if (!progress.complete && progress.wins + 1 >= progress.requiredWins) return quest.reward;
  return progress.complete ? 'Objective complete' : quest.reward;
}

function renderKnownEnemyAdvice(preview) {
  if (!preview) return '';
  const knownEntries = getBestiaryEntries();
  const seenTypes = Array.from(new Set(preview.encounter.enemies.map(enemy => enemy.type)));
  const advice = seenTypes
    .map(type => knownEntries.find(entry => entry.type === type && entry.discovered))
    .filter(Boolean);
  if (!advice.length) {
    return `
      <div class="known-enemy-advice locked">
        <strong>Enemy habits unknown</strong>
        <span>Scout this path or survive an encounter to reveal better guidance.</span>
      </div>
    `;
  }
  return `
    <div class="known-enemy-advice">
      <strong>Known enemy habits</strong>
      ${advice.map(entry => `<span>${entry.name}: ${entry.advice}</span>`).join('')}
    </div>
  `;
}

function renderJournalPanel() {
  const events = getStoryEvents();
  const achievements = getAchievements();
  const unlocked = achievements.filter(entry => entry.unlocked).length;
  hud.copy.innerHTML = `
    <div class="journal-panel">
      <strong>Journal</strong>
      <span>${events.length} entries discovered</span>
      ${events.map(event => `
        <article class="journal-entry">
          <h3>${event.title}</h3>
          <p>${event.body}</p>
        </article>
      `).join('')}
      <strong class="achievement-heading">Achievements ${unlocked}/${achievements.length}</strong>
      <div class="achievement-list">
        ${achievements.map(entry => `
          <span class="${entry.unlocked ? 'unlocked' : 'locked'}">
            <strong>${entry.unlocked ? entry.title : '???'}</strong>
            <em>${entry.description}</em>
          </span>
        `).join('')}
      </div>
    </div>
  `;
  hud.actions.innerHTML = '';
  addButton('World Map', () => {
    townPanelMode = 'map';
    renderHud('town');
  }, 'wide secondary-action');
  addButton('Party Management', () => {
    townPanelMode = 'party';
    renderHud('town');
  });
  addButton('Supplies', () => {
    townPanelMode = 'supplies';
    renderHud('town');
  });
}

function renderBestiaryPanel() {
  const entries = getBestiaryEntries();
  const discovered = entries.filter(entry => entry.discovered).length;
  hud.copy.innerHTML = `
    <div class="bestiary-panel">
      <strong>Bestiary</strong>
      <span>${discovered}/${entries.length} enemy types discovered</span>
      ${entries.map(renderBestiaryEntry).join('')}
    </div>
  `;
  hud.actions.innerHTML = '';
  addButton('World Map', () => {
    townPanelMode = 'map';
    renderHud('town');
  }, 'wide secondary-action');
  addButton('Journal', () => {
    townPanelMode = 'journal';
    renderHud('town');
  });
  addButton('Supplies', () => {
    townPanelMode = 'supplies';
    renderHud('town');
  });
}

function renderBestiaryEntry(entry) {
  if (!entry.discovered) {
    return `
      <article class="bestiary-entry locked">
        <strong>Unknown</strong>
        <span>Scout or encounter this enemy type to reveal it.</span>
      </article>
    `;
  }
  return `
    <article class="bestiary-entry">
      <header>
        <strong>${entry.name}</strong>
        <em>${entry.family}</em>
      </header>
      <span>${entry.trait}</span>
      <small>${entry.advice}</small>
      <small>Intent: ${entry.intent}</small>
      <em>Defeated ${entry.defeated}</em>
    </article>
  `;
}

function renderNpcPanel(npcId) {
  const npc = getNpcDialogue(npcId);
  hud.copy.innerHTML = `
    <div class="npc-panel">
      <strong>${npc.name}</strong>
      <p>${npc.line}</p>
    </div>
  `;
  hud.actions.innerHTML = '';
  addButton('World Map', () => {
    townPanelMode = 'map';
    renderHud('town');
  }, 'wide secondary-action');
  addButton('Quartermaster', () => {
    townPanelMode = 'npc:quartermaster';
    renderHud('town');
  });
  addButton('Innkeeper', () => {
    townPanelMode = 'npc:innkeeper';
    renderHud('town');
  });
  addRestButton();
}

function renderSuppliesPanel() {
  hud.copy.innerHTML = `
    <div class="supplies-panel">
      <strong>Supplies</strong>
      <span>Consumables found, bought, and carried into battle.</span>
      <div class="inventory-grid">
        ${Object.values(ITEMS).map(renderInventoryItem).join('')}
      </div>
    </div>
  `;
  hud.actions.innerHTML = '';
  addButton('World Map', () => {
    townPanelMode = 'map';
    renderHud('town');
  }, 'wide secondary-action');
  Object.values(ITEMS).filter(item => item.kind !== 'key').forEach(item => {
    addBuyItemButton(item.id, `Buy ${item.name} ${item.cost}g`, item.description);
  });
}

function addBuyItemButton(itemId, label, note = '') {
  const item = ITEMS[itemId];
  const button = addButton(label, () => {
    if (itemId === 'potion') buyPotion();
    else buyItem(itemId);
    renderHud('town');
  }, '', note || item?.description || '');
  if (!item) return button;
  button.disabled = gameState.gold < item.cost;
  button.title = gameState.gold < item.cost ? `Need ${item.cost - gameState.gold} more gold.` : item.description;
  return button;
}

function renderInventoryItem(item) {
  const quantity = gameState.inventory[item.id] || 0;
  return `
    <article class="inventory-item ${quantity ? '' : 'empty'}">
      <strong>${item.name}</strong>
      <span>${item.description}</span>
      <em>x${quantity}</em>
    </article>
  `;
}

function renderPartyPanel() {
  const member = getSelectedMember();
  const weapon = getWeapon(member);
  const unlocks = getAbilityUnlocks(member.id);
  hud.copy.innerHTML = `
    <div class="member-detail">
      <header>
        <img class="member-detail-portrait" src="${member.portrait}" alt="${member.name} portrait">
        <div>
          <strong>${member.name}</strong>
          <span>${member.role} - Level ${member.level}</span>
          <small>${weapon.name} equipped</small>
        </div>
      </header>
      <div class="detail-stat-grid">
        <span>HP <strong>${member.hp}/${member.maxHp}</strong></span>
        <span>MP <strong>${member.mp}/${member.maxMp}</strong></span>
        <span>ATK <strong>${member.stats.atk + weapon.atk}</strong></span>
        <span>MAG <strong>${member.stats.mag + weapon.mag}</strong></span>
        <span>DEF <strong>${member.stats.def}</strong></span>
        <span>SPD <strong>${member.stats.spd}</strong></span>
      </div>
      <div class="ability-list">
        ${member.spells.map(spellId => renderAbilityPill(SPELLS[spellId], true)).join('')}
        ${unlocks.filter(unlock => member.level < unlock.level).map(unlock => renderLockedAbility(unlock)).join('')}
      </div>
    </div>
  `;
  hud.actions.innerHTML = '';
  addButton('World Map', () => {
    townPanelMode = 'map';
    renderHud('town');
  }, 'wide secondary-action');
  gameState.party.forEach(partyMember => {
    addButton(partyMember.name, () => {
      selectedMemberId = partyMember.id;
      renderHud('town');
    }, partyMember.id === member.id ? 'selected-action' : '');
  });
  Object.values(WEAPONS).forEach(option => {
    const owned = gameState.inventory.weapons.includes(option.id);
    const equipped = member.weapon === option.id;
    const label = `${equipped ? 'Equipped' : owned ? 'Equip' : 'Buy'} ${option.name}${owned || option.cost === 0 ? '' : ` ${option.cost}g`}`;
    const button = addButton(label, () => {
      equipWeapon(member.id, option.id);
      renderHud('town');
    }, equipped ? 'wide selected-action' : '');
    button.disabled = equipped;
  });
}

function getSelectedMember() {
  return gameState.party.find(member => member.id === selectedMemberId) || gameState.party[0];
}

function renderAbilityPill(spell, learned) {
  if (!spell) return '';
  const targetText = spell.target === 'allEnemies' ? 'All enemies' : spell.target === 'partyShield' ? 'Party shield' : spell.target === 'party' ? 'Party buff' : spell.target === 'ally' ? 'Ally' : 'Enemy';
  return `
    <div class="ability-pill ${learned ? '' : 'locked'}">
      <strong>${spell.name}</strong>
      <span>${spell.mp} MP - ${targetText}</span>
    </div>
  `;
}

function renderLockedAbility(unlock) {
  return `
    <div class="ability-pill locked">
      <strong>${unlock.spell.name}</strong>
      <span>Unlocks at level ${unlock.level}</span>
    </div>
  `;
}

function renderQuestRow(quest) {
  const progress = getQuestProgress(quest.id);
  const unlocked = isAreaUnlocked(quest.areaId);
  const area = AREAS.find(entry => entry.id === quest.areaId);
  const readiness = getAreaReadiness(quest.areaId);
  const status = progress.complete ? 'Complete' : unlocked ? 'Open' : 'Locked';
  return `
    <div class="quest-row ${progress.complete ? 'complete' : ''} ${unlocked ? '' : 'locked'}">
      <div>
        <strong>${quest.title}</strong>
        <span>${quest.description}</span>
      </div>
      <em>${status} ${progress.wins}/${progress.requiredWins}</em>
      <div class="quest-meter"><span style="width:${progress.percent}%"></span></div>
      <small>${area.name} - ${quest.reward}</small>
      <small class="readiness-line ${readiness.tone}">${readiness.label}: ${readiness.detail}</small>
    </div>
  `;
}

function renderRouteCard(area) {
  const progress = getQuestProgress(area.questId);
  const readiness = getAreaReadiness(area.id);
  const unlocked = isAreaUnlocked(area.id);
  return `
    <article class="route-card ${unlocked ? readiness.tone : 'locked'}">
      <strong>${area.name}</strong>
      <span>${progress.wins}/${progress.requiredWins} cleared</span>
      <small>${unlocked ? readiness.label : 'Locked'}</small>
    </article>
  `;
}

function renderBattlePanel() {
  const battle = gameState.battle;
  const area = getBattleArea();
  const progress = area ? getQuestProgress(area.questId) : null;
  if (battle.won) {
    hud.copy.innerHTML = `
      <strong>Victory claimed.</strong><br>
      Review the rewards on the battlefield, then choose the party's next move.
    `;
    hud.actions.innerHTML = '';
    renderVictoryOverlay(area, progress);
    renderParty();
    renderLog();
    return;
  }
  if (battle.lost) {
    hud.copy.innerHTML = '<strong>The party has fallen.</strong><br>Return to town. Resting will restore everyone for another attempt.';
    hud.actions.innerHTML = '';
    if (gameState.gold >= 10) {
      addButton('Return and Rest 10g', () => {
        returnToTown();
        camp();
        townPanelMode = 'map';
        currentScene.scene.start('TownScene');
      }, 'wide area-action', 'Restore the party before trying again.');
    }
    addButton('Return to Town', () => {
      returnToTown();
      townPanelMode = 'map';
      currentScene.scene.start('TownScene');
    }, 'wide');
    return;
  }

  const actor = gameState.party[battle.actorIndex];
  const livingEnemies = battle.enemies.filter(enemy => enemy.hp > 0);
  const livingAllies = gameState.party.filter(member => member.hp > 0);
  const recommendation = getRecommendedAction(actor, livingEnemies, livingAllies);
  hud.copy.innerHTML = renderBattleContext(actor, livingEnemies, area);
  hud.actions.innerHTML = '';
  addActionGroupLabel('Attack');
  livingEnemies.forEach(enemy => {
    const actionKey = `attack:${enemy.id}`;
    const enemyLabel = getEnemyLabel(enemy, livingEnemies);
    addTargetButton(`Attack ${enemyLabel} ${enemy.hp}/${enemy.maxHp}`, enemy.id, () => {
      partyAttack(enemy.id);
      currentScene.scene.restart();
    }, actionClass(`${livingEnemies.length === 1 ? 'wide ' : ''}${enemyActionClass(enemy)}`, recommendation, actionKey), describeAttack(actor, enemy, enemyLabel));
  });
  addActionGroupLabel('Magic');
  actor.spells.forEach(spellId => {
    const spell = SPELLS[spellId];
    if (spell.target === 'enemy') {
      livingEnemies.forEach(enemy => {
        const actionKey = `spell:${spell.id}:${enemy.id}`;
        const enemyLabel = getEnemyLabel(enemy, livingEnemies);
        const button = addTargetButton(`${spell.name} ${enemyLabel} ${spell.mp}MP`, enemy.id, () => {
          castSpell(spell.id, enemy.id);
          currentScene.scene.restart();
        }, actionClass(enemyActionClass(enemy), recommendation, actionKey), describeSpell(actor, spell, enemy, enemyLabel));
        button.disabled = actor.mp < spell.mp;
      });
      return;
    }
    if (spell.target === 'allEnemies') {
      const actionKey = `spell:${spell.id}:allEnemies`;
      const button = addTargetButton(`${spell.name} All ${spell.mp}MP`, 'allEnemies', () => {
        castSpell(spell.id);
        currentScene.scene.restart();
      }, actionClass('wide', recommendation, actionKey), describeSpell(actor, spell));
      button.disabled = actor.mp < spell.mp;
      return;
    }
    if (spell.target === 'ally') {
      livingAllies.forEach(ally => {
        const actionKey = `spell:${spell.id}:${ally.id}`;
        const button = addTargetButton(`${spell.name} ${ally.name} ${spell.mp}MP`, ally.id, () => {
          castSpell(spell.id, ally.id);
          currentScene.scene.restart();
        }, actionClass(allyActionClass(ally), recommendation, actionKey), describeSpell(actor, spell, ally));
        button.disabled = actor.mp < spell.mp || ally.hp >= ally.maxHp;
        if (ally.hp >= ally.maxHp) button.title = `${ally.name} is already at full HP.`;
      });
      return;
    }
    const supportTarget = spell.target === 'party' || spell.target === 'partyShield' ? 'allParty' : actor.id;
    const actionKey = `spell:${spell.id}:${supportTarget}`;
    const button = addTargetButton(`${spell.name} ${spell.mp}MP`, supportTarget, () => {
      castSpell(spell.id, actor.id);
      currentScene.scene.restart();
    }, actionClass(spell.target === 'party' || spell.target === 'partyShield' ? 'wide support-action' : 'support-action', recommendation, actionKey), describeSpell(actor, spell));
    button.disabled = actor.mp < spell.mp;
  });
  addActionGroupLabel('Defense');
  const guardKey = `guard:${actor.id}`;
  addButton('Guard', () => {
    guard();
    currentScene.scene.restart();
  }, actionClass('support-action', recommendation, guardKey), 'Reduce incoming damage for this character until enemies act.');
  addActionGroupLabel('Items');
  addAllyItemButtons('potion', livingAllies, recommendation);
  addBattleItemButtons(actor, recommendation);
  addButton('Flee to Town', () => {
    pushLog('The party retreats to the village.');
    returnToTown();
    townPanelMode = 'map';
    currentScene.scene.start('TownScene');
  }, 'wide');
}

function renderBattleContext(actor, livingEnemies, area) {
  const themeNote = area ? `${area.name}: ${getAreaTheme(area.id).note}` : 'Choose an action.';
  const battle = gameState.battle;
  const shieldText = battle.shield > 0 ? `<span>Shield ${battle.shield}</span>` : '';
  const rallyText = battle.rally > 0 ? `<span>Rally +${battle.rally}</span>` : '';
  const objectiveText = area ? renderBattleObjective(area) : '';
  return `
    <strong>${actor.name}'s turn.</strong><br>${themeNote}
    <div class="battle-context-row">
      <span>${livingEnemies.length} ${livingEnemies.length === 1 ? 'enemy' : 'enemies'} standing</span>
      <span>${renderTurnForecast(actor)}</span>
      ${objectiveText}
      ${shieldText}
      ${rallyText}
    </div>
    ${renderIntentSummary()}
    ${renderIncomingSummary()}
    <small class="tactical-tip">${getTacticalTip(actor, livingEnemies)}</small>
  `;
}

function renderBattleObjective(area) {
  const progress = getQuestProgress(area.questId);
  const remaining = Math.max(0, progress.requiredWins - progress.wins);
  return `<span>Objective: ${remaining} ${remaining === 1 ? 'clear' : 'clears'} left</span>`;
}

function renderTurnForecast(actor) {
  const living = gameState.party.filter(member => member.hp > 0);
  const currentIndex = living.findIndex(member => member.id === actor.id);
  const next = living[(currentIndex + 1) % living.length];
  return next && next.id !== actor.id ? `Next: ${next.name}` : 'Last ally standing';
}

function renderIntentSummary() {
  const intents = gameState.battle?.intents || {};
  const livingEnemies = gameState.battle?.enemies.filter(candidate => candidate.hp > 0) || [];
  const entries = Object.entries(intents).map(([enemyId, intent]) => {
    const enemy = gameState.battle.enemies.find(candidate => candidate.id === enemyId);
    const target = gameState.party.find(member => member.id === intent.targetId);
    if (!enemy || enemy.hp <= 0) return '';
    return `<span class="intent-chip ${intent.type}">${getEnemyLabel(enemy, livingEnemies)}: ${intent.label}${target ? ` -> ${target.name}` : ''}</span>`;
  }).filter(Boolean);
  if (!entries.length) return '';
  return `<div class="intent-summary">${entries.join('')}</div>`;
}

function renderIncomingSummary() {
  const threatened = gameState.party
    .filter(member => member.hp > 0)
    .map(member => ({ member, threat: getIncomingThreat(member.id) }))
    .filter(entry => entry.threat.count > 0)
    .sort((a, b) => b.threat.high - a.threat.high);
  if (!threatened.length) return '';
  return `
    <div class="incoming-summary">
      ${threatened.map(({ member, threat }) => `
        <span class="${threat.high >= Math.ceil(member.hp * 0.5) ? 'danger' : 'ready'}">
          ${member.name} incoming ${threat.low}-${threat.high}
        </span>
      `).join('')}
    </div>
  `;
}

function getTacticalTip(actor, livingEnemies) {
  const endangered = gameState.party.find(member => member.hp > 0 && member.hp / member.maxHp <= 0.35);
  if (endangered) return `${endangered.name} is in danger. Heal, guard, or finish an enemy before the next enemy turn.`;
  const heavyIntent = Object.values(gameState.battle?.intents || {}).find(intent => intent.type === 'heavy');
  if (heavyIntent) return 'A heavy attack is coming. Guarding or reducing enemy count is valuable this turn.';
  if (actor.mp <= Math.max(3, Math.floor(actor.maxMp * 0.25))) return `${actor.name}'s MP is low. Consider an Ether or basic attacks.`;
  if (livingEnemies.length > 1 && actor.spells.some(spellId => SPELLS[spellId]?.target === 'allEnemies')) return 'Multiple enemies are up. An all-enemy skill can swing the turn.';
  return 'Focus one enemy at a time to reduce incoming attacks.';
}

function renderVictorySummary(area, progress) {
  const reward = gameState.lastReward || { xp: 0, gold: 0, loot: [] };
  const lootText = reward.loot?.length
    ? reward.loot.map(drop => `${ITEMS[drop.itemId]?.name || drop.itemId} x${drop.quantity}`).join(', ')
    : 'No item drops this time';
  const levelUps = reward.levelUps?.length
    ? `<div class="level-up-list">${reward.levelUps.map(entry => `
        <span>${entry.name} Lv ${entry.from}->${entry.to}${entry.learned?.length ? ` learned ${entry.learned.map(spellId => SPELLS[spellId]?.name || spellId).join(', ')}` : ''}</span>
      `).join('')}</div>`
    : '';
  return `
    <div class="victory-summary">
      <strong>Victory in ${area?.name || 'the wilds'}.</strong>
      <span>Objective progress: ${progress ? `${progress.wins}/${progress.requiredWins}` : 'complete'}</span>
      <div class="reward-grid">
        <span>XP <strong>${reward.xp}</strong></span>
        <span>Gold <strong>${reward.gold}</strong></span>
      </div>
      ${levelUps}
      <small>Loot: ${lootText}</small>
      ${renderVictoryNextStep(area, progress)}
    </div>
  `;
}

function renderVictoryOverlay(area, progress) {
  const reward = gameState.lastReward || { xp: 0, gold: 0, loot: [], levelUps: [] };
  const loot = reward.loot?.length
    ? reward.loot.map(drop => `<span>${ITEMS[drop.itemId]?.name || drop.itemId} <strong>x${drop.quantity}</strong></span>`).join('')
    : '<span>No item drops <strong>this time</strong></span>';
  const levelUps = reward.levelUps?.length
    ? reward.levelUps.map(entry => `
        <span>
          ${entry.name} <strong>Lv ${entry.from}->${entry.to}</strong>
          ${entry.learned?.length ? `<em>Learned ${entry.learned.map(spellId => SPELLS[spellId]?.name || spellId).join(', ')}</em>` : ''}
        </span>
      `).join('')
    : '<span>No level ups <strong>yet</strong></span>';
  hud.victoryCopy.innerHTML = `
    <p class="victory-kicker">Battle Complete</p>
    <h2>Victory in ${area?.name || 'the wilds'}</h2>
    <p class="victory-subtitle">${getVictoryMessage(area, progress)}</p>
    <div class="victory-reward-grid">
      <span>XP <strong>${reward.xp}</strong></span>
      <span>Gold <strong>${reward.gold}</strong></span>
      <span>Objective <strong>${progress ? `${progress.wins}/${progress.requiredWins}` : 'Done'}</strong></span>
    </div>
    <div class="victory-breakdown">
      <section>
        <h3>Loot Gained</h3>
        <div>${loot}</div>
      </section>
      <section>
        <h3>Level Ups</h3>
        <div>${levelUps}</div>
      </section>
    </div>
    ${renderVictoryNextStep(area, progress)}
  `;
  hud.victoryActions.innerHTML = '';
  addVictoryChoices(area, progress);
  hud.victoryOverlay.classList.remove('hidden');
  if (lastVictoryChime !== gameState.lastReward) {
    lastVictoryChime = gameState.lastReward;
    playSound('victory');
  }
}

function getVictoryMessage(area, progress) {
  if (progress?.complete) {
    const quest = QUESTS.find(entry => entry.id === area?.questId);
    return quest?.reward || 'The path ahead has changed.';
  }
  if (shouldRecommendRest()) return 'The party survived, but the road took its share. Rest before pressing deeper.';
  return 'The party holds formation. You can press onward or return to town to prepare.';
}

function addVictoryChoices(area, progress) {
  if (progress?.complete && area?.questId === 'claim-crystal' && !gameState.endingSeen) {
    addVictoryButton('Witness the First Light', () => {
      hideVictoryOverlay();
      returnToTown();
      markEndingSeen();
      townPanelMode = 'map';
      menuOpen = false;
      currentScene.scene.start('IntroScene', { beats: ENDING_SCENES, next: 'TownScene' });
    }, 'primary');
  }
  if (area && !shouldRecommendRest() && !progress?.complete) {
    addVictoryButton('Continue Path', () => {
      hideVictoryOverlay();
      returnToTown();
      if (!startEncounter(area.id)) {
        renderHud('town');
        return;
      }
      menuOpen = false;
      currentScene.scene.start('BattleScene');
    }, 'primary');
  }
  if (shouldRecommendRest() && gameState.gold >= 10) {
    addVictoryButton('Rest at Inn 10g', () => {
      hideVictoryOverlay();
      returnToTown();
      camp();
      townPanelMode = 'map';
      menuOpen = false;
      currentScene.scene.start('TownScene');
    }, 'primary');
  }
  if ((gameState.inventory.potion || 0) <= 1 && gameState.gold >= ITEMS.potion.cost) {
    addVictoryButton('Buy Potion', () => {
      hideVictoryOverlay();
      returnToTown();
      buyPotion();
      townPanelMode = 'supplies';
      menuOpen = true;
      currentScene.scene.start('TownScene');
    });
  }
  addVictoryButton(progress?.complete ? 'Return to Map' : 'Return to Town', () => {
    hideVictoryOverlay();
    returnToTown();
    townPanelMode = 'map';
    menuOpen = false;
    currentScene.scene.start('TownScene');
  }, 'secondary');
}

function renderVictoryNextStep(area, progress) {
  if (!area || !progress) return '<small>Return to town to choose the next route.</small>';
  if (progress.complete) {
    const quest = QUESTS.find(entry => entry.id === area.questId);
    return `<div class="next-step-banner complete"><strong>Objective complete</strong><span>${quest?.reward || 'New progress unlocked.'}</span></div>`;
  }
  const remaining = Math.max(0, progress.requiredWins - progress.wins);
  const restText = shouldRecommendRest() ? 'Rest is recommended before another push.' : 'The party is fit enough to continue.';
  return `<div class="next-step-banner"><strong>${remaining} ${remaining === 1 ? 'clear' : 'clears'} left here</strong><span>${restText}</span></div>`;
}

function shouldRecommendRest() {
  return gameState.party.some(member => member.hp / member.maxHp < 0.45 || member.mp / member.maxMp < 0.25);
}

function getLowestHpMember() {
  return [...gameState.party].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] || gameState.party[0];
}

function addBattleItemButtons(actor, recommendation) {
  Object.values(ITEMS).filter(item => item.kind !== 'key').forEach(item => {
    const quantity = gameState.inventory[item.id] || 0;
    if (quantity <= 0 || item.id === 'potion') return;
    if (item.target === 'ally') {
      addAllyItemButtons(item.id, gameState.party.filter(member => member.hp > 0), recommendation);
      return;
    }
    if (item.kind === 'damageAll') {
      const actionKey = `item:${item.id}:allEnemies`;
      addTargetButton(`${item.name} x${quantity}`, 'allEnemies', () => {
        useItem(item.id, actor.id);
        currentScene.scene.restart();
      }, actionClass('wide', recommendation, actionKey), item.description);
      return;
    }
    addButton(`${item.name} x${quantity}`, () => {
      useItem(item.id, actor.id);
      currentScene.scene.restart();
    });
  });
}

function addAllyItemButtons(itemId, allies, recommendation = null) {
  const item = ITEMS[itemId];
  const quantity = gameState.inventory[itemId] || 0;
  if (!item || quantity <= 0) return;
  const recoverableAllies = allies
    .map(ally => ({
      ally,
      missing: item.kind === 'mp' ? ally.maxMp - ally.mp : ally.maxHp - ally.hp
    }))
    .filter(entry => entry.missing > 0);
  if (!recoverableAllies.length) {
    const button = addButton(`${item.name}: party full x${quantity}`, () => {}, 'support-action', item.description);
    button.disabled = true;
    button.title = item.kind === 'mp' ? 'Everyone is already at full MP.' : 'Everyone is already at full HP.';
    return;
  }
  recoverableAllies.forEach(({ ally, missing }) => {
    const recovery = Math.min(item.amount, Math.max(0, missing));
    const suffix = recovery > 0 ? ` +${recovery}${item.kind === 'mp' ? 'MP' : 'HP'}` : ' full';
    const actionKey = `item:${item.id}:${ally.id}`;
    const button = addTargetButton(`${item.name} ${ally.name}${suffix} x${quantity}`, ally.id, () => {
      if (item.id === 'potion') usePotion(ally.id);
      else useItem(item.id, ally.id);
      currentScene.scene.restart();
    }, actionClass(allyActionClass(ally), recommendation, actionKey), item.description);
    button.disabled = quantity <= 0;
  });
}

function getRecommendedAction(actor, livingEnemies, livingAllies) {
  const endangered = livingAllies.find(member => member.hp / member.maxHp <= 0.35);
  const mend = actor.spells.map(spellId => SPELLS[spellId]).find(spell => spell?.target === 'ally' && actor.mp >= spell.mp);
  if (endangered && mend && endangered.hp < endangered.maxHp) return `spell:${mend.id}:${endangered.id}`;
  if (endangered && (gameState.inventory.potion || 0) > 0 && endangered.hp < endangered.maxHp) return `item:potion:${endangered.id}`;

  const allEnemySpell = actor.spells
    .map(spellId => SPELLS[spellId])
    .find(spell => spell?.target === 'allEnemies' && actor.mp >= spell.mp);
  if (livingEnemies.length > 1 && allEnemySpell) return `spell:${allEnemySpell.id}:allEnemies`;
  if (livingEnemies.length > 2 && (gameState.inventory.fire_bomb || 0) > 0) return 'item:fire_bomb:allEnemies';

  const killTarget = livingEnemies.find(enemy => estimateAttackDamage(actor, enemy).high >= enemy.hp);
  if (killTarget) return `attack:${killTarget.id}`;

  const heavyTargetId = Object.values(gameState.battle?.intents || {}).find(intent => intent.type === 'heavy')?.targetId;
  if (heavyTargetId === actor.id) return `guard:${actor.id}`;

  const weakest = [...livingEnemies].sort((a, b) => a.hp - b.hp)[0];
  return weakest ? `attack:${weakest.id}` : null;
}

function actionClass(baseClass, recommendation, actionKey) {
  return [baseClass, recommendation === actionKey ? 'recommended-action' : '']
    .filter(Boolean)
    .join(' ')
    .trim();
}

function enemyActionClass(enemy) {
  const pct = enemy.maxHp ? enemy.hp / enemy.maxHp : 1;
  if (pct <= 0.35) return 'enemy-weakened';
  if (pct >= 0.8) return 'enemy-healthy';
  return '';
}

function allyActionClass(ally) {
  if (ally.hp > 0 && ally.hp / ally.maxHp <= 0.35) return 'ally-danger';
  if (ally.mp / ally.maxMp <= 0.25) return 'ally-low-mp';
  return 'support-action';
}

function describeAttack(actor, enemy, label = enemy.name) {
  const { low, high } = estimateAttackDamage(actor, enemy);
  const finish = high >= enemy.hp ? ' Can finish.' : '';
  return `${label}: estimated ${low}-${high} damage.${finish}`;
}

function estimateAttackDamage(actor, enemy) {
  const weapon = getWeapon(actor);
  const rally = gameState.battle?.rally || 0;
  const low = Math.max(1, actor.stats.atk + weapon.atk + rally - enemy.def + 1);
  const high = Math.max(low, actor.stats.atk + weapon.atk + rally - enemy.def + 4);
  return { low, high };
}

function describeSpell(actor, spell, target = null, label = target?.name) {
  if (!spell) return '';
  if (spell.target === 'ally' && target) return `Restores HP for ${target.name}. Costs ${spell.mp} MP.`;
  if (spell.target === 'allEnemies') return `Hits every living enemy. Costs ${spell.mp} MP.`;
  if (spell.target === 'party') return `Raises party attack. Costs ${spell.mp} MP.`;
  if (spell.target === 'partyShield') return `Reduces incoming damage. Costs ${spell.mp} MP.`;
  if (target && spell.target === 'enemy') {
    const damage = estimateSpellDamage(actor, spell, target);
    const finish = damage.high >= target.hp ? ' Can finish.' : '';
    return `${label}: estimated ${damage.low}-${damage.high}. Costs ${spell.mp} MP.${finish}`;
  }
  if (target) return `Targets ${target.name}. Costs ${spell.mp} MP.`;
  return `Costs ${spell.mp} MP.`;
}

function estimateSpellDamage(actor, spell, enemy) {
  const weapon = getWeapon(actor);
  const statValue = spell.stat === 'atk' ? actor.stats.atk + weapon.atk : actor.stats.mag + weapon.mag;
  const low = Math.max(2, statValue + spell.power - enemy.def + 1);
  const high = Math.max(low, statValue + spell.power - enemy.def + 5);
  return { low, high };
}

function addRestButton(className = '') {
  const fullyRecovered = gameState.party.every(member => member.hp === member.maxHp && member.mp === member.maxMp);
  const button = addButton('Rest 10g', () => {
    camp();
    renderHud('town');
  }, className, fullyRecovered ? 'Party is already fully recovered.' : 'Restore all HP and MP.');
  button.disabled = fullyRecovered || gameState.gold < 10;
  button.title = fullyRecovered ? 'Party is already fully recovered.' : gameState.gold < 10 ? 'Need 10 gold to rest.' : 'Restore all HP and MP.';
  return button;
}

function totalConsumables() {
  return Object.values(ITEMS)
    .filter(item => item.kind !== 'key')
    .reduce((sum, item) => sum + (gameState.inventory[item.id] || 0), 0);
}

function getSaveStatusText() {
  if (!gameState.lastSavedAt) return 'Saved --';
  const elapsed = Math.max(0, Date.now() - gameState.lastSavedAt);
  if (elapsed < 60_000) return 'Saved just now';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `Saved ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Saved ${hours}h ago`;
}

function renderProgressMini(member) {
  const remaining = Math.max(0, xpToNextLevel(member) - member.xp);
  const label = remaining === 0 ? 'Level ready' : `${remaining} XP to Lv ${member.level + 1}`;
  return `<span class="progress-mini">${label}</span>`;
}

function renderPartyThreat(threat) {
  if (!threat.count) return '';
  const sourceText = threat.count === 1 ? threat.sources[0] : `${threat.count} enemies`;
  return `<span class="threat-chip ${threat.high >= 12 ? 'danger' : 'ready'}">${sourceText} ${threat.low}-${threat.high}</span>`;
}

function getIncomingThreat(memberId) {
  const battle = gameState.battle;
  if (!battle?.intents) return { count: 0, low: 0, high: 0, sources: [] };
  return Object.entries(battle.intents).reduce((summary, [enemyId, intent]) => {
    if (intent.targetId !== memberId || intent.type === 'guard') return summary;
    const enemy = battle.enemies.find(candidate => candidate.id === enemyId);
    const target = gameState.party.find(member => member.id === memberId);
    if (!enemy || !target || enemy.hp <= 0 || target.hp <= 0) return summary;
    const damage = estimateIntentDamage(enemy, intent, target);
    summary.count += 1;
    summary.low += damage.low;
    summary.high += damage.high;
    summary.sources.push(getEnemyLabel(enemy, battle.enemies.filter(candidate => candidate.hp > 0)));
    return summary;
  }, { count: 0, low: 0, high: 0, sources: [] });
}

function getEnemyLabel(enemy, enemies = gameState.battle?.enemies || []) {
  const sameName = enemies.filter(candidate => candidate.name === enemy.name);
  if (sameName.length <= 1) return enemy.name;
  const index = sameName.findIndex(candidate => candidate.id === enemy.id);
  return `${enemy.name} ${String.fromCharCode(65 + Math.max(0, index))}`;
}

function estimateIntentDamage(enemy, intent, target) {
  const multiplier = intent.type === 'heavy' ? 1.45 : intent.type === 'quick' ? 0.85 : 1;
  const shield = gameState.battle?.shield || 0;
  const guarded = gameState.battle?.guarding?.[target.id] ? 4 : 0;
  const base = enemy.atk * multiplier - target.stats.def - shield - guarded;
  return {
    low: Math.max(1, Math.round(base + 1)),
    high: Math.max(1, Math.round(base + 5))
  };
}

function hideVictoryOverlay() {
  hud.victoryOverlay?.classList.add('hidden');
  if (hud.victoryCopy) hud.victoryCopy.innerHTML = '';
  if (hud.victoryActions) hud.victoryActions.innerHTML = '';
}

function addVictoryButton(label, handler, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', () => {
    playSound('click');
    button.blur();
    handler();
  });
  hud.victoryActions.appendChild(button);
  return button;
}

function addButton(label, handler, className = '', note = '') {
  const button = document.createElement('button');
  const hotkey = hud.actions.querySelectorAll('button').length + 1;
  if (hotkey <= 9) {
    button.dataset.hotkey = String(hotkey);
    button.title = note ? `Shortcut: ${hotkey}. ${note}` : `Shortcut: ${hotkey}`;
  } else if (note) {
    button.title = note;
  }
  const hotkeyMarkup = hotkey <= 9 ? `<span class="button-hotkey">${hotkey}</span>` : '';
  button.innerHTML = `
    ${hotkeyMarkup}
    <span class="button-label">${label}</span>
    ${note ? `<span class="button-note">${note}</span>` : ''}
  `;
  button.setAttribute('aria-label', label);
  if (className) button.className = className;
  button.addEventListener('click', () => {
    playSound('click');
    // Drop focus so Space (the town interact key) can't re-trigger this button.
    button.blur();
    handler();
  });
  hud.actions.appendChild(button);
  return button;
}

function addTargetButton(label, targetId, handler, className = '', note = '') {
  const button = addButton(label, () => {
    clearTargetPreview();
    handler();
  }, `${className} target-action`.trim(), note);
  button.dataset.targetId = targetId;
  button.addEventListener('mouseenter', () => setTargetPreview(targetId));
  button.addEventListener('focus', () => setTargetPreview(targetId));
  button.addEventListener('mouseleave', clearTargetPreview);
  button.addEventListener('blur', clearTargetPreview);
  return button;
}

function setTargetPreview(targetId) {
  previewTargetId = targetId;
}

function clearTargetPreview() {
  previewTargetId = null;
}

function addActionGroupLabel(label) {
  const marker = document.createElement('div');
  marker.className = 'action-group-label';
  marker.textContent = label;
  hud.actions.appendChild(marker);
}

function renderLog() {
  hud.log.innerHTML = gameState.log.map(entry => `<p>${entry}</p>`).join('');
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-stage',
  backgroundColor: '#101918',
  scale: {
    // Fixed logical resolution: every scene lays out against 1280x720 and
    // Phaser letterboxes to the viewport. Collision zones stay truthful at
    // any window size (Scale.RESIZE previously desynced them on resize).
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: [BootScene, IntroScene, TownScene, BattleScene]
};

const game = new Phaser.Game(config);
// Debug/testing handle: lets tooling drive or inspect the game loop.
window.__VITALIS_GAME__ = game;

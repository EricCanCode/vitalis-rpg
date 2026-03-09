// RPG Starter Core
console.log('[RPG] Script loading...');

// --- Player Initialization (move to top) ---
const player = {
  x: 400,  // Center of 800px wide area
  y: 300,  // Center of 600px tall area
  hp: 20,
  maxHp: 20,
  xp: 0,
  totalXp: 0,
  level: 1,
  coins: 0,
  stats: { str: 5, int: 3, dex: 4 },
  inventory: [],
  equipment: {
    weapon: 'iron_sword',
    armor: 'leather_armor',
    shield: 'wooden_shield'
  },
  clothingColor: '#c44',
};

// --- Canvas Setup (move to top) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Town Background Image ---
const townBackground = new Image();
townBackground.src = 'assets/tilesets/town_tileset.png';
let townBgLoaded = false;
townBackground.onload = () => {
  townBgLoaded = true;
  console.log('[RPG] Town background loaded: ' + townBackground.width + 'x' + townBackground.height);
};

// Image layout (1536x1024):
//   Top half  (0,0 to 1536,512)      = Village exterior
//   Bottom-left  (0,512 to 512,1024) = Building 1 interior (left house)
//   Bottom-mid   (512,512 to 1024,1024) = Building 2 interior (center shop)
//   Bottom-right  (1024,512 to 1536,1024) = Building 3 interior (right house)
const TOWN_IMG = {
  exterior:  { sx: 0, sy: 0, sw: 1536, sh: 512 },
  interior1: { sx: 0, sy: 512, sw: 512, sh: 512 },
  interior2: { sx: 512, sy: 512, sw: 512, sh: 512 },
  interior3: { sx: 1024, sy: 512, sw: 512, sh: 512 }
};

// Building entrance zones (positioned relative to canvas as percentages of width/height)
// These are where the player walks to enter a building
const BUILDING_ENTRANCES = [
  { id: 'building1', label: 'House',  xPct: 0.16, yPct: 0.65, wPct: 0.08, hPct: 0.08 },
  { id: 'building2', label: 'Shop',   xPct: 0.45, yPct: 0.58, wPct: 0.08, hPct: 0.08 },
  { id: 'building3', label: 'Tavern', xPct: 0.78, yPct: 0.60, wPct: 0.08, hPct: 0.08 }
];

// Collision zones for the village buildings/trees/objects (as % of canvas)
// These rectangles block player movement
const VILLAGE_COLLISION_ZONES = [
  // Left house (building 1) — walls only, leave door gap at bottom-right
  { xPct: 0.05, yPct: 0.22, wPct: 0.20, hPct: 0.38 },
  // Center shop (building 2) — walls only, leave door gap at bottom
  { xPct: 0.35, yPct: 0.16, wPct: 0.18, hPct: 0.38 },
  // Right house (building 3) — walls only, leave door gap at bottom-left
  { xPct: 0.66, yPct: 0.20, wPct: 0.20, hPct: 0.38 },
  // Top tree canopy — blocks walking off top
  { xPct: 0.0,  yPct: 0.0,  wPct: 1.0,  hPct: 0.15 },
];

// Helper: get the draw offset/scale for the exterior to maintain aspect ratio
// Uses "cover" — fills the entire canvas, cropping sides if needed
function getVillageDrawParams() {
  const src = TOWN_IMG.exterior;
  const imgAspect = src.sw / src.sh; // 1536/512 = 3
  const canvasAspect = canvas.width / canvas.height;
  
  let dw, dh, dx, dy;
  if (canvasAspect > imgAspect) {
    // Canvas is wider — fit width, overflow height (unlikely with 3:1 image)
    dw = canvas.width;
    dh = canvas.width / imgAspect;
    dx = 0;
    dy = (canvas.height - dh) / 2;
  } else {
    // Canvas is taller relative — fit height, crop sides
    dh = canvas.height;
    dw = canvas.height * imgAspect;
    dx = (canvas.width - dw) / 2;
    dy = 0;
  }
  return { dx, dy, dw, dh };
}

// Convert image-fraction coords to canvas pixel coords
function villageToCanvas(xFrac, yFrac) {
  const { dx, dy, dw, dh } = getVillageDrawParams();
  return { x: dx + xFrac * dw, y: dy + yFrac * dh };
}
function villageSizeToCanvas(wFrac, hFrac) {
  const { dw, dh } = getVillageDrawParams();
  return { w: wFrac * dw, h: hFrac * dh };
}

// Draw the village exterior (top half of image, aspect-ratio preserved)
function drawVillageTiles() {
  if (!townBgLoaded) return false;
  const src = TOWN_IMG.exterior;
  const { dx, dy, dw, dh } = getVillageDrawParams();
  
  // Fill any gap below the image with grass
  ctx.fillStyle = '#3a6b2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.drawImage(townBackground, src.sx, src.sy, src.sw, src.sh, dx, dy, dw, dh);
  
  // Draw building entrance indicators
  BUILDING_ENTRANCES.forEach(b => {
    const { x: bx, y: by } = villageToCanvas(b.xPct, b.yPct);
    const { w: bw, h: bh } = villageSizeToCanvas(b.wPct, b.hPct);
    
    // Check if player is near
    const p = getActivePlayer();
    const dist = Math.hypot(p.x - (bx + bw/2), p.y - (by + bh/2));
    if (dist < 60) {
      // Show "Enter" prompt
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press E to enter ' + b.label, bx + bw/2, by - 10);
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('Press E to enter ' + b.label, bx + bw/2 - 1, by - 11);
    }
  });
  
  return true;
}

// Draw a building interior (bottom sections of image, aspect-ratio preserved)
function drawBuildingInterior(buildingId) {
  if (!townBgLoaded) return false;
  let src;
  if (buildingId === 'building1') src = TOWN_IMG.interior1;
  else if (buildingId === 'building2') src = TOWN_IMG.interior2;
  else if (buildingId === 'building3') src = TOWN_IMG.interior3;
  else return false;
  
  // Interior panels are 512x512 (1:1), preserve that ratio
  const imgAspect = src.sw / src.sh; // 1.0
  const canvasAspect = canvas.width / canvas.height;
  let dw, dh, dx, dy;
  if (canvasAspect < imgAspect) {
    dh = canvas.height;
    dw = canvas.height * imgAspect;
    dx = (canvas.width - dw) / 2;
    dy = 0;
  } else {
    dw = canvas.width;
    dh = canvas.width / imgAspect;
    dx = 0;
    dy = (canvas.height - dh) / 2;
  }
  
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(townBackground, src.sx, src.sy, src.sw, src.sh, dx, dy, dw, dh);
  
  // Draw exit prompt at bottom center
  const p = getActivePlayer();
  if (p.y > canvas.height - 60) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press E to exit', canvas.width / 2, canvas.height - 20);
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('Press E to exit', canvas.width / 2 - 1, canvas.height - 21);
  }
  return true;
}

// Track which building the player is inside (null = outside)
let insideBuilding = null;

// Enter a building
function enterBuilding(buildingId) {
  insideBuilding = buildingId;
  const p = getActivePlayer();
  p.x = canvas.width / 2;
  p.y = canvas.height / 2;
  const label = BUILDING_ENTRANCES.find(b => b.id === buildingId)?.label || 'Building';
  if (typeof showDialogue === 'function') showDialogue('Entered ' + label);
  // Update NPCs for interior
  npcs = getInteriorNPCs(buildingId);
  enemies.length = 0; // No enemies inside
  console.log('[RPG] Entered ' + buildingId);
}

// Exit building back to village
function exitBuilding() {
  const buildingData = BUILDING_ENTRANCES.find(b => b.id === insideBuilding);
  insideBuilding = null;
  const p = getActivePlayer();
  if (buildingData) {
    // Place player just below the building entrance
    const { x: bx, y: by } = villageToCanvas(buildingData.xPct, buildingData.yPct);
    const { w: bw } = villageSizeToCanvas(buildingData.wPct, buildingData.hPct);
    p.x = bx + bw / 2;
    p.y = by + 40;
  } else {
    p.x = canvas.width / 2;
    p.y = canvas.height / 2;
  }
  // Restore village NPCs/enemies
  npcs = getAreaNPCs('village');
  spawnAreaEnemies('village');
  if (typeof showDialogue === 'function') showDialogue('Returned to Village');
  console.log('[RPG] Exited building');
}

// NPCs inside buildings
function getInteriorNPCs(buildingId) {
  if (buildingId === 'building1') {
    return [{
      x: canvas.width / 2, y: canvas.height * 0.35,
      name: 'Villager', hp: 8, maxHp: 8,
      equipment: { weapon: null, armor: null },
      dialogue: ['Welcome to my home!', 'Make yourself comfortable.']
    }];
  } else if (buildingId === 'building2') {
    return [{
      x: canvas.width / 2, y: canvas.height * 0.35,
      name: 'Shopkeeper', hp: 10, maxHp: 10,
      equipment: { weapon: 'wooden_staff', armor: 'leather_armor' },
      dialogue: ['Looking to buy or sell?', 'I have the finest wares!']
    }];
  } else if (buildingId === 'building3') {
    return [{
      x: canvas.width * 0.4, y: canvas.height * 0.35,
      name: 'Barkeeper', hp: 12, maxHp: 12,
      equipment: { weapon: null, armor: null },
      dialogue: ['Have a drink, adventurer!', 'Heard any rumors lately?']
    }, {
      x: canvas.width * 0.65, y: canvas.height * 0.5,
      name: 'Traveler', hp: 8, maxHp: 8,
      equipment: { weapon: 'iron_sword', armor: null },
      dialogue: ['The mountains are dangerous...', 'I barely escaped with my life!']
    }];
  }
  return [];
}

// --- Sprite System ---
const spriteSheet = new Image();
spriteSheet.src = 'character_spritesheet.png';
let spriteLoaded = false;
spriteSheet.onload = () => {
  spriteLoaded = true;
  console.log('[RPG] Spritesheet loaded successfully');
};
spriteSheet.onerror = () => {
  console.warn('[RPG] Spritesheet failed to load, using fallback rendering');
};

// NPC Spritesheets
const villagerSpriteSheet = new Image();
villagerSpriteSheet.src = 'town_villager_spritesheet.png';
let villagerSpriteLoaded = false;
villagerSpriteSheet.onload = () => {
  villagerSpriteLoaded = true;
  console.log('[RPG] Villager spritesheet loaded successfully');
};

const lizardSpriteSheet = new Image();
lizardSpriteSheet.src = 'cave_lizard_spritesheet.png';
let lizardSpriteLoaded = false;
lizardSpriteSheet.onload = () => {
  lizardSpriteLoaded = true;
  console.log('[RPG] Lizard spritesheet loaded successfully');
};

// Enemy Spritesheets
const goblinSpriteSheet = new Image();
goblinSpriteSheet.src = 'goblin_spritesheet.png';
let goblinSpriteLoaded = false;
goblinSpriteSheet.onload = () => {
  goblinSpriteLoaded = true;
  console.log('[RPG] Goblin spritesheet loaded successfully');
};

const orcSpriteSheet = new Image();
orcSpriteSheet.src = 'orc_spritesheet.png';
let orcSpriteLoaded = false;
orcSpriteSheet.onload = () => {
  orcSpriteLoaded = true;
  console.log('[RPG] Orc spritesheet loaded successfully');
};

const trollSpriteSheet = new Image();
trollSpriteSheet.src = 'troll_spritesheet.png';
let trollSpriteLoaded = false;
trollSpriteSheet.onload = () => {
  trollSpriteLoaded = true;
  console.log('[RPG] Troll spritesheet loaded successfully');
};

const ENEMY_SPRITE_CONFIG = {
  frameWidth: 64,
  frameHeight: 64,
  rowSpacing: 64,
  walkRows: { up: 38, left: 39, down: 40, right: 41 },
  attackRows: { up: 50, left: 51, down: 52, right: 53 },
  walkFrames: 8,
  attackFrames: 6,
  walkSpeed: 8,
  attackSpeed: 10
};

// Sprite configuration
const SPRITE_CONFIG = {
  frameWidth: 128,  // All sprites now 128x128
  frameHeight: 128,
  animations: {
    // Directional walks (128x128 frames) - rows spaced by 2
    walkUp: { row: 54, frames: 9, speed: 8 },
    walkLeft: { row: 56, frames: 9, speed: 8 },
    walkDown: { row: 58, frames: 9, speed: 8 },
    walkRight: { row: 60, frames: 9, speed: 8 },
    // Idle animations (use first few frames of walk)
    idleUp: { row: 54, frames: 2, speed: 10 },
    idleLeft: { row: 56, frames: 2, speed: 10 },
    idleDown: { row: 58, frames: 2, speed: 10 },
    idleRight: { row: 60, frames: 2, speed: 10 },
    // Slash/attack animations (directional) - faster speed
    slashUp: { row: 62, frames: 6, speed: 3 },
    slashLeft: { row: 64, frames: 6, speed: 3 },
    slashDown: { row: 66, frames: 6, speed: 3 },
    slashRight: { row: 68, frames: 6, speed: 3 },
    // Spellcast animations (directional) - 64x64 frames
    spellcastUp: { row: 12, frames: 6, speed: 6, frameWidth: 64, frameHeight: 64 },
    spellcastLeft: { row: 13, frames: 6, speed: 6, frameWidth: 64, frameHeight: 64 },
    spellcastDown: { row: 14, frames: 6, speed: 6, frameWidth: 64, frameHeight: 64 },
    spellcastRight: { row: 15, frames: 6, speed: 6, frameWidth: 64, frameHeight: 64 },
    // Other animations
    hurt: { row: 7, frames: 4, speed: 4 }
  }
};

// --- Audio System ---
let audioEnabled = true;
let audioContext = null;

function initAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioEnabled = false;
    }
  }
}

function playSound(type = 'hit', volume = 0.5) {
  if (!audioEnabled) return;
  try {
    initAudioContext();
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different sounds for different actions
    if (type === 'hit') {
      oscillator.frequency.value = 200;
      oscillator.type = 'square';
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } else if (type === 'pickup') {
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    }
  } catch (e) {
    // Silently fail if audio not supported
  }
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  if (typeof closeSettings === 'function') closeSettings();
  if (typeof openSettings === 'function') openSettings();
}

// --- Utility: Get Active Player (single or party) ---
function getActivePlayer() {
  if (typeof party !== 'undefined' && Array.isArray(party) && typeof activePartyIndex === 'number' && party[activePartyIndex]) {
    return party[activePartyIndex];
  }
  return player;
}

// --- Update Info Bar (calls updateStatBar) ---
function updateInfoBar() {
  updateStatBar();
  
  // Update XP and coins if elements exist
  const p = getActivePlayer();
  const xpEl = document.getElementById('xpXpValue') || document.getElementById('xpValue');
  const coinEl = document.getElementById('coinValue');
  const levelEl = document.getElementById('levelValue');
  
  if (xpEl && typeof p.xp === 'number') {
    const xpToLevel = Math.max(1, (p.level || 1) * 10);
    xpEl.textContent = `${p.xp} / ${xpToLevel}`;
  }
  if (coinEl && typeof p.coins === 'number') {
    coinEl.textContent = p.coins;
  }
  if (levelEl && typeof p.level === 'number') {
    levelEl.textContent = p.level;
  }
}

// Update HP bar and value only when valid stats are present
function updateStatBar() {
  const p = getActivePlayer();
  const hpValue = document.getElementById('hpValue');
  if (typeof p.hp === 'number' && typeof p.maxHp === 'number' && p.maxHp > 0) {
    const percent = Math.max(0, Math.min(1, p.hp / p.maxHp));
    let color;
    if (percent > 0.5) {
      // Green to Yellow
      const g = Math.floor(255 * percent);
      const r = Math.floor(255 * (1 - percent) * 2);
      color = `rgb(${r},${g},0)`;
    } else {
      // Yellow to Red
      const r = 255;
      const g = Math.floor(255 * percent * 2);
      color = `rgb(${r},${g},0)`;
    }
    hpValue.style.color = color;
    hpValue.textContent = `${p.hp} / ${p.maxHp}`;
  } else {
    hpValue.style.color = 'rgb(0,255,0)';
    hpValue.textContent = '0 / 0';
  }
  // Remove HP bar overlay if present
  const overlay = document.getElementById('hpBarOverlay');
  if (overlay) overlay.remove();
}
function showInventoryPanel() {
  document.getElementById('inventorySlidePanel').classList.add('open');
  showInventoryTab('items');
}
function closeInventoryPanel() {
  document.getElementById('inventorySlidePanel').classList.remove('open');
}
function showInventoryTab(tab) {
  const tabs = document.querySelectorAll('.inventory-tab-vertical');
  tabs.forEach(btn => btn.classList.remove('active'));
  if (tab === 'items') tabs[0].classList.add('active');
  if (tab === 'equipment') tabs[1].classList.add('active');
  if (tab === 'abilities') tabs[2].classList.add('active');
  if (tab === 'quests') tabs[3].classList.add('active');
  const content = document.getElementById('inventoryTabContent');
  if (tab === 'items') {
    content.innerHTML = renderItemsTab();
  } else if (tab === 'equipment') {
    content.innerHTML = renderEquipmentTab();
  } else if (tab === 'abilities') {
    content.innerHTML = renderAbilitiesTab();
  } else if (tab === 'quests') {
    content.innerHTML = renderQuestsTab();
  }
  // Character preview with equipment and level
  const preview = document.getElementById('characterPreview');
  const p = getActivePlayer();
  let previewHtml = '';
  // Simple equipment-based preview (can be replaced with SVG or sprite logic)
  let weapon = p.equipment?.weapon || '';
  let armor = p.equipment?.armor || '';
  let shield = p.equipment?.shield || '';
  previewHtml += `<div style="font-size:2.5em;">${weapon ? '🗡️' : ''}${shield ? '🛡️' : ''}${armor ? '🦺' : '👕'}</div>`;
  previewHtml += `<div style="margin-top:8px;font-size:1.1em;color:#ffd700;">${p.name || 'Hero'}</div>`;
  previewHtml += `<div class="character-level">Lv ${p.level || 1}</div>`;
  preview.innerHTML = previewHtml;
  updateStatBar();
  animateTextChange('xpXpValue', typeof p.xp === 'number' ? p.xp : 0);
  animateTextChange('xpValue', typeof p.gems === 'number' ? p.gems : 0);
  animateTextChange('coinValue', typeof p.coins === 'number' ? p.coins : 0);
}

// Animate stat bar fill (width)
function animateStatChange(elementId, targetPercent, maxWidth, styleProp) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const target = Math.round(targetPercent * maxWidth);
  // Always set width to maxWidth on init and when HP is full
  if (targetPercent >= 0.99 || el.style[styleProp] === '') {
    el.style[styleProp] = maxWidth + 'px';
    return;
  }
  let current = parseFloat(el.style[styleProp]);
  if (isNaN(current)) current = maxWidth;
  if (Math.abs(current - target) < 1) {
    el.style[styleProp] = target + 'px';
    return;
  }
  let start = current;
  let startTime = null;
  function step(ts) {
    if (!startTime) startTime = ts;
    const progress = Math.min(1, (ts - startTime) / 250);
    const value = start + (target - start) * progress;
    el.style[styleProp] = value + 'px';
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.style[styleProp] = target + 'px';
    }
  }
  requestAnimationFrame(step);
}

// Animate stat number change (fade)
function animateTextChange(elementId, newValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (el.textContent == newValue) return;
  el.style.transition = 'opacity 0.18s';
  el.style.opacity = '0.3';
  setTimeout(() => {
    el.textContent = newValue;
    el.style.opacity = '1';
  }, 120);
}
function renderQuestsTab() {
  if (typeof QUESTS === 'undefined' || !Array.isArray(QUESTS) || QUESTS.length === 0) {
    return '<div>No active quests.</div>';
  }
  let html = '<div><b>Active Quests:</b></div><ul>';
  QUESTS.forEach(q => {
    html += `<li><b>${q.title}</b>: <span>${q.desc}</span>${q.completed ? ' <span style="color:#4af;">(Completed)</span>' : ''}</li>`;
  });
  html += '</ul>';
  return html;
}
function renderItemsTab() {
  const p = getActivePlayer();
  if (!p.inventory || p.inventory.length === 0) return '<div>Your inventory is empty.</div>';
  return '<ul>' + p.inventory.map(id => {
    const item = ITEMS.find(i => i.id === id || i.name === id);
    if (!item) return '<li>Unknown</li>';
    return `<li><span style='color:${getItemRarity(item).color}'>${item.name}</span> (${item.type || 'item'})</li>`;
  }).join('') + '</ul>';
}
function renderEquipmentTab() {
  const p = getActivePlayer();
  const eq = p.equipment || {};
  let html = '<div><b>Equipped Items:</b></div><ul>';
  ['weapon','armor','shield'].forEach(type => {
    const itemId = eq[type];
    if (!itemId) {
      html += `<li>${type.charAt(0).toUpperCase()+type.slice(1)}: <span style='color:#888'>None</span></li>`;
    } else {
      const item = ITEMS.find(i => i.id === itemId || i.name === itemId);
      html += `<li>${type.charAt(0).toUpperCase()+type.slice(1)}: <span style='color:${getItemRarity(item).color}'>${item.name}</span></li>`;
    }
  });
  html += '</ul>';
  return html;
}
function renderAbilitiesTab() {
  let html = '<div><b>Abilities:</b></div><ul>';
  if (typeof SKILLS !== 'undefined') {
    SKILLS.forEach(skill => {
      html += `<li><span style='color:${skill.unlocked ? '#4af' : '#888'}'>${skill.name}</span> - ${skill.desc}</li>`;
    });
  } else {
    html += '<li>No abilities unlocked.</li>';
  }
  html += '</ul>';
  return html;
}
document.getElementById('openInventoryBtn').onclick = showInventoryPanel;
// --- Enemy Data ---
const enemies = [
  { x: 320, y: 120, hp: 10, alive: true },
  { x: 180, y: 200, hp: 12, alive: true }
];

// Default empty gameLoop so the patch can wrap it
function gameLoop() {
  // Clear canvas
  ctx.fillStyle = AREA_CONFIG[currentArea].color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Update game state
  if (!paused) {
    updatePlayerMovement();
    updateEnemiesAI();
    updateSpellProjectiles();
    updateAnimationFrame();
  }
  
  // Draw game world
  drawMap();
  drawAreaDecorations();
  drawLoot();
  drawNPCs();
  drawPlayer();
  drawEnemies();
  drawSpellProjectiles();
  drawParticles();
  drawEffects();
  drawDamageNumbers();
  drawTransitionZones();
  drawAreaLabel();
  drawMinimap();
  
  // Update and display UI
  updateInfoBar();
}

// Player, Map, NPC, Inventory, Quest, and UI logic skeleton

// --- Global UI State Flags ---
let settingsOpen = false;
let shopOpen = false;
let paused = false;
window.gameStarted = false;

// --- Area/Screen System ---
let currentArea = 'village';
const AREA_WIDTH = 800;
const AREA_HEIGHT = 600;
const TRANSITION_SIZE = 40; // pixels from edge

// Game reset function - called when starting new game
function resetGameState() {
  // Spawn player on the path between buildings (image-relative coords)
  if (typeof villageToCanvas === 'function' && canvas.width > 0) {
    const spawn = villageToCanvas(0.30, 0.78);
    player.x = spawn.x;
    player.y = spawn.y;
  } else {
    player.x = (canvas.width || AREA_WIDTH) / 2;
    player.y = (canvas.height || AREA_HEIGHT) * 0.80;
  }
  player.hp = player.maxHp;
  currentArea = 'village';
  if (typeof npcs !== 'undefined') {
    npcs = getAreaNPCs(currentArea);
  }
  if (typeof spawnAreaEnemies === 'function') {
    spawnAreaEnemies(currentArea);
  }
  if (typeof keys !== 'undefined') {
    Object.keys(keys).forEach(k => keys[k] = false);
  }
  console.log(`[RPG] Game state reset - area: village, player: (${Math.round(player.x)}, ${Math.round(player.y)})`);
}

const AREA_CONFIG = {
  village: {
    name: 'Village',
    color: '#1a3a1a',
    transitions: { right: 'forest', down: 'cave' },
    description: 'A peaceful village settlement'
  },
  forest: {
    name: 'Dark Forest',
    color: '#0a2a0a',
    transitions: { left: 'village', down: 'mountains' },
    description: 'Dense trees and dangerous creatures'
  },
  cave: {
    name: 'Crystal Cave',
    color: '#1a1a2a',
    transitions: { up: 'village', right: 'mountains' },
    description: 'Sparkles of crystal light flicker in darkness'
  },
  mountains: {
    name: 'Mountain Peak',
    color: '#2a2a1a',
    transitions: { left: 'forest', up: 'cave' },
    description: 'Snowy peaks pierce the sky'
  }
};

function getAreaEnemies(area) {
  const baseEnemies = {
    village: [],
    forest: ['orc', 'orc', 'troll', 'orc'],
    cave: ['troll', 'troll', 'orc'],
    mountains: ['troll', 'troll', 'troll', 'orc']
  };
  return baseEnemies[area] || ['goblin'];
}

function getAreaNPCs(area) {
  const baseNPCs = {
    village: [{
      x: 150, y: 120, name: 'Merchant', hp: 8, maxHp: 8,
      equipment: { weapon: 'wooden_staff', armor: 'leather_armor' },
      dialogue: ["Welcome to the village!", "Explore the world if you dare!"]
    }],
    forest: [],
    cave: [{
      x: 200, y: 150, name: 'Hermit', hp: 6, maxHp: 6,
      equipment: { weapon: 'staff', armor: 'leather_armor' },
      dialogue: ["Why have you come to my cave?", "The mountains hold great secrets..."]
    }],
    mountains: []
  };
  return baseNPCs[area] || [];
}

function resizeCanvas() {
  // Get actual display size from canvas element
  const rect = canvas.getBoundingClientRect();
  const displayWidth = rect.width;
  const displayHeight = rect.height;
  
  // Set internal resolution to match display size for crisp rendering
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    console.log('[RPG] Canvas resized to', canvas.width, 'x', canvas.height);
  }
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', resizeCanvas);

// --- Add Pause Functionality ---
function togglePause() {
    paused = !paused;
    document.getElementById('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
    document.getElementById('pauseOverlay').style.display = paused ? 'flex' : 'none';
}

// --- Customizable Player/Party Appearance ---
const DEFAULT_COLORS = ['#4af', '#fa4', '#3f3', '#fff', '#e33'];
if (typeof party !== 'undefined') {
  party.forEach((member, i) => {
    member.color = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
  });
}

function setPartyColor(index, color) {
  if (party && party[index]) {
    party[index].color = color;
    if (typeof updateInfoBar === 'function') updateInfoBar();
  }
}

// --- Animation System ---
let animationFrame = 0;

function updateAnimationFrame() {
  animationFrame = (animationFrame + 1) % 60; // Cycle every 60 frames
}

function getWalkBob() {
  return Math.sin(animationFrame * 0.1) * 2; // Subtle bouncing motion
}

function getIdleWave() {
  return Math.sin(animationFrame * 0.05) * 3; // Slower idle sway
}

function getAttackStretch(player) {
  if (!player.lastAttackTime) return 1;
  const timeSinceAttack = Date.now() - player.lastAttackTime;
  if (timeSinceAttack > 200) return 1;
  const progress = timeSinceAttack / 200;
  return 1 + Math.sin(progress * Math.PI) * 0.15; // Quick stretch and return
}

function getWeaponSwingAngle(player) {
  if (!player.attackStartTime) return 0;
  const attackDuration = 300; // Total attack animation duration (ms) - matches 6 frames at speed 3
  const timeSinceAttack = Date.now() - player.attackStartTime;
  
  if (timeSinceAttack > attackDuration) {
    player.isAttacking = false;
    return 0;
  }
  
  // Swing from -90 degrees to +90 degrees
  const progress = timeSinceAttack / attackDuration;
  const angle = Math.sin(progress * Math.PI) * 90; // 0 to 90 to 0 degrees
  return angle;
}

// --- Sprite Animation Helper ---
function getSpriteFrame(animType, isMoving, isAttacking, isCasting, direction = 'down', player = null) {
  if (!spriteLoaded) return null;
  
  // Determine which animation to use
  let anim = SPRITE_CONFIG.animations.idleDown;  // Default to down-facing idle
  let frameIndex = 0;
  
  if (isAttacking) {
    // Use directional slash animation - play once based on attack time
    if (direction === 'up') {
      anim = SPRITE_CONFIG.animations.slashUp;
    } else if (direction === 'down') {
      anim = SPRITE_CONFIG.animations.slashDown;
    } else if (direction === 'left') {
      anim = SPRITE_CONFIG.animations.slashLeft;
    } else if (direction === 'right') {
      anim = SPRITE_CONFIG.animations.slashRight;
    }
    
    // Calculate frame based on attack progress (not continuous animation)
    if (player && player.attackStartTime) {
      const timeSinceAttack = Date.now() - player.attackStartTime;
      const attackDuration = 300;
      
      // If attack is over, reset to idle
      if (timeSinceAttack >= attackDuration) {
        player.isAttacking = false;
        // Return idle animation instead
        if (direction === 'up') {
          anim = SPRITE_CONFIG.animations.idleUp;
        } else if (direction === 'down') {
          anim = SPRITE_CONFIG.animations.idleDown;
        } else if (direction === 'left') {
          anim = SPRITE_CONFIG.animations.idleLeft;
        } else if (direction === 'right') {
          anim = SPRITE_CONFIG.animations.idleRight;
        }
        frameIndex = 0;
      } else {
        const progress = Math.min(timeSinceAttack / attackDuration, 1);
        frameIndex = Math.floor(progress * anim.frames);
        if (frameIndex >= anim.frames) frameIndex = anim.frames - 1;
      }
    }
  } else if (isCasting) {
    // Use directional spellcast animation
    if (direction === 'up') {
      anim = SPRITE_CONFIG.animations.spellcastUp;
    } else if (direction === 'down') {
      anim = SPRITE_CONFIG.animations.spellcastDown;
    } else if (direction === 'left') {
      anim = SPRITE_CONFIG.animations.spellcastLeft;
    } else if (direction === 'right') {
      anim = SPRITE_CONFIG.animations.spellcastRight;
    }
    frameIndex = Math.floor(animationFrame / anim.speed) % anim.frames;
  } else if (isMoving) {
    // Use directional walk animation
    if (direction === 'up') {
      anim = SPRITE_CONFIG.animations.walkUp;
    } else if (direction === 'down') {
      anim = SPRITE_CONFIG.animations.walkDown;
    } else if (direction === 'left') {
      anim = SPRITE_CONFIG.animations.walkLeft;
    } else if (direction === 'right') {
      anim = SPRITE_CONFIG.animations.walkRight;
    }
    frameIndex = Math.floor(animationFrame / anim.speed) % anim.frames;
  } else {
    // Idle - face the last direction the player was moving (static, no animation)
    if (direction === 'up') {
      anim = SPRITE_CONFIG.animations.idleUp;
    } else if (direction === 'down') {
      anim = SPRITE_CONFIG.animations.idleDown;
    } else if (direction === 'left') {
      anim = SPRITE_CONFIG.animations.idleLeft;
    } else if (direction === 'right') {
      anim = SPRITE_CONFIG.animations.idleRight;
    }
    frameIndex = 0;  // Always use first frame for idle (static)
  }
  
  // Use animation-specific frame size if available (for 64px spellcast), otherwise use default 128px
  const frameWidth = anim.frameWidth || SPRITE_CONFIG.frameWidth;
  const frameHeight = anim.frameHeight || SPRITE_CONFIG.frameHeight;
  
  return {
    x: frameIndex * frameWidth,
    y: anim.row * 64,  // Row numbers based on 64px spacing
    width: frameWidth,
    height: frameHeight
  };
}

function getEnemySpriteSource(enemyType) {
  if (enemyType === 'goblin' && goblinSpriteLoaded) return goblinSpriteSheet;
  if (enemyType === 'orc' && orcSpriteLoaded) return orcSpriteSheet;
  if (enemyType === 'troll' && trollSpriteLoaded) return trollSpriteSheet;
  return null;
}

function getEnemySpriteFrame(direction = 'down', isAttacking = false, isMoving = false) {
  const dir = ENEMY_SPRITE_CONFIG.walkRows[direction] ? direction : 'down';
  const row = isAttacking
    ? ENEMY_SPRITE_CONFIG.attackRows[dir]
    : ENEMY_SPRITE_CONFIG.walkRows[dir];
  const frames = isAttacking ? ENEMY_SPRITE_CONFIG.attackFrames : ENEMY_SPRITE_CONFIG.walkFrames;
  const speed = isAttacking ? ENEMY_SPRITE_CONFIG.attackSpeed : ENEMY_SPRITE_CONFIG.walkSpeed;
  // Use frame 0 for idle (not moving and not attacking), animate only when moving or attacking
  const frameIndex = (isMoving || isAttacking) ? Math.floor(animationFrame / speed) % frames : 0;

  return {
    x: frameIndex * ENEMY_SPRITE_CONFIG.frameWidth,
    y: row * ENEMY_SPRITE_CONFIG.rowSpacing,
    width: ENEMY_SPRITE_CONFIG.frameWidth,
    height: ENEMY_SPRITE_CONFIG.frameHeight
  };
}

// --- Equipment Overlays (for sprite mode) ---
function drawEquipmentOverlays(x, y, size, hasEquipment, isMoving, isAttacking, animState) {
  // Draw weapon and shield as overlays on the sprite
  const weaponSwing = isMoving ? Math.sin(animationFrame * 0.15) * 0.15 : 0;
  
  // Draw weapon
  if (hasEquipment.weapon) {
    const weaponItemId = hasEquipment.weapon;
    const item = ITEMS && ITEMS.find(i => i.id === weaponItemId || i.name === weaponItemId);
    const rarity = item ? getItemRarity(item) : { color: '#c0c000' };
    const weaponName = item ? item.name.toLowerCase() : '';
    
    const weaponX = x + size * 0.6 + weaponSwing * size * 0.5;
    const weaponY = y - size * 0.1;
    
    // Get attack swing angle
    const swingAngle = animState.player ? getWeaponSwingAngle(animState.player) : 0;
    
    ctx.save();
    // Apply rotation for attack swing
    if (swingAngle !== 0) {
      ctx.translate(weaponX, weaponY);
      ctx.rotate((swingAngle * Math.PI) / 180);
      ctx.translate(-weaponX, -weaponY);
    }
    
    // Apply rarity glow
    if (rarity.glow) {
      ctx.shadowColor = rarity.color;
      ctx.shadowBlur = rarity.glow;
    }
    
    ctx.strokeStyle = rarity.color;
    ctx.fillStyle = rarity.color;
    ctx.lineWidth = 3;
    
    // Draw weapon based on type
    if (weaponName.includes('axe')) {
      // Axe blade
      ctx.beginPath();
      ctx.arc(weaponX, weaponY - size * 0.4, size * 0.25, 0, Math.PI);
      ctx.fill();
      // Handle
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(weaponX - size * 0.05, weaponY - size * 0.4, size * 0.1, size * 0.7);
    } else if (weaponName.includes('spear')) {
      // Spear shaft
      ctx.strokeStyle = '#8b4513';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(weaponX, weaponY - size * 0.5);
      ctx.lineTo(weaponX, weaponY + size * 0.3);
      ctx.stroke();
      // Spear tip
      ctx.fillStyle = rarity.color;
      ctx.beginPath();
      ctx.moveTo(weaponX, weaponY - size * 0.7);
      ctx.lineTo(weaponX - size * 0.15, weaponY - size * 0.4);
      ctx.lineTo(weaponX + size * 0.15, weaponY - size * 0.4);
      ctx.closePath();
      ctx.fill();
    } else if (weaponName.includes('staff')) {
      // Staff shaft
      ctx.strokeStyle = '#8b4513';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(weaponX, weaponY - size * 0.6);
      ctx.lineTo(weaponX, weaponY + size * 0.4);
      ctx.stroke();
      // Orb at top
      const orbColor = rarity.color;
      ctx.fillStyle = orbColor;
      ctx.shadowColor = orbColor;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(weaponX, weaponY - size * 0.7, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Default sword
      ctx.beginPath();
      ctx.moveTo(weaponX, weaponY - size * 0.6);
      ctx.lineTo(weaponX, weaponY + size * 0.2);
      ctx.stroke();
      // Crossguard
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(weaponX - size * 0.2, weaponY - size * 0.1);
      ctx.lineTo(weaponX + size * 0.2, weaponY - size * 0.1);
      ctx.stroke();
      // Sword tip
      ctx.fillStyle = rarity.color;
      ctx.beginPath();
      ctx.moveTo(weaponX, weaponY - size * 0.7);
      ctx.lineTo(weaponX - size * 0.05, weaponY - size * 0.6);
      ctx.lineTo(weaponX + size * 0.05, weaponY - size * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  }
  
  // Draw shield
  if (hasEquipment.shield) {
    const shieldItemId = hasEquipment.shield;
    const item = ITEMS && ITEMS.find(i => i.id === shieldItemId || i.name === shieldItemId);
    const rarity = item ? getItemRarity(item) : { color: '#8b4513' };
    
    const shieldX = x - size * 0.5;
    const shieldY = y + size * 0.1;
    
    ctx.save();
    if (rarity.glow) {
      ctx.shadowColor = rarity.color;
      ctx.shadowBlur = rarity.glow;
    }
    
    ctx.fillStyle = rarity.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    
    // Shield shape
    ctx.beginPath();
    ctx.roundRect(shieldX - size * 0.2, shieldY, size * 0.4, size * 0.5, size * 0.1);
    ctx.fill();
    ctx.stroke();
    
    // Shield emblem
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(shieldX, shieldY + size * 0.25, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

// --- Draw Character Sprite ---
function drawCharacter(x, y, type = 'hero', color = '#4af', hasEquipment = {}, animState = {}, sizeScale = 1) {
  let size = Math.max(12, canvas.width * 0.02);
  size *= sizeScale; // Apply size scaling for enemy types
  
  // Apply animation offset
  let animY = y;
  let animX = x;
  let bodyScale = 1;
  
  if (type === 'hero' || type === 'player') {
    // Determine if moving
    const isMoving = animState.isMoving || false;
    const attack = animState.attackStretch || 1;
    const isAttacking = animState.isAttacking || false;
    const isCasting = animState.isCasting || false;
    const direction = animState.direction || 'down';
    
    // Try to use spritesheet if loaded
    const spriteFrame = getSpriteFrame('player', isMoving, isAttacking, isCasting, direction, animState.player);
    
    if (spriteFrame && spriteLoaded) {
      // Draw sprite character
      // Scale based on frame size: 4x for 128px frames, 2x for 64px frames
      const spriteScale = spriteFrame.width === 64 ? 2 : 4;
      const spriteSize = size * spriteScale;
      ctx.save();
      
      // Add subtle bob/wave animation
      if (isMoving) {
        animY += getWalkBob();
      } else {
        animY += getIdleWave() * 0.5;
      }
      
      // Draw the sprite frame
      ctx.drawImage(
        spriteSheet,
        spriteFrame.x, spriteFrame.y,
        spriteFrame.width, spriteFrame.height,
        animX - spriteSize / 2, animY - spriteSize / 1.3,
        spriteSize, spriteSize
      );
      
      ctx.restore();
      
      // Equipment is already in the sprite, no overlays needed
      
      return; // Exit early, sprite rendered
    }
    
    // Fallback: Draw using shapes (original code)
    if (isMoving) {
      animY += getWalkBob();
    } else {
      animY += getIdleWave() * 0.5;
    }
    
    bodyScale = attack;
    
    if (isMoving) {
      animY += getWalkBob();
    } else {
      animY += getIdleWave() * 0.5;
    }
    
    bodyScale = attack;
    
    ctx.save();
    ctx.translate(animX, animY);
    ctx.scale(1, bodyScale);
    ctx.translate(-animX, -animY);
    
    ctx.fillStyle = color;
    // Head
    ctx.beginPath();
    ctx.arc(animX, animY - size * 0.8, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillRect(animX - size * 0.4, animY - size * 0.1, size * 0.8, size * 0.8);
    // Arms with swing
    const armSwing = isMoving ? Math.sin(animationFrame * 0.15) * 0.2 : 0;
    ctx.fillRect(animX - size * 0.8 + armSwing * size, animY, size * 0.35, size * 0.4);
    ctx.fillRect(animX + size * 0.45 - armSwing * size, animY, size * 0.35, size * 0.4);
    // Legs with walking animation
    const legSwing1 = isMoving ? Math.sin(animationFrame * 0.15) * 0.15 : 0;
    const legSwing2 = isMoving ? Math.sin(animationFrame * 0.15 + Math.PI) * 0.15 : 0;
    ctx.fillRect(animX - size * 0.3 + legSwing1 * size, animY + size * 0.7, size * 0.25, size * 0.6);
    ctx.fillRect(animX + size * 0.05 + legSwing2 * size, animY + size * 0.7, size * 0.25, size * 0.6);
    
    // Draw equipment - armor/chest
    if (hasEquipment.armor) {
      ctx.fillStyle = '#555';
      ctx.fillRect(animX - size * 0.42, animY - size * 0.05, size * 0.84, size * 0.85);
      // Armor details
      ctx.strokeStyle = '#777';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(animX, animY - size * 0.05);
      ctx.lineTo(animX, animY + size * 0.8);
      ctx.stroke();
    }
    
    // Draw weapon - sword/axe/spear (right hand)
    if (hasEquipment.weapon) {
      const weaponItemId = hasEquipment.weapon;
      const item = ITEMS && ITEMS.find(i => i.id === weaponItemId || i.name === weaponItemId);
      const rarity = item ? getItemRarity(item) : { color: '#c0c000' };
      const weaponName = item ? item.name.toLowerCase() : '';
      
      // Weapon position swings with arm
      const weaponSwing = isMoving ? Math.sin(animationFrame * 0.15) * 0.15 : 0;
      const weaponX = animX + size * 0.5 + weaponSwing * size * 0.5;
      const weaponY = animY - size * 0.1;
      
      ctx.save();
      
      // Apply swing rotation during attack
      const swingAngle = getWeaponSwingAngle(animState.player || getActivePlayer());
      if (swingAngle !== 0) {
        ctx.translate(weaponX, weaponY);
        ctx.rotate((swingAngle * Math.PI) / 180);
        ctx.translate(-weaponX, -weaponY);
      }
      
      // Glow effect for rare and epic items
      if (rarity.rarity && (rarity.rarity === 'rare' || rarity.rarity === 'epic')) {
        ctx.shadowColor = rarity.color;
        ctx.shadowBlur = rarity.rarity === 'epic' ? 20 : 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      
      // Draw weapon based on type
      if (weaponName.includes('axe')) {
        // AXE: Wider blade with rounded top
        ctx.fillStyle = rarity.color;
        // Blade (wider)
        ctx.beginPath();
        ctx.moveTo(weaponX - size * 0.2, weaponY - size * 0.3);
        ctx.lineTo(weaponX + size * 0.2, weaponY - size * 0.3);
        ctx.quadraticCurveTo(weaponX + size * 0.25, weaponY - size * 0.5, weaponX, weaponY - size * 0.6);
        ctx.quadraticCurveTo(weaponX - size * 0.25, weaponY - size * 0.5, weaponX - size * 0.2, weaponY - size * 0.3);
        ctx.closePath();
        ctx.fill();
        // Axe handle
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(weaponX, weaponY - size * 0.3);
        ctx.lineTo(weaponX, weaponY + size * 0.4);
        ctx.stroke();
      } else if (weaponName.includes('spear')) {
        // SPEAR: Thin pointed blade
        ctx.strokeStyle = rarity.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(weaponX, weaponY - size * 0.5);
        ctx.lineTo(weaponX, weaponY + size * 0.4);
        ctx.stroke();
        // Spear tip (diamond shape)
        ctx.fillStyle = rarity.color;
        ctx.beginPath();
        ctx.moveTo(weaponX - size * 0.06, weaponY - size * 0.35);
        ctx.lineTo(weaponX, weaponY - size * 0.6);
        ctx.lineTo(weaponX + size * 0.06, weaponY - size * 0.35);
        ctx.lineTo(weaponX, weaponY - size * 0.45);
        ctx.closePath();
        ctx.fill();
      } else if (weaponName.includes('staff')) {
        // STAFF: Wooden staff with glowing orb
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(weaponX, weaponY - size * 0.5);
        ctx.lineTo(weaponX, weaponY + size * 0.5);
        ctx.stroke();
        // Staff orb
        ctx.fillStyle = rarity.color;
        ctx.beginPath();
        ctx.arc(weaponX, weaponY - size * 0.65, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        // Orb glow
        ctx.strokeStyle = rarity.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(weaponX, weaponY - size * 0.65, size * 0.2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // DEFAULT SWORD: Thin blade with pointed tip
        ctx.strokeStyle = rarity.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(weaponX, weaponY - size * 0.4);
        ctx.lineTo(weaponX, weaponY + size * 0.4);
        ctx.stroke();
        // Sword crossguard
        ctx.fillStyle = '#c0c000';
        ctx.fillRect(weaponX - size * 0.15, weaponY - size * 0.05, size * 0.3, size * 0.1);
        // Sword tip
        ctx.fillStyle = rarity.color;
        ctx.beginPath();
        ctx.moveTo(weaponX - size * 0.08, weaponY - size * 0.45);
        ctx.lineTo(weaponX, weaponY - size * 0.6);
        ctx.lineTo(weaponX + size * 0.08, weaponY - size * 0.45);
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.restore();
    }
    
    // Draw shield - left hand
    if (hasEquipment.shield) {
      const shieldItemId = hasEquipment.shield;
      const item = ITEMS && ITEMS.find(i => i.id === shieldItemId || i.name === shieldItemId);
      const rarity = item ? getItemRarity(item) : { color: '#888' };
      
      const shieldX = animX - size * 0.85;
      const shieldY = animY + size * 0.15;
      
      ctx.save();
      
      // Glow effect for rare and epic items
      if (rarity.rarity && (rarity.rarity === 'rare' || rarity.rarity === 'epic')) {
        ctx.shadowColor = rarity.color;
        ctx.shadowBlur = rarity.rarity === 'epic' ? 20 : 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      
      // Shield shape (rounded rectangle)
      ctx.fillStyle = rarity.color;
      ctx.beginPath();
      ctx.moveTo(shieldX - size * 0.2, shieldY - size * 0.35);
      ctx.lineTo(shieldX + size * 0.15, shieldY - size * 0.35);
      ctx.quadraticCurveTo(shieldX + size * 0.25, shieldY, shieldX + size * 0.15, shieldY + size * 0.35);
      ctx.lineTo(shieldX - size * 0.2, shieldY + size * 0.35);
      ctx.quadraticCurveTo(shieldX - size * 0.3, shieldY, shieldX - size * 0.2, shieldY - size * 0.35);
      ctx.closePath();
      ctx.fill();
      
      // Shield rim
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Shield emblem (center circle)
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(shieldX, shieldY, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    ctx.restore();
  } else if (type === 'enemy') {
    // Enemy animation
    const isAttacking = animState.isAttacking || false;
    const bob = isAttacking ? 0 : getWalkBob();
    animY += bob;
    
    // Draw goblin-like enemy with animation
    ctx.fillStyle = color;
    // Head (pointy)
    ctx.beginPath();
    ctx.moveTo(animX, animY - size);
    ctx.lineTo(animX - size * 0.5, animY - size * 0.2);
    ctx.lineTo(animX + size * 0.5, animY - size * 0.2);
    ctx.closePath();
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.ellipse(animX, animY + size * 0.2, size * 0.5, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes (menacing, animated)
    const eyeGlow = Math.sin(animationFrame * 0.08) * 0.15 + 0.15;
    ctx.fillStyle = `rgba(255, 255, 255, ${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(animX - size * 0.15, animY - size * 0.5, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(animX + size * 0.15, animY - size * 0.5, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(animX - size * 0.15, animY - size * 0.5, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(animX + size * 0.15, animY - size * 0.5, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'npc') {
    // Draw NPC: robed figure with idle animation
    const sway = getIdleWave() * 0.3;
    animX += sway;
    
    ctx.fillStyle = color;
    // Head
    ctx.beginPath();
    ctx.arc(animX, animY - size * 0.7, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Robe (wider at bottom)
    ctx.beginPath();
    ctx.moveTo(animX - size * 0.5, animY - size * 0.2);
    ctx.lineTo(animX - size * 0.6, animY + size * 0.9);
    ctx.lineTo(animX + size * 0.6, animY + size * 0.9);
    ctx.lineTo(animX + size * 0.5, animY - size * 0.2);
    ctx.closePath();
    ctx.fill();
    // Hat/hood
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(animX - size * 0.6, animY - size * 0.7);
    ctx.lineTo(animX, animY - size * 1.2);
    ctx.lineTo(animX + size * 0.6, animY - size * 0.7);
    ctx.closePath();
    ctx.fill();
    
    // Add NPC-specific equipment (staff for mages, etc)
    if (hasEquipment.weapon) {
      ctx.strokeStyle = '#d4a574';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(animX + size * 0.4, animY - size * 0.5);
      ctx.lineTo(animX + size * 0.4, animY + size * 0.9);
      ctx.stroke();
      // Staff top ornament
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(animX + size * 0.4, animY - size * 0.5, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- Draw player/party with chosen color ---
function drawPlayer() {
  const p = getActivePlayer();
  const size = Math.max(12, canvas.width * 0.02);
  
  // Determine player direction based on keys
  let direction = p.lastDirection || 'down';
  if (keys['ArrowUp'] || keys['w']) direction = 'up';
  else if (keys['ArrowDown'] || keys['s']) direction = 'down';
  else if (keys['ArrowLeft'] || keys['a']) direction = 'left';
  else if (keys['ArrowRight'] || keys['d']) direction = 'right';
  
  // Store last direction for idle state
  if (keys['ArrowUp'] || keys['w'] || keys['ArrowDown'] || keys['s'] || 
      keys['ArrowLeft'] || keys['a'] || keys['ArrowRight'] || keys['d']) {
    p.lastDirection = direction;
  }
  
  // Check if player is moving
  const isMoving = keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] || 
                   keys['w'] || keys['s'] || keys['a'] || keys['d'];
  const animState = { 
    isMoving, 
    attackStretch: getAttackStretch(p), 
    isAttacking: p.isAttacking || false,
    isCasting: p.isCasting || false,
    direction: direction,
    player: p 
  };
  
  // If party system is present, draw all members
  if (typeof party !== 'undefined' && Array.isArray(party) && party.length > 0) {
    party.forEach((member, i) => {
      const memberDirection = member.lastDirection || 'down';
      const memberAnimState = { 
        isMoving, 
        attackStretch: getAttackStretch(member), 
        isAttacking: member.isAttacking || false,
        isCasting: member.isCasting || false,
        direction: memberDirection,
        player: member 
      };
      drawCharacter(member.x, member.y, 'hero', member.color || '#4af', member.equipment, memberAnimState);
      if (i === activePartyIndex) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(member.x, member.y, size * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  } else {
    // Single player
    drawCharacter(p.x, p.y, 'hero', p.clothingColor || '#4af', p.equipment, animState);
  }
}

// --- Draw NPCs ---
function drawNPCs() {
  npcs.forEach(npc => {
    // Determine which sprite to use based on NPC name
    let npcSprite = null;
    let npcSpriteLoaded = false;
    
    if (npc.name === 'Merchant') {
      npcSprite = villagerSpriteSheet;
      npcSpriteLoaded = villagerSpriteLoaded;
    } else if (npc.name === 'Hermit') {
      npcSprite = lizardSpriteSheet;
      npcSpriteLoaded = lizardSpriteLoaded;
    }
    
    // Draw NPC sprite if available
    if (npcSprite && npcSpriteLoaded) {
      const size = Math.max(12, canvas.width * 0.02);
      const spriteSize = size * 2;  // Smaller size for 64x64 NPC sprites
      const idleDownRow = 28;  // Idle down for 64x64 NPC sprites
      ctx.save();
      ctx.drawImage(
        npcSprite,
        0, idleDownRow * 64,  // Row 28 (64x64 frames, rows spaced 64px apart)
        64, 64,  // 64x64 frames for NPCs
        npc.x - spriteSize / 2, npc.y - spriteSize / 1.3,
        spriteSize, spriteSize
      );
      ctx.restore();
    } else {
      // Fallback to drawn character
      const color = npc.name === 'Old Man' ? '#aaa' : npc.name === 'Guard' ? '#a44' : '#fa4';
      drawCharacter(npc.x, npc.y, 'npc', color, npc.equipment || {});
    }
    
    // Draw health bar above NPC if damaged
    if (npc.hp < npc.maxHp) {
      const barWidth = 30;
      const barHeight = 4;
      ctx.fillStyle = '#333';
      ctx.fillRect(npc.x - barWidth / 2, npc.y - 35, barWidth, barHeight);
      ctx.fillStyle = '#3f3';
      ctx.fillRect(npc.x - barWidth / 2, npc.y - 35, (npc.hp / npc.maxHp) * barWidth, barHeight);
    }
  });
}

// --- Draw Enemies with Type-Specific Colors ---
function drawEnemies() {
  enemies.forEach((enemy, i) => {
    if (!enemy.alive) return;
    const enemyColor = ENEMY_TYPES[enemy.type]?.color || '#e44';
    const sizeScale = ENEMY_TYPES[enemy.type]?.sizeScale || 1;
    // Determine if enemy is attacking (close to player)
    const p = getActivePlayer();
    const isAttacking = Math.hypot(p.x - enemy.x, p.y - enemy.y) < 40;

    // Determine facing direction from movement vector
    if (typeof enemy.lastX !== 'number') enemy.lastX = enemy.x;
    if (typeof enemy.lastY !== 'number') enemy.lastY = enemy.y;
    const dx = enemy.x - enemy.lastX;
    const dy = enemy.y - enemy.lastY;
    let facing = enemy.facingDirection || 'down';
    // Detect if enemy is actually moving
    const movementThreshold = 0.5;
    const isMoving = Math.abs(dx) > movementThreshold || Math.abs(dy) > movementThreshold;
    // Only update direction if movement is significant (reduces flashing)
    if (isMoving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        facing = dx > 0 ? 'right' : 'left';
      } else {
        facing = dy > 0 ? 'down' : 'up';
      }
      enemy.facingDirection = facing;
    }
    enemy.lastX = enemy.x;
    enemy.lastY = enemy.y;

    const enemySprite = getEnemySpriteSource(enemy.type);
    if (enemySprite) {
      const frame = getEnemySpriteFrame(facing, isAttacking, isMoving);
      const size = Math.max(12, canvas.width * 0.02) * sizeScale;
      const spriteSize = size * 2.2;
      ctx.drawImage(
        enemySprite,
        frame.x, frame.y,
        frame.width, frame.height,
        enemy.x - spriteSize / 2,
        enemy.y - spriteSize / 1.3,
        spriteSize,
        spriteSize
      );
    } else {
      const animState = { isAttacking };
      drawCharacter(enemy.x, enemy.y, 'enemy', enemyColor, {}, animState, sizeScale);
    }

    // Draw health bar above enemy
    const barWidth = 25;
    const barHeight = 4;
    ctx.fillStyle = '#333';
    ctx.fillRect(enemy.x - barWidth / 2, enemy.y - 35, barWidth, barHeight);
    const maxHp = enemy.maxHp || 10;
    const hpPercent = Math.max(0, enemy.hp / maxHp);
    const hpColor = hpPercent > 0.5 ? '#3f3' : hpPercent > 0.25 ? '#fa4' : '#e33';
    ctx.fillStyle = hpColor;
    ctx.fillRect(enemy.x - barWidth / 2, enemy.y - 35, hpPercent * barWidth, barHeight);
  });
}

// --- Persistent World State ---
let worldState = {
  hermitRescued: false,
  merchantHelped: false
};

// --- Data Models / Areas / NPCs ---
const AREAS = {
  Village: {
    npcs: [
      { x: 120, y: 100, name: 'Old Man', dialogue: ["Welcome to the village!", "Find the lost sword in the forest."] }
    ]
  },
  Forest: {
    npcs: []
  },
  Cave: {
    npcs: []
  }
};

let npcs = getAreaNPCs(currentArea);

// --- Quest Types ---
const quests = [
  { id: 1, name: "Find the Lost Sword", type: "fetch", status: "not-started", description: "Retrieve the sword from the forest.", target: "Sword", next: 4 },
  { id: 2, name: "Defeat Forest Enemies", type: "defeat", status: "not-started", description: "Defeat 2 enemies in the forest.", target: "Forest", count: 0, required: 2, next: 5 },
  { id: 3, name: "Rescue the Hermit", type: "delivery", status: "not-started", description: "Bring a Potion to the Hermit in the Cave.", target: "Potion", npc: "Mysterious Hermit", next: 6 },
  { id: 4, name: "Prove Your Worth", type: "defeat", status: "locked", description: "Defeat the boss in the Cave.", target: "Cave", count: 0, required: 1, next: null },
  { id: 5, name: "Village Defender", type: "defeat", status: "locked", description: "Defeat 3 enemies in the Village (after Forest quest).", target: "Village", count: 0, required: 3, next: null },
  { id: 6, name: "Hermit's Secret", type: "branch", status: "locked", description: "Choose to accept the Hermit's secret or refuse.", branch: ["accept", "refuse"], next: null }
];

// --- Get Nearby NPC (within detection range) ---
function getNearbyNpc(range = 60) {
  const p = getActivePlayer();
  let closest = null;
  let closestDist = range;
  npcs.forEach(npc => {
    const dist = Math.hypot(p.x - npc.x, p.y - npc.y);
    if (dist < closestDist) {
      closestDist = dist;
      closest = npc;
    }
  });
  return closest;
}

// --- Multi-step, Branching Quest Example: Hermit Quest Data ---
const hermitQuest = {
  id: 100,
  name: "Rescue the Hermit",
  status: "not-started",
  step: 0, // 0: not started, 1: bring potion, 2: make choice, 3: complete
  description: "Bring a Potion to the Hermit in the Cave, then choose to accept or refuse his secret."
};

// --- Hermit Quest Logic ---
function tryStartHermitQuest(npc) {
  if (npc.name === 'Mysterious Hermit' && hermitQuest.status === 'not-started') {
    hermitQuest.status = 'in-progress';
    hermitQuest.step = 1;
    showDialogue('Quest started: Rescue the Hermit!');
    return true;
  }
  return false;
}

function tryProgressHermitQuest() {
  const p = getActivePlayer();
  if (hermitQuest.status === 'in-progress' && hermitQuest.step === 1) {
    // Check if player has Potion and is near Hermit
    const npc = getNearbyNpc();
    if (
      npc &&
      npc.name === 'Mysterious Hermit' &&
      p.inventory.map(id => {
        const item = ITEMS.find(i => i.id === id || i.name === id);
        return item ? item.name : null;
      }).includes('Potion')
    ) {
      hermitQuest.step = 2;
      showDialogue('Thank you for the Potion! Will you accept the Hermit\'s secret?');
      return true;
    }
  }
  return false;
}

function chooseHermitSecret(accept) {
  if (hermitQuest.status === 'in-progress' && hermitQuest.step === 2) {
    hermitQuest.step = 3;
    hermitQuest.status = 'complete';
    worldState.hermitRescued = true;
    showDialogue(accept ? 'You learned the Hermit\'s secret!' : 'You refused the Hermit\'s secret.');
  }
}

// --- Patch Hermit NPC interaction ---
document.addEventListener('keydown', e => {
  if (!settingsOpen && !shopOpen && e.key === ' ' && getNearbyNpc()?.name === 'Mysterious Hermit') {
    const npc = getNearbyNpc();
    if (!npc) return;
    if (hermitQuest.status === 'not-started') {
      tryStartHermitQuest(npc);
    } else if (hermitQuest.status === 'in-progress' && hermitQuest.step === 1) {
      if (tryProgressHermitQuest()) {
        // Show choices after giving potion
        document.getElementById('dialoguePanel').innerHTML +=
          `<br><button class='rpg-btn' onclick='chooseHermitSecret(true)'>Accept</button> ` +
          `<button class='rpg-btn' onclick='chooseHermitSecret(false)'>Refuse</button>`;
      }
    }
  }
});

// --- Combat / Attack Logic (with weapon bonus & quest progress) ---
function attackNearbyEnemy() {
  const p = getActivePlayer();
  let weaponAtk = 1;
  if (p.equipment.weapon) {
    const item = ITEMS.find(i => i.id === p.equipment.weapon || i.name === p.equipment.weapon);
    const baseAtk = item && typeof item.atk === 'number' ? item.atk : 1;
    weaponAtk = baseAtk + getEquippedBonus(p, 'weapon');
  }
  
  // Set attack animation state
  p.isAttacking = true;
  p.attackStartTime = Date.now();
  p.lastAttackTime = Date.now();
  
  const enemy = enemies.find(e => e.alive && Math.hypot(p.x - e.x, p.y - e.y) < 28);
  if (enemy) {
    addEffect && addEffect('attack', enemy.x, enemy.y, '#fa4');
    playSound('hit', 0.3);
    enemy.hp -= weaponAtk;
    addDamageNumber(enemy.x, enemy.y, weaponAtk, 'damage');
    
    // Add blood particles
    for (let i = 0; i < 4; i++) {
      addParticle(enemy.x + (Math.random() - 0.5) * 20, enemy.y + (Math.random() - 0.5) * 20, 
                  (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 'blood', '#c33');
    }
    
    showDialogue(`Attacked ${enemy.type} for ${weaponAtk} damage!`);
    if (enemy.hp <= 0) {
      enemy.alive = false;
      showDialogue(`${enemy.type.charAt(0).toUpperCase() + enemy.type.slice(1)} defeated!`);
      const xpReward = enemy.xpReward || 5;
      p.xp += xpReward;
      p.totalXp = (p.totalXp || 0) + xpReward;
      addDamageNumber(enemy.x, enemy.y - 30, xpReward, 'xp');
      checkLevelUp();
      unlockAchievement(1); // First Blood

      // Defeat quest progress
      const defeatQuest = quests.find(q => q.type === "defeat" && q.status === "in-progress" && currentArea === q.target);
      if (defeatQuest) {
        defeatQuest.count = (defeatQuest.count || 0) + 1;
        showDialogue(`Enemy defeated! (${defeatQuest.count}/${defeatQuest.required})`);
        tryCompleteQuest();
      }

      // Drop loot based on enemy type loot table
      if (enemy.lootTable && Array.isArray(enemy.lootTable)) {
        let offsetX = 0;
        enemy.lootTable.forEach(loot => {
          if (Math.random() < loot.rate) {
            spawnLoot && spawnLoot(enemy.x + offsetX, enemy.y, loot.type, loot.count || 1, loot.id || null);
            offsetX += 12;
          }
        });
      } else {
        // Fallback loot
        spawnLoot && spawnLoot(enemy.x, enemy.y, 'coin', Math.floor(Math.random() * 3) + 1);
      }

      updateInfoBar();
    }
  }
}

function attackNearbyNPC() {
  const p = getActivePlayer();
  let weaponAtk = 1;
  if (p.equipment && p.equipment.weapon) {
    const item = ITEMS.find(i => i.id === p.equipment.weapon || i.name === p.equipment.weapon);
    const baseAtk = item && typeof item.atk === 'number' ? item.atk : 1;
    weaponAtk = baseAtk + (typeof getEquippedBonus === 'function' ? getEquippedBonus(p, 'weapon') : 0);
  }
  const npc = npcs.find(n => Math.hypot(p.x - n.x, p.y - n.y) < 28 && n.hp > 0);
  if (npc) {
    npc.hp = Math.max(0, npc.hp - weaponAtk);
    showDialogue && showDialogue(`Attacked ${npc.name} for ${weaponAtk} damage!`);
    if (npc.hp <= 0) {
      showDialogue && showDialogue(`${npc.name} defeated!`);
    } else {
      // NPC retaliates
      const retaliation = npc.retaliation || 2;
      p.hp = Math.max(0, p.hp - retaliation);
      showDialogue && showDialogue(`${npc.name} retaliates for ${retaliation} damage!`);
      updateInfoBar && updateInfoBar();
      if (p.hp <= 0) {
        showGameOverScreen();
      }
    }
  }
}

window.addEventListener('keydown', (e) => {
  if (settingsOpen || shopOpen) return;
  // Handle battle input separately
  if (typeof battleActive !== 'undefined' && battleActive) return;
  
  // E key: building enter/exit takes priority in village
  if (e.key === 'e') {
    e.preventDefault();
    // Inside a building — exit at bottom edge
    if (insideBuilding) {
      const p = getActivePlayer();
      if (p.y > canvas.height - 60) {
        exitBuilding();
        return;
      }
    }
    // Outside in village — check if near a building entrance
    if (currentArea === 'village' && !insideBuilding) {
      const p = getActivePlayer();
      for (const b of BUILDING_ENTRANCES) {
        const { x: bx, y: by } = villageToCanvas(b.xPct, b.yPct);
        const { w: bw, h: bh } = villageSizeToCanvas(b.wPct, b.hPct);
        const dist = Math.hypot(p.x - (bx + bw/2), p.y - (by + bh/2));
        if (dist < 60) {
          enterBuilding(b.id);
          return;
        }
      }
    }
    // Otherwise attack
    attackNearbyEnemy();
    return;
  }
  
  // Space: attack enemies
  if (e.key === ' ') {
    e.preventDefault();
    attackNearbyEnemy();
  }
  
  // Attack NPCs (use with caution!)
  if (e.key === 'n') {
    attackNearbyNPC();
  }
});

// --- Quest Completion Logic ---
function tryCompleteQuest() {
  const p = getActivePlayer();

  // Fetch quest: check inventory
  const fetchQuest = quests.find(q => q.type === "fetch" && q.status === "in-progress");
  if (fetchQuest && p.inventory.map(id => {
    const item = ITEMS.find(i => i.id === id || i.name === id);
    return item ? item.name : null;
  }).includes(fetchQuest.target)) {
    fetchQuest.status = "complete";
    showDialogue(`Quest complete: ${fetchQuest.name}!`);
    unlockNextQuest(fetchQuest);
    return true;
  }

  // Defeat quest: check count
  const defeatQuest = quests.find(q => q.type === "defeat" && q.status === "in-progress");
  if (defeatQuest && defeatQuest.count >= defeatQuest.required) {
    defeatQuest.status = "complete";
    showDialogue(`Quest complete: ${defeatQuest.name}!`);
    unlockNextQuest(defeatQuest);
    return true;
  }

  // Delivery quest: check if player has item and is near NPC
  const deliveryQuest = quests.find(q => q.type === "delivery" && q.status === "in-progress");
  if (deliveryQuest && p.inventory.map(id => {
    const item = ITEMS.find(i => i.id === id || i.name === id);
    return item ? item.name : null;
  }).includes(deliveryQuest.target)) {
    const npc = getNearbyNpc();
    if (npc && npc.name === deliveryQuest.npc) {
      deliveryQuest.status = "complete";
      showDialogue(`Quest complete: ${deliveryQuest.name}!`);
      unlockNextQuest(deliveryQuest);
      return true;
    }
  }

  // Branch quest: handled in dialogue
  return false;
}

function unlockNextQuest(quest) {
  if (quest.next) {
    const nextQuest = quests.find(q => q.id === quest.next);
    if (nextQuest && nextQuest.status === 'locked') {
      nextQuest.status = 'not-started';
      showDialogue(`New quest unlocked: ${nextQuest.name}`);
    }
  }
}

// --- Achievements/Trophies System ---
const achievements = [
  { id: 1, name: 'First Blood', unlocked: false }
  // add more as needed
];

function unlockAchievement(id) {
  const ach = achievements.find(a => a.id === id);
  if (ach && !ach.unlocked) {
    ach.unlocked = true;
    showAchievementPopup(ach.name);
  }
}

function showAchievementPopup(name) {
  const popup = document.createElement('div');
  popup.innerText = `Achievement Unlocked: ${name}!`;
  popup.style.position = 'fixed';
  popup.style.bottom = '32px';
  popup.style.left = '50%';
  popup.style.transform = 'translateX(-50%)';
  popup.style.background = '#232';
  popup.style.color = '#ff0';
  popup.style.padding = '12px 32px';
  popup.style.borderRadius = '8px';
  popup.style.fontWeight = 'bold';
  popup.style.fontSize = '1.1em';
  popup.style.boxShadow = '0 2px 12px #000a';
  popup.style.zIndex = '3000';
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 2200);
}

// --- Minimap Rendering ---
function drawMinimap() {
  const minimap = document.getElementById('minimap');
  if (!minimap) return;
  const mctx = minimap.getContext('2d');
  mctx.clearRect(0, 0, minimap.width, minimap.height);

  // Area color
  mctx.fillStyle = '#222';
  mctx.fillRect(0, 0, minimap.width, minimap.height);

  // Player
  const p = getActivePlayer();
  mctx.fillStyle = '#4af';
  mctx.beginPath();
  mctx.arc(p.x / canvas.width * minimap.width, p.y / canvas.height * minimap.height, 4, 0, Math.PI * 2);
  mctx.fill();

  // NPCs
  mctx.fillStyle = '#fa4';
  npcs.forEach(npc => {
    mctx.beginPath();
    mctx.arc(npc.x / canvas.width * minimap.width, npc.y / canvas.height * minimap.height, 3, 0, Math.PI * 2);
    mctx.fill();
  });

  // Enemies
  mctx.fillStyle = '#e33';
  enemies.forEach(enemy => {
    if (enemy.alive) {
      mctx.beginPath();
      mctx.arc(enemy.x / canvas.width * minimap.width, enemy.y / canvas.height * minimap.height, 3, 0, Math.PI * 2);
      mctx.fill();
    }
  });
}

// --- Achievements UI ---
function renderAchievementsUI() {
  const panel = document.getElementById('questPanel');
  const unlocked = achievements.filter(a => a.unlocked);
  if (unlocked.length > 0) {
    panel.innerHTML += `<br><b>Achievements:</b> ` +
      unlocked.map(a => `<span style='color:#ff0'>${a.name}</span>`).join(', ');
  }
}

// --- Advanced Dialogue/Choices System ---
let dialogueState = null;
let currentNpc = null;
let npcDialogueIndex = 0;

function showDialogueWithChoices(npc, lineIndex = 0) {
  const dialogue = npc.dialogue[lineIndex];
  if (typeof dialogue === 'string') {
    showDialogue(dialogue);
    dialogueState = { npc, lineIndex, choices: null };
  } else if (dialogue && dialogue.choices) {
    let html = `<div>${dialogue.text}</div>`;
    dialogue.choices.forEach((choice, i) => {
      html += `<button class='rpg-btn' onclick='chooseDialogueOption(${i})'>${choice.text}</button> `;
    });
    document.getElementById('dialoguePanel').innerHTML = html;
    dialogueState = { npc, lineIndex, choices: dialogue.choices };
  }
}

function chooseDialogueOption(choiceIndex) {
  if (!dialogueState || !dialogueState.choices) return;
  const choice = dialogueState.choices[choiceIndex];
  if (choice.next !== undefined) {
    showDialogueWithChoices(dialogueState.npc, choice.next);
  } else if (choice.action) {
    choice.action();
    showDialogue('');
    dialogueState = null;
  } else {
    showDialogue('');
    dialogueState = null;
  }
}

// --- Example: Add choices to an NPC ---
AREAS.Village.npcs[0].dialogue = [
  "Welcome to the village!",
  {
    text: "Do you want to hear a tip?",
    choices: [
      { text: "Yes", next: 2 },
      { text: "No", next: 3 }
    ]
  },
  "Explore the forest for adventure and loot!",
  "Alright, good luck on your journey!"
];

// --- Patch NPC interaction to use advanced dialogue ---
document.addEventListener('keydown', e => {
  if (!settingsOpen && !shopOpen && e.key === ' ') {
    const npc = getNearbyNpc();
    if (npc) {
      if (currentNpc !== npc) {
        currentNpc = npc;
        npcDialogueIndex = 0;
      }
      // Use advanced dialogue if present
      if (Array.isArray(npc.dialogue) && typeof npc.dialogue[npcDialogueIndex] !== 'undefined') {
        showDialogueWithChoices(npc, npcDialogueIndex);
        npcDialogueIndex = (npcDialogueIndex + 1) % npc.dialogue.length;
      } else {
        showDialogue(npc.dialogue);
      }
    }
  }
});

// --- Equipment Rarity Helpers (no local ITEMS definition) ---
const ITEM_RARITIES = {
  common: { color: '#fff', bonus: 0 },
  rare: { color: '#4af', bonus: 2 },
  epic: { color: '#fa4', bonus: 5 }
};

// --- Items Database ---
console.log('[RPG] Declaring ITEMS array...');
console.log('[RPG] Current ITEMS value:', typeof window.ITEMS !== 'undefined' ? 'EXISTS (DUPLICATE!)' : 'undefined (OK)');
const ITEMS = [
  // Starting weapon
  { id: 'iron_sword', name: 'Iron Sword', type: 'weapon', rarity: 'common', damage: 3 },
  // Rare weapons
  { id: 'steel_sword', name: 'Steel Sword', type: 'weapon', rarity: 'rare', damage: 5 },
  { id: 'battle_axe', name: 'Battle Axe', type: 'weapon', rarity: 'rare', damage: 6 },
  { id: 'spear', name: 'Spear', type: 'weapon', rarity: 'rare', damage: 5 },
  // Epic weapons
  { id: 'flame_sword', name: 'Flame Sword', type: 'weapon', rarity: 'epic', damage: 8 },
  { id: 'dragon_axe', name: 'Dragon Axe', type: 'weapon', rarity: 'epic', damage: 10 },
  // NPC weapons
  { id: 'wooden_staff', name: 'Wooden Staff', type: 'staff', rarity: 'common', damage: 2 },
  { id: 'staff', name: 'Staff', type: 'staff', rarity: 'common', damage: 2 },
  // Armor
  { id: 'leather_armor', name: 'Leather Armor', type: 'armor', rarity: 'common', defense: 2 },
  { id: 'iron_armor', name: 'Iron Armor', type: 'armor', rarity: 'rare', defense: 4 },
  { id: 'dragon_plate', name: 'Dragon Plate', type: 'armor', rarity: 'epic', defense: 7 },
  // Shields
  { id: 'wooden_shield', name: 'Wooden Shield', type: 'shield', rarity: 'common', defense: 1 },
  { id: 'steel_shield', name: 'Steel Shield', type: 'shield', rarity: 'rare', defense: 3 },
  { id: 'dragon_shield', name: 'Dragon Shield', type: 'shield', rarity: 'epic', defense: 5 },
];

function getItemRarity(item) {
  if (!item || !item.rarity) return ITEM_RARITIES.common;
  return ITEM_RARITIES[item.rarity] || ITEM_RARITIES.common;
}

console.log('[RPG] ITEMS array initialized with', ITEMS.length, 'items');
console.log('[RPG] Items loaded:', ITEMS.map(i => i.name).join(', '));

// --- Loot System ---
const lootDrops = [];

// --- Visual Effects System ---
const visualEffects = [];
const damageNumbers = [];
const particles = [];
const spellProjectiles = [];

function getDirectionVector(direction = 'down') {
  if (direction === 'up') return { dx: 0, dy: -1 };
  if (direction === 'left') return { dx: -1, dy: 0 };
  if (direction === 'right') return { dx: 1, dy: 0 };
  return { dx: 0, dy: 1 };
}

function spawnFireballProjectile(caster) {
  const p = caster || getActivePlayer();
  const facing = p.lastDirection || 'down';
  const dir = getDirectionVector(facing);
  spellProjectiles.push({
    type: 'fireball',
    x: p.x + dir.dx * 20,
    y: p.y + dir.dy * 20,
    vx: dir.dx * 7,
    vy: dir.dy * 7,
    radius: 12,
    travel: 0,
    maxTravel: 420,
    owner: p
  });
}

function spawnLightningProjectile(caster) {
  const p = caster || getActivePlayer();
  const facing = p.lastDirection || 'down';
  const dir = getDirectionVector(facing);
  spellProjectiles.push({
    type: 'lightning',
    x: p.x + dir.dx * 20,
    y: p.y + dir.dy * 20,
    vx: dir.dx * 12,
    vy: dir.dy * 12,
    radius: 8,
    travel: 0,
    maxTravel: 300,
    owner: p
  });
}

function resolveLightningProjectile(projectile) {
  const p = projectile.owner || getActivePlayer();
  const hitRadius = 20;
  let hit = false;

  enemies.forEach(enemy => {
    if (!enemy.alive) return;
    const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
    if (dist > hitRadius) return;

    const dmg = 10 + (p.stats?.int || 0);
    enemy.hp -= dmg;
    hit = true;

    addEffect('lightning', enemy.x, enemy.y, '#ffff00');
    addDamageNumber(enemy.x, enemy.y, dmg, 'damage');

    for (let i = 0; i < 12; i++) {
      addParticle(enemy.x + (Math.random() - 0.5) * 35, enemy.y + (Math.random() - 0.5) * 35,
                  (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5, 'spark', '#ffff00');
    }
    for (let i = 0; i < 4; i++) {
      addParticle(enemy.x, enemy.y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 'spark', '#fff');
    }

    if (enemy.hp <= 0) {
      enemy.alive = false;
      const xpReward = enemy.xpReward || 5;
      p.xp += xpReward;
      p.totalXp = (p.totalXp || 0) + xpReward;
      addDamageNumber(enemy.x, enemy.y - 30, xpReward, 'xp');
      checkLevelUp();
      unlockAchievement(1);

      if (enemy.lootTable && Array.isArray(enemy.lootTable)) {
        let offsetX = 0;
        enemy.lootTable.forEach(loot => {
          if (Math.random() < loot.rate) {
            spawnLoot && spawnLoot(enemy.x + offsetX, enemy.y, loot.type, loot.count || 1, loot.id || null);
            offsetX += 12;
          }
        });
      } else {
        spawnLoot && spawnLoot(enemy.x, enemy.y, 'coin', Math.floor(Math.random() * 3) + 1);
      }
    }
  });

  playSound('hit', 0.5);
  showDialogue(hit ? 'Lightning bolt strikes!' : 'Lightning dissipates.');
  updateInfoBar();
}

function resolveFireballExplosion(projectile) {
  const p = projectile.owner || getActivePlayer();
  const blastRadius = 70;
  let hit = false;

  enemies.forEach(enemy => {
    if (!enemy.alive) return;
    const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
    if (dist > blastRadius) return;

    const dmg = 4 + Math.floor((p.stats?.int || 0) / 2);
    enemy.hp -= dmg;
    hit = true;

    addDamageNumber(enemy.x, enemy.y, dmg, 'damage');
    for (let i = 0; i < 6; i++) {
      addParticle(enemy.x, enemy.y, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 'spark', '#fa4');
    }

    if (enemy.hp <= 0) {
      enemy.alive = false;
      const xpReward = enemy.xpReward || 5;
      p.xp += xpReward;
      p.totalXp = (p.totalXp || 0) + xpReward;
      addDamageNumber(enemy.x, enemy.y - 30, xpReward, 'xp');
      checkLevelUp();
      unlockAchievement(1);

      if (enemy.lootTable && Array.isArray(enemy.lootTable)) {
        let offsetX = 0;
        enemy.lootTable.forEach(loot => {
          if (Math.random() < loot.rate) {
            spawnLoot && spawnLoot(enemy.x + offsetX, enemy.y, loot.type, loot.count || 1, loot.id || null);
            offsetX += 12;
          }
        });
      } else {
        spawnLoot && spawnLoot(enemy.x, enemy.y, 'coin', Math.floor(Math.random() * 3) + 1);
      }
    }
  });

  addEffect('fireball', projectile.x, projectile.y, '#fa4');
  playSound('hit', 0.4);
  showDialogue(hit ? 'Fireball explodes!' : 'Fireball fizzles out.');
  updateInfoBar();
}

function updateSpellProjectiles() {
  for (let i = spellProjectiles.length - 1; i >= 0; i--) {
    const projectile = spellProjectiles[i];
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    projectile.travel += Math.hypot(projectile.vx, projectile.vy);

    // Add visible trails while projectile flies
    if (projectile.type === 'fireball') {
      for (let t = 0; t < 2; t++) {
        addParticle(
          projectile.x + (Math.random() - 0.5) * 8,
          projectile.y + (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
          'spark',
          '#ff9933'
        );
      }
    } else if (projectile.type === 'lightning') {
      for (let t = 0; t < 3; t++) {
        addParticle(
          projectile.x + (Math.random() - 0.5) * 12,
          projectile.y + (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 1.2,
          'spark',
          '#ffff00'
        );
      }
    }

    let shouldExplode = false;

    if (projectile.type === 'fireball') {
      const hitEnemy = enemies.some(enemy => enemy.alive && Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) < 18);
      if (hitEnemy || projectile.travel >= projectile.maxTravel) {
        shouldExplode = true;
      }
    } else if (projectile.type === 'lightning') {
      const hitEnemy = enemies.some(enemy => enemy.alive && Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) < 15);
      if (hitEnemy || projectile.travel >= projectile.maxTravel) {
        shouldExplode = true;
      }
    }

    if (shouldExplode) {
      if (projectile.type === 'fireball') {
        resolveFireballExplosion(projectile);
      } else if (projectile.type === 'lightning') {
        resolveLightningProjectile(projectile);
      }
      spellProjectiles.splice(i, 1);
    }
  }
}

function drawSpellProjectiles() {
  spellProjectiles.forEach(projectile => {
    ctx.save();

    if (projectile.type === 'fireball') {
      ctx.globalAlpha = 0.95;

      // Outer glow
      ctx.fillStyle = 'rgba(255, 140, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius + 8, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = '#ffcc33';
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
      ctx.fill();

      // Hot center
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (projectile.type === 'lightning') {
      ctx.globalAlpha = 0.9;

      // Outer electrical aura
      ctx.strokeStyle = 'rgba(255, 255, 100, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius + 6, 0, Math.PI * 2);
      ctx.stroke();

      // Main bolt body
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const offsetX = (Math.random() - 0.5) * 3;
        const offsetY = (Math.random() - 0.5) * 3;
        ctx.arc(projectile.x + offsetX, projectile.y + offsetY, projectile.radius - 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bright core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Electric branch effect
      ctx.strokeStyle = 'rgba(255, 255, 150, 0.6)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const length = projectile.radius * 2;
        ctx.beginPath();
        ctx.moveTo(projectile.x, projectile.y);
        for (let j = 0; j < 3; j++) {
          const x = projectile.x + Math.cos(angle + (Math.random() - 0.5) * 0.4) * length * (j / 3);
          const y = projectile.y + Math.sin(angle + (Math.random() - 0.5) * 0.4) * length * (j / 3);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  });
}

function addEffect(type, x, y, color = '#fff', intensity = 1) {
  visualEffects.push({
    type,
    x,
    y,
    color,
    opacity: 1,
    lifetime: 0,
    maxLifetime: type === 'attack' ? 20 : type === 'fireball' ? 25 : type === 'lightning' ? 15 : 30,
    intensity
  });
}

function addDamageNumber(x, y, amount, type = 'damage') {
  damageNumbers.push({
    x,
    y,
    amount,
    type, // 'damage', 'heal', 'xp'
    opacity: 1,
    lifetime: 0,
    maxLifetime: 60,
    vx: (Math.random() - 0.5) * 1.5,
    vy: -1.5
  });
}

function addParticle(x, y, vx, vy, type = 'spark', color = '#fff') {
  particles.push({
    x, y, vx, vy, type, color,
    opacity: 1,
    lifetime: 0,
    maxLifetime: type === 'spark' ? 30 : type === 'dust' ? 45 : type === 'blood' ? 50 : 40,
    size: type === 'dust' ? 3 : type === 'blood' ? 2 : 2
  });
}

function drawEffects() {
  visualEffects.forEach((effect, index) => {
    effect.lifetime++;
    effect.opacity = 1 - (effect.lifetime / effect.maxLifetime);
    
    if (effect.lifetime >= effect.maxLifetime) {
      visualEffects.splice(index, 1);
      return;
    }
    
    ctx.save();
    ctx.globalAlpha = effect.opacity;
    
    if (effect.type === 'attack') {
      // Draw impact burst
      const size = 8 + (effect.lifetime * 0.5);
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === 'pickup') {
      // Draw upward floating text
      const yOffset = effect.lifetime * 1.5;
      ctx.fillStyle = effect.color;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('+', effect.x, effect.y - yOffset);
    } else if (effect.type === 'fireball') {
      // Fireball explosion - enhanced with expanding rings
      const size = 15 + (effect.lifetime * 1.2);
      const progress = effect.lifetime / effect.maxLifetime;
      
      // Outer expanding ring
      ctx.strokeStyle = `rgba(255, 165, 0, ${(1 - progress) * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, size * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner rotating flames
      ctx.fillStyle = effect.color;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + effect.lifetime * 0.4;
        const radius = size * 0.6;
        const flameSize = size * 0.5 * (1 - progress * 0.5);
        ctx.beginPath();
        ctx.arc(effect.x + Math.cos(angle) * radius, effect.y + Math.sin(angle) * radius, flameSize, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Glow center
      ctx.fillStyle = 'rgba(255, 200, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'lightning') {
      // Lightning impact - enhanced with branching bolts and glow
      const intensity = 1 - (effect.lifetime / effect.maxLifetime);
      const progress = effect.lifetime / effect.maxLifetime;
      
      // Glow circle that expands
      ctx.fillStyle = `rgba(255, 255, 100, ${intensity * 0.3})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 20 + progress * 40, 0, Math.PI * 2);
      ctx.fill();
      
      // Main lightning bolts
      ctx.strokeStyle = `rgba(255, 255, 150, ${intensity * 0.9})`;
      ctx.lineWidth = 2 + intensity * 4;
      ctx.lineCap = 'round';
      
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const startAngle = (i / 4) * Math.PI * 2;
        ctx.moveTo(effect.x, effect.y);
        let x = effect.x;
        let y = effect.y;
        
        for (let j = 0; j < 4; j++) {
          const nextX = effect.x + Math.cos(startAngle) * (j + 1) * 15;
          const nextY = effect.y + Math.sin(startAngle) * (j + 1) * 15;
          x = nextX + (Math.random() - 0.5) * 8;
          y = nextY + (Math.random() - 0.5) * 8;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      
      // Inner bright core
      ctx.fillStyle = `rgba(255, 255, 200, ${intensity * 0.7})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 5 + intensity * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'heal') {
      // Healing light - enhanced with ascending particles and glow
      const size = 12 + (effect.lifetime * 0.6);
      const progress = effect.lifetime / effect.maxLifetime;
      const opacity = 1 - progress;
      
      // Glow circle
      ctx.fillStyle = `rgba(0, 255, 100, ${opacity * 0.2})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Ascending spiral particles
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + effect.lifetime * 0.15;
        const ascend = effect.lifetime * 1.5;
        const particleX = effect.x + Math.cos(angle) * size;
        const particleY = effect.y + Math.sin(angle) * size - ascend;
        
        ctx.fillStyle = `rgba(0, 255, 100, ${opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(particleX, particleY, 4 - progress * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Center bright cross
      ctx.strokeStyle = `rgba(0, 255, 150, ${opacity * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(effect.x - size * 0.7, effect.y);
      ctx.lineTo(effect.x + size * 0.7, effect.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y - size * 0.7);
      ctx.lineTo(effect.x, effect.y + size * 0.7);
      ctx.stroke();
    }
    
    ctx.restore();
  });
}

function drawDamageNumbers() {
  damageNumbers.forEach((num, index) => {
    num.lifetime++;
    num.opacity = 1 - (num.lifetime / num.maxLifetime);
    num.x += num.vx;
    num.y += num.vy;
    
    if (num.lifetime >= num.maxLifetime) {
      damageNumbers.splice(index, 1);
      return;
    }
    
    ctx.save();
    ctx.globalAlpha = num.opacity;
    
    let color = '#fff';
    if (num.type === 'damage') color = '#e33';
    else if (num.type === 'heal') color = '#3f3';
    else if (num.type === 'xp') color = '#ffd700';
    
    ctx.fillStyle = color;
    ctx.font = `bold ${12 + num.opacity * 4}px Arial`;
    ctx.textAlign = 'center';
    
    const text = num.type === 'damage' ? `-${num.amount}` : num.type === 'heal' ? `+${num.amount}` : `+${num.amount}`;
    ctx.fillText(text, num.x, num.y);
    
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach((p, index) => {
    p.lifetime++;
    p.opacity = 1 - (p.lifetime / p.maxLifetime);
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1; // gravity
    
    if (p.lifetime >= p.maxLifetime) {
      particles.splice(index, 1);
      return;
    }
    
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    
    if (p.type === 'spark') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'dust') {
      ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    } else if (p.type === 'blood') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  });
}

function spawnLoot(x, y, type, count = 1, itemId = null) {
  // Create a loot drop object
  const loot = {
    x,
    y,
    type, // 'coin' or 'item'
    count,
    itemId,
    pickedUp: false
  };
  lootDrops.push(loot);
}

function drawLoot() {
  lootDrops.forEach((loot, index) => {
    if (loot.pickedUp) return;
    
    // Check if player is near loot to pick it up
    const p = getActivePlayer();
    const dist = Math.hypot(p.x - loot.x, p.y - loot.y);
    if (dist < 25) {
      // Pick up loot
      loot.pickedUp = true;
      if (loot.type === 'coin') {
        p.coins = (p.coins || 0) + loot.count;
        addDamageNumber(loot.x, loot.y, loot.count, 'xp');
        for (let i = 0; i < 8; i++) {
          addParticle(loot.x, loot.y, (Math.random() - 0.5) * 3, Math.random() * -2, 'spark', '#ffd700');
        }
        playSound('pickup', 0.2);
      } else if (loot.type === 'item' && loot.itemId) {
        addItemToInventory(loot.itemId);
      }
      // Remove from array after a moment
      setTimeout(() => {
        const idx = lootDrops.indexOf(loot);
        if (idx !== -1) lootDrops.splice(idx, 1);
      }, 100);
      return;
    }
    
    // Draw loot on map
    if (loot.type === 'coin') {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(loot.x, loot.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (loot.type === 'item') {
      ctx.fillStyle = '#4af';
      ctx.fillRect(loot.x - 6, loot.y - 6, 12, 12);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(loot.x - 6, loot.y - 6, 12, 12);
    }
  });
}

function addItemToInventory(itemId) {
  const item = ITEMS.find(i => i.id === itemId || i.name === itemId);
  if (item) {
    const p = getActivePlayer();
    p.inventory.push(item.id ?? item.name);
    const rarity = getItemRarity(item);
    addEffect && addEffect('pickup', p.x, p.y, rarity.color);
    playSound('pickup', 0.2);
    showDialogue(`Picked up: <span style='color:${rarity.color}'>${item.name}</span>`);
  }
}

function equipItem(itemName) {
  const item = ITEMS.find(i => i.name === itemName);
  if (!item) return;
  if (item.type === "weapon" || item.type === "armor") {
    const p = getActivePlayer();
    p.equipment[item.type] = item.id ?? item.name;
    const rarity = getItemRarity(item);
    showDialogue(`Equipped: <span style='color:${rarity.color}'>${item.name}</span>`);
  }
}

function getEquippedBonus(playerObj, type) {
  const eqId = playerObj.equipment[type];
  if (!eqId) return 0;
  const item = ITEMS.find(i => i.id === eqId || i.name === eqId);
  if (!item) return 0;
  return getItemRarity(item).bonus;
}

// --- Inventory / Quest / Stats UI ---
// updateUI removed; use updateInfoBar for stat updates

// --- Shop UI (with rarity) ---
const shopInventory = [
  { id: 3, name: "Potion", price: 5 },
  { id: 1, name: "Sword", price: 15 },
  { id: 4, name: "Epic Sword", price: 50 }
];

function openShop() {
  shopOpen = true;
  let html = `<div style='padding:8px'><b>Shop</b><br>`;
  updateInfoBar();
  shopInventory.forEach(item => {
    const realItem = ITEMS.find(i => i.id === item.id || i.name === item.name);
    const rarity = getItemRarity(realItem);
    html += `<span style='color:${rarity.color}'>${item.name}</span> - ${item.price} coins ` +
      `<button class='rpg-btn' onclick='buyItem(${item.id})'>Buy</button><br>`;
  });
  html += `<button class='rpg-btn' onclick='closeShop()'>Close</button></div>`;
  document.getElementById('dialoguePanel').innerHTML = html;
}

function closeShop() {
  shopOpen = false;
  document.getElementById('dialoguePanel').innerHTML = '';
}

function closeSettings() {
  settingsOpen = false;
  const overlay = document.getElementById('settingsOverlay');
  if (overlay) overlay.remove();
}

// --- Skill Tree System with Cooldowns ---
const SKILLS = [
  { id: 1, name: 'Fireball', desc: 'Damage all nearby enemies.', reqLevel: 1, unlocked: true, key: 'f', cooldown: 1000, lastUsed: 0 },
  { id: 2, name: 'Heal', desc: 'Restore HP to self.', reqLevel: 3, unlocked: false, key: 'h', cooldown: 2000, lastUsed: 0 },
  { id: 3, name: 'Lightning', desc: 'High damage to one enemy.', reqLevel: 5, unlocked: false, key: 'l', cooldown: 1500, lastUsed: 0 }
];

function unlockSkillsOnLevelUp() {
  const p = getActivePlayer();
  SKILLS.forEach(skill => {
    if (!skill.unlocked && p.level >= skill.reqLevel) {
      skill.unlocked = true;
      showAchievementPopup(`Skill Unlocked: ${skill.name}`);
    }
  });
}

function useSkill(skillId) {
  const p = getActivePlayer();
  const skill = SKILLS.find(s => s.id === skillId && s.unlocked);
  if (!skill) return;
  
  // Check cooldown
  const now = Date.now();
  if (now - skill.lastUsed < skill.cooldown) {
    const remaining = Math.ceil((skill.cooldown - (now - skill.lastUsed)) / 1000);
    showDialogue(`${skill.name} on cooldown for ${remaining}s`);
    return;
  }
  skill.lastUsed = now;
  
  // Set casting animation state
  p.isCasting = true;
  p.castStartTime = Date.now();
  setTimeout(() => {
    p.isCasting = false;
  }, 500); // Casting animation lasts 500ms

  if (skill.id === 1) { // Fireball
    spawnFireballProjectile(p);
    showDialogue('You cast Fireball!');
  } else if (skill.id === 2) { // Heal
    const healAmt = 10 + p.stats.int;
    p.hp = Math.min(p.maxHp, p.hp + healAmt);
    addDamageNumber(p.x, p.y - 20, healAmt, 'heal');
    addEffect('heal', p.x, p.y, '#3f3');
    for (let i = 0; i < 8; i++) {
      addParticle(p.x + (Math.random() - 0.5) * 40, p.y + (Math.random() - 0.5) * 40, 
                  (Math.random() - 0.5) * 1, Math.random() * 1, 'spark', '#3f3');
    }
    playSound('pickup', 0.3);
    showDialogue(`Healed for ${healAmt} HP!`);
    updateInfoBar();
  } else if (skill.id === 3) { // Lightning
    spawnLightningProjectile(p);
    showDialogue('You cast Lightning!');
  }
}

// --- Patch level up to unlock skills ---
function checkLevelUp() {
  const p = getActivePlayer();
  while (p.xp >= p.level * 10) {
    const xpToLevel = p.level * 10;
    p.xp -= xpToLevel;
    p.level += 1;
    p.statPoints = (p.statPoints || 0) + 3;
    showDialogue(`Level up! You are now level ${p.level}. +3 stat points!`);
    unlockSkillsOnLevelUp();
    updateInfoBar();
  }
}

// --- Skill Hotkeys ---
document.addEventListener('keydown', e => {
  if (!settingsOpen && !shopOpen) {
    if (e.key === 'f' && SKILLS[0].unlocked) useSkill(1);
    if (e.key === 'h' && SKILLS[1].unlocked) useSkill(2);
    if (e.key === 'l' && SKILLS[2].unlocked) useSkill(3);
  }
});

// --- Crafting System ---
const RECIPES = [
  { result: 4, components: [1, 2], name: 'Epic Sword', desc: 'Sword + Shield = Epic Sword' }
];

function canCraft(recipe) {
  const p = getActivePlayer();
  return recipe.components.every(cid => p.inventory.includes(cid));
}

function craftItem(recipeId) {
  const recipe = RECIPES.find(r => r.result === recipeId);
  if (!recipe) return;
  const p = getActivePlayer();
  if (canCraft(recipe)) {
    recipe.components.forEach(cid => {
      const idx = p.inventory.indexOf(cid);
      if (idx !== -1) p.inventory.splice(idx, 1);
    });
    addItemToInventory(recipe.result);
    const item = ITEMS.find(i => i.id === recipe.result);
    const rarity = getItemRarity(item);
    showDialogue(`Crafted: <span style='color:${rarity.color}'>${item.name}</span>!`);
  } else {
    showDialogue('Missing components for crafting!');
  }
}

// --- Settings / Skill Tree / Crafting UI ---
// --- Save/Load Game Stubs ---
function saveGame(slot) {
  // TODO: Implement actual save logic
  alert('Game saved to slot ' + slot + ' (stub)');
}

function loadGame(slot) {
  // TODO: Implement actual load logic
  alert('Game loaded from slot ' + slot + ' (stub)');
}
function openSettings() {
  if (settingsOpen) return;
  settingsOpen = true;
  const overlay = document.createElement('div');
  overlay.id = 'settingsOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(24,24,32,0.97)';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '2000';
  overlay.innerHTML = `
    <h2 style='color:#4af;margin-bottom:0.5em;'>Settings</h2>
    <button class='rpg-btn' onclick='toggleAudio()'>${audioEnabled ? 'Mute' : 'Unmute'} Sound</button><br><br>
    <div style='margin-bottom:1em;'>
      <b>Save Slots</b><br>
      <button class='rpg-btn' onclick='saveGame(1)'>Save 1</button>
      <button class='rpg-btn' onclick='saveGame(2)'>Save 2</button>
      <button class='rpg-btn' onclick='saveGame(3)'>Save 3</button><br>
      <button class='rpg-btn' onclick='loadGame(1)'>Load 1</button>
      <button class='rpg-btn' onclick='loadGame(2)'>Load 2</button>
      <button class='rpg-btn' onclick='loadGame(3)'>Load 3</button>
    </div>
    <div style='margin-bottom:1em;'>
      <b>Skill Tree</b><br>
      ${SKILLS.map(skill =>
        `<span style='color:${skill.unlocked ? '#4af' : '#888'}'>${skill.name}</span> (${skill.key.toUpperCase()}) - ${skill.desc} ${skill.unlocked ? '' : `(Unlocks at level ${skill.reqLevel})`}<br>`
      ).join('')}
    </div>
    <div style='margin-bottom:1em;'>
      <b>Crafting</b><br>
      ${RECIPES.map(recipe =>
        `<span>${recipe.name}:</span> <button class='rpg-btn' onclick='craftItem(${recipe.result})'>Craft</button><br>` +
        `<span style='color:#aaa;font-size:0.9em;'>${recipe.desc}</span><br>`
      ).join('')}
    </div>
    <button class='rpg-btn' onclick='closeSettings()'>Close</button>
    <p style='color:#aaa;margin-top:2em;font-size:0.9em;'>Press Escape to close</p>
  `;
  document.body.appendChild(overlay);
}

// --- Day/Night Cycle and Weather Effects (state only here) ---
let gameTime = 0; // 0-2399 (24h * 100)
// Functions like updateTimeAndWeather, drawDayNightOverlay, drawWeatherOverlay, drawTimeDisplay
// are assumed to exist in your base code.

/* ============================================================
   RPG ENGINE CORE (Movement, Map, Enemies, NPCs, Camera, Loop)
   ============================================================ */

/* -------------------------
   1. INPUT SYSTEM (WASD)
   ------------------------- */
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);


/* -------------------------


/* -------------------------
   3. PLAYER MOVEMENT WITH AREA TRANSITIONS
   ------------------------- */
function isColliding(x, y, radius = 15) {
  // Check village collision zones (image-based buildings/trees)
  if (currentArea === 'village' && !insideBuilding) {
    for (let zone of VILLAGE_COLLISION_ZONES) {
      const { x: zx, y: zy } = villageToCanvas(zone.xPct, zone.yPct);
      const { w: zw, h: zh } = villageSizeToCanvas(zone.wPct, zone.hPct);
      if (x + radius > zx && x - radius < zx + zw &&
          y + radius > zy && y - radius < zy + zh) {
        return true;
      }
    }
  }
  
  // Interior wall collision — keep player within a padded area
  if (insideBuilding) {
    const pad = 30;
    if (x - radius < pad || x + radius > canvas.width - pad ||
        y - radius < pad) {
      return true;
    }
  }
  
  // Check collision with NPCs
  for (let npc of npcs) {
    const dist = Math.hypot(x - npc.x, y - npc.y);
    if (dist < radius + 15) return true;
  }
  
  // Note: Enemies don't block movement - you can walk through them
  // Damage is handled on contact, not collision blocking
  
  // Check collision with decorative objects
  const decorations = generateAreaDecorations(currentArea);
  for (let dec of decorations) {
    let colliding = false;
    
    if (dec.type === 'building') {
      // Rectangular collision with building
      if (x - radius < dec.x + dec.width &&
          x + radius > dec.x &&
          y - radius < dec.y + dec.height &&
          y + radius > dec.y) {
        colliding = true;
      }
    } else if (dec.type === 'tree' || dec.type === 'boulder') {
      // Circular collision for trees and boulders
      const dist = Math.hypot(x - dec.x, y - dec.y);
      if (dist < radius + dec.size) colliding = true;
    } else if (dec.type === 'bush') {
      // Smaller collision radius for bushes
      const dist = Math.hypot(x - dec.x, y - dec.y);
      if (dist < radius + dec.size * 0.8) colliding = true;
    } else if (dec.type === 'crystal') {
      // Crystal collision
      const dist = Math.hypot(x - dec.x, y - dec.y);
      if (dist < radius + dec.size * 1.2) colliding = true;
    } else if (dec.type === 'lamppost') {
      // Small collision for lampposts
      const dist = Math.hypot(x - dec.x, y - dec.y);
      if (dist < radius + 8) colliding = true;
    }
    
    if (colliding) return true;
  }
  
  return false;
}

function updatePlayerMovement() {
  const p = getActivePlayer();
  const speed = 2;
  const playerRadius = 15;

  // Try to move in each direction independently to allow sliding along walls
  if (keys['ArrowUp'] || keys['w']) {
    if (!isColliding(p.x, p.y - speed, playerRadius)) {
      p.y -= speed;
    }
  }
  if (keys['ArrowDown'] || keys['s']) {
    if (!isColliding(p.x, p.y + speed, playerRadius)) {
      p.y += speed;
    }
  }
  if (keys['ArrowLeft'] || keys['a']) {
    if (!isColliding(p.x - speed, p.y, playerRadius)) {
      p.x -= speed;
    }
  }
  if (keys['ArrowRight'] || keys['d']) {
    if (!isColliding(p.x + speed, p.y, playerRadius)) {
      p.x += speed;
    }
  }

  // Check for area transitions
  checkAreaTransitions(p);
  
  // Simple world bounds (but allow exiting at edges)
  p.x = Math.max(-50, Math.min(canvas.width + 50, p.x));
  p.y = Math.max(-50, Math.min(canvas.height + 50, p.y));
}

function checkAreaTransitions(player) {
  // Block transitions until game is fully started and stable
  if (!window.gameStarted) return;
  if (typeof _gameFrameCount !== 'undefined' && _gameFrameCount < 120) return;
  if (canvas.width < 100 || canvas.height < 100) return;
  
  // Inside a building — handle exit at bottom edge
  if (insideBuilding) {
    if (player.y > canvas.height - 20) {
      exitBuilding();
    }
    // Clamp player inside interior
    player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
    player.y = Math.max(20, Math.min(canvas.height - 5, player.y));
    return;
  }
  
  // Check building entrances in village
  if (currentArea === 'village' && typeof BUILDING_ENTRANCES !== 'undefined') {
    BUILDING_ENTRANCES.forEach(b => {
      const { x: bx, y: by } = villageToCanvas(b.xPct, b.yPct);
      const { w: bw, h: bh } = villageSizeToCanvas(b.wPct, b.hPct);
      const dist = Math.hypot(player.x - (bx + bw/2), player.y - (by + bh/2));
      if (dist < 40 && window._enterBuildingPressed) {
        window._enterBuildingPressed = false;
        enterBuilding(b.id);
        return;
      }
    });
  }

  const areaConfig = AREA_CONFIG[currentArea];
  if (!areaConfig || !areaConfig.transitions) return;
  
  let newArea = null;
  let newPlayerPos = { x: player.x, y: player.y };
  
  // Left edge
  if (player.x < -30 && areaConfig.transitions.left) {
    newArea = areaConfig.transitions.left;
    newPlayerPos.x = canvas.width - 50;
    newPlayerPos.y = player.y;
  }
  
  // Right edge
  if (player.x > canvas.width + 30 && areaConfig.transitions.right) {
    newArea = areaConfig.transitions.right;
    newPlayerPos.x = 50;
    newPlayerPos.y = player.y;
  }
  
  // Up edge
  if (player.y < -30 && areaConfig.transitions.up) {
    newArea = areaConfig.transitions.up;
    newPlayerPos.x = player.x;
    newPlayerPos.y = canvas.height - 50;
  }
  
  // Down edge
  if (player.y > canvas.height + 30 && areaConfig.transitions.down) {
    newArea = areaConfig.transitions.down;
    newPlayerPos.x = player.x;
    newPlayerPos.y = 50;
  }
  
  if (newArea && newArea !== currentArea) {
    transitionToArea(newArea, newPlayerPos);
  }
}

function transitionToArea(newArea, playerPos) {
  currentArea = newArea;
  const p = getActivePlayer();
  p.x = playerPos.x;
  p.y = playerPos.y;
  
  // Update NPCs and enemies for new area
  npcs = getAreaNPCs(currentArea);
  spawnAreaEnemies(currentArea);
  
  // Show area transition message
  showDialogue(`Entered ${AREA_CONFIG[currentArea].name}!`);
}


/* -------------------------
   4. SIMPLE WORLD MAP WITH AREAS
   ------------------------- */

// Decorative elements - seeded randomly per area
const AREA_DECORATIONS = {};

function generateAreaDecorations(area) {
  if (AREA_DECORATIONS[area]) return AREA_DECORATIONS[area];
  
  const decorations = [];
  const seed = area.charCodeAt(0) + area.charCodeAt(area.length - 1);
  
  // Pseudo-random number generator based on seed
  let rng = seed;
  const seededRandom = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  
  // Generate decorations based on area
  if (area === 'village') {
    // Village uses tileset rendering — no generated decorations needed
  } else if (area === 'forest') {
    // Trees
    for (let i = 0; i < 12; i++) {
      decorations.push({
        type: 'tree',
        x: 50 + seededRandom() * (canvas.width - 100),
        y: 50 + seededRandom() * (canvas.height - 100),
        size: 20 + seededRandom() * 15
      });
    }
    // Bushes
    for (let i = 0; i < 8; i++) {
      decorations.push({
        type: 'bush',
        x: 50 + seededRandom() * (canvas.width - 100),
        y: 50 + seededRandom() * (canvas.height - 100),
        size: 10 + seededRandom() * 8
      });
    }
  } else if (area === 'cave') {
    // Crystals
    for (let i = 0; i < 10; i++) {
      decorations.push({
        type: 'crystal',
        x: 50 + seededRandom() * (canvas.width - 100),
        y: 50 + seededRandom() * (canvas.height - 100),
        size: 8 + seededRandom() * 12,
        color: `hsl(${200 + seededRandom() * 40}, 100%, ${40 + seededRandom() * 30}%)`
      });
    }
    // Stalactites
    for (let i = 0; i < 6; i++) {
      decorations.push({
        type: 'stalactite',
        x: 50 + seededRandom() * (canvas.width - 100),
        y: 10 + seededRandom() * 100,
        length: 30 + seededRandom() * 40
      });
    }
  } else if (area === 'mountains') {
    // Boulders
    for (let i = 0; i < 8; i++) {
      decorations.push({
        type: 'boulder',
        x: 50 + seededRandom() * (canvas.width - 100),
        y: 50 + seededRandom() * (canvas.height - 100),
        size: 20 + seededRandom() * 20
      });
    }
    // Snow patches
    for (let i = 0; i < 15; i++) {
      decorations.push({
        type: 'snow',
        x: 50 + seededRandom() * (canvas.width - 100),
        y: 50 + seededRandom() * (canvas.height - 100),
        size: 15 + seededRandom() * 20
      });
    }
  }
  
  AREA_DECORATIONS[area] = decorations;
  return decorations;
}

function drawAreaDecorations() {
  const decorations = generateAreaDecorations(currentArea);
  
  ctx.save();
  
  decorations.forEach(dec => {
    if (dec.type === 'tree') {
      // Tree trunk
      ctx.fillStyle = '#654321';
      ctx.fillRect(dec.x - dec.size * 0.15, dec.y + dec.size * 0.3, dec.size * 0.3, dec.size * 0.6);
      // Tree foliage
      ctx.fillStyle = '#1a5a1a';
      ctx.beginPath();
      ctx.arc(dec.x, dec.y, dec.size, 0, Math.PI * 2);
      ctx.fill();
      // Darker shade for depth
      ctx.fillStyle = '#0d3a0d';
      ctx.beginPath();
      ctx.arc(dec.x, dec.y + dec.size * 0.2, dec.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (dec.type === 'bush') {
      ctx.fillStyle = '#2a6a2a';
      ctx.beginPath();
      ctx.arc(dec.x, dec.y, dec.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a4a1a';
      ctx.beginPath();
      ctx.arc(dec.x - dec.size * 0.3, dec.y, dec.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dec.x + dec.size * 0.3, dec.y, dec.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (dec.type === 'building') {
      // Walls
      ctx.fillStyle = dec.color;
      ctx.fillRect(dec.x, dec.y, dec.width, dec.height);
      // Roof
      ctx.fillStyle = '#8b4513';
      ctx.beginPath();
      ctx.moveTo(dec.x - dec.width * 0.1, dec.y);
      ctx.lineTo(dec.x + dec.width / 2, dec.y - dec.height * 0.3);
      ctx.lineTo(dec.x + dec.width + dec.width * 0.1, dec.y);
      ctx.closePath();
      ctx.fill();
      // Door
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(dec.x + dec.width * 0.35, dec.y + dec.height * 0.5, dec.width * 0.3, dec.height * 0.4);
      // Window
      ctx.fillStyle = '#ffff99';
      ctx.fillRect(dec.x + dec.width * 0.15, dec.y + dec.height * 0.2, dec.width * 0.2, dec.height * 0.2);
    } else if (dec.type === 'lamppost') {
      // Post
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dec.x, dec.y + 30);
      ctx.lineTo(dec.x, dec.y - 30);
      ctx.stroke();
      // Light
      ctx.fillStyle = 'rgba(255, 255, 150, 0.3)';
      ctx.beginPath();
      ctx.arc(dec.x, dec.y - 30, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(dec.x, dec.y - 30, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (dec.type === 'crystal') {
      ctx.fillStyle = dec.color;
      // Crystal shape (rotated square)
      ctx.save();
      ctx.translate(dec.x, dec.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-dec.size / 2, -dec.size / 2, dec.size, dec.size);
      ctx.restore();
      // Glow
      ctx.fillStyle = dec.color.replace(')', ', 0.4)').replace('hsl', 'hsla');
      ctx.beginPath();
      ctx.arc(dec.x, dec.y, dec.size * 1.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (dec.type === 'stalactite') {
      ctx.strokeStyle = '#7a7a7a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(dec.x, dec.y);
      ctx.lineTo(dec.x + (Math.random() - 0.5) * 8, dec.y + dec.length);
      ctx.stroke();
      ctx.strokeStyle = '#5a5a5a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dec.x, dec.y);
      ctx.lineTo(dec.x + (Math.random() - 0.5) * 8, dec.y + dec.length);
      ctx.stroke();
    } else if (dec.type === 'boulder') {
      ctx.fillStyle = '#7a7a6a';
      ctx.beginPath();
      ctx.arc(dec.x, dec.y, dec.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a5a5a';
      ctx.beginPath();
      ctx.arc(dec.x - dec.size * 0.3, dec.y - dec.size * 0.3, dec.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (dec.type === 'snow') {
      ctx.fillStyle = 'rgba(230, 240, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(dec.x, dec.y, dec.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(200, 220, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(dec.x - dec.size * 0.2, dec.y, dec.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  ctx.restore();
}

function drawMap() {
  const areaConfig = AREA_CONFIG[currentArea];
  
  // Inside a building: draw interior background
  if (insideBuilding && currentArea === 'village') {
    const drawn = drawBuildingInterior(insideBuilding);
    if (!drawn) {
      ctx.fillStyle = '#2a1a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Interior area label
    const label = BUILDING_ENTRANCES.find(b => b.id === insideBuilding)?.label || 'Interior';
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 220, 50);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(label, 20, 30);
    ctx.fillStyle = '#aaa';
    ctx.font = '12px Arial';
    ctx.fillText('Walk to bottom edge to exit', 20, 45);
    ctx.restore();
    return;
  }
  
  // Village exterior: use background image
  if (currentArea === 'village' && typeof drawVillageTiles === 'function') {
    const drawn = drawVillageTiles();
    if (!drawn) {
      ctx.fillStyle = areaConfig ? areaConfig.color : '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    // Other areas: use solid color + environment patches
    ctx.fillStyle = areaConfig ? areaConfig.color : '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = currentArea === 'forest' ? '#1a2a1a' : currentArea === 'cave' ? '#3a3a4a' : '#3a3a2a';
    const cols = Math.floor(canvas.width / 80);
    const rows = Math.floor(canvas.height / 80);
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        ctx.fillRect(x * 80 + 10, y * 80 + 10, 60, 60);
      }
    }
  }
  
  // Draw area-specific decorations (village skipped since tileset handles it)
  if (currentArea !== 'village') {
    drawAreaDecorations();
  }
  
  // Draw transition zones and labels
  drawTransitionZones();
  drawAreaLabel();
}

function drawTransitionZones() {
  const areaConfig = AREA_CONFIG[currentArea];
  if (!areaConfig || !areaConfig.transitions) return;
  
  ctx.save();
  ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
  ctx.strokeStyle = 'rgba(100, 150, 255, 0.6)';
  ctx.lineWidth = 2;
  
  // Left
  if (areaConfig.transitions.left) {
    ctx.fillRect(0, canvas.height / 2 - 40, TRANSITION_SIZE, 80);
    ctx.strokeRect(0, canvas.height / 2 - 40, TRANSITION_SIZE, 80);
    ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
    ctx.font = '10px Arial';
    ctx.fillText('←', 5, canvas.height / 2 + 5);
  }
  
  // Right
  if (areaConfig.transitions.right) {
    ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
    ctx.fillRect(canvas.width - TRANSITION_SIZE, canvas.height / 2 - 40, TRANSITION_SIZE, 80);
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.6)';
    ctx.strokeRect(canvas.width - TRANSITION_SIZE, canvas.height / 2 - 40, TRANSITION_SIZE, 80);
    ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
    ctx.font = '10px Arial';
    ctx.fillText('→', canvas.width - 15, canvas.height / 2 + 5);
  }
  
  // Up
  if (areaConfig.transitions.up) {
    ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
    ctx.fillRect(canvas.width / 2 - 40, 0, 80, TRANSITION_SIZE);
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.6)';
    ctx.strokeRect(canvas.width / 2 - 40, 0, 80, TRANSITION_SIZE);
    ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
    ctx.font = '10px Arial';
    ctx.fillText('↑', canvas.width / 2 - 5, 15);
  }
  
  // Down
  if (areaConfig.transitions.down) {
    ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
    ctx.fillRect(canvas.width / 2 - 40, canvas.height - TRANSITION_SIZE, 80, TRANSITION_SIZE);
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.6)';
    ctx.strokeRect(canvas.width / 2 - 40, canvas.height - TRANSITION_SIZE, 80, TRANSITION_SIZE);
    ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
    ctx.font = '10px Arial';
    ctx.fillText('↓', canvas.width / 2 - 5, canvas.height - 5);
  }
  
  ctx.restore();
}

function drawAreaLabel() {
  const areaConfig = AREA_CONFIG[currentArea];
  if (!areaConfig) return;
  
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, 10, 220, 50);
  ctx.fillStyle = '#4af';
  ctx.font = 'bold 16px Arial';
  ctx.fillText(areaConfig.name, 20, 30);
  ctx.fillStyle = '#aaa';
  ctx.font = '12px Arial';
  ctx.fillText(areaConfig.description, 20, 45);
  ctx.restore();
}


/* -------------------------
   5. ENEMY SYSTEM
   ------------------------- */
// Enemy type definitions with stats and loot tables
const ENEMY_TYPES = {
  goblin: { hp: 8, speed: 1.5, color: '#e44', damage: 1, xpReward: 5, sizeScale: 0.8, lootTable: [{ type: 'coin', count: 1, rate: 0.8 }, { type: 'item', id: 3, rate: 0.15 }] },
  orc: { hp: 15, speed: 1.0, color: '#e83', damage: 2, xpReward: 8, sizeScale: 1.1, lootTable: [{ type: 'coin', count: 2, rate: 0.9 }, { type: 'item', id: 1, rate: 0.2 }] },
  troll: { hp: 25, speed: 0.7, color: '#ee3', damage: 3, xpReward: 12, sizeScale: 1.5, lootTable: [{ type: 'coin', count: 3, rate: 0.95 }, { type: 'item', id: 4, rate: 0.25 }, { type: 'item', id: 2, rate: 0.1 }] }
};

function spawnEnemy(x, y, type = 'goblin') {
  const enemyData = ENEMY_TYPES[type] || ENEMY_TYPES.goblin;
  enemies.push({
    x, y,
    type,
    hp: enemyData.hp,
    maxHp: enemyData.hp,
    alive: true,
    speed: enemyData.speed,
    damage: enemyData.damage,
    xpReward: enemyData.xpReward,
    lootTable: enemyData.lootTable,
    targetPlayer: false
  });
}

function spawnAreaEnemies(area) {
  enemies.length = 0; // Clear existing enemies
  const enemyTypes = getAreaEnemies(area);
  const spacing = Math.floor(canvas.width / (enemyTypes.length + 1));
  for (let i = 0; i < enemyTypes.length; i++) {
    spawnEnemy(spacing * (i + 1), Math.floor(canvas.height / 2) + (Math.random() * 100 - 50), enemyTypes[i]);
  }
}

// Spawn initial enemies
spawnAreaEnemies(currentArea);

function updateEnemiesAI() {
  const p = getActivePlayer();
  enemies.forEach(enemy => {
    if (!enemy.alive) return;
    // Don't move enemies during battle
    if (typeof battleActive !== 'undefined' && battleActive) return;
    const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
    if (dist < 180) {
      enemy.targetPlayer = true;
    } else {
      enemy.targetPlayer = false;
    }
    if (enemy.targetPlayer && dist > 12) {
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const mag = Math.hypot(dx, dy);
      enemy.x += (dx / mag) * enemy.speed;
      enemy.y += (dy / mag) * enemy.speed;
    }
    // Trigger turn-based battle on contact
    if (dist < 24 && typeof startBattle === 'function' && !(typeof battleActive !== 'undefined' && battleActive)) {
      startBattle(enemy);
    }
  });
}

// Patch gameLoop to update enemy AI
if (typeof gameLoop !== 'undefined') {
  const origGameLoop = gameLoop;
  gameLoop = function () {
    if (paused) return;
    updateEnemiesAI();
    origGameLoop();
  };
}

// --- Unified Game Loop Patch ---
let _gameFrameCount = 0;
let _hasForceReset = false;
gameLoop = function () {
  // Don't run game logic during intro cutscene
  if (typeof introActive !== 'undefined' && introActive) return;
  if (!window.gameStarted) {
    _gameFrameCount = 0;
    _hasForceReset = false;
    if (typeof updateInfoBar === 'function') updateInfoBar();
    return;
  }
  // Force reset on the very first frame after gameStarted
  if (!_hasForceReset) {
    _hasForceReset = true;
    currentArea = 'village';
    player.x = Math.max(60, Math.min((canvas.width || 800) / 2, (canvas.width || 800) - 60));
    player.y = Math.max(60, Math.min((canvas.height || 600) / 2, (canvas.height || 600) - 60));
    Object.keys(keys).forEach(k => keys[k] = false);
    console.log('[RPG] Force reset on first frame: area=' + currentArea + ' pos=(' + Math.round(player.x) + ',' + Math.round(player.y) + ') canvas=(' + canvas.width + 'x' + canvas.height + ')');
  }
  _gameFrameCount++;
  if (paused) return;
  // --- Turn-based battle takes over rendering ---
  if (typeof battleActive !== 'undefined' && battleActive) {
    updateBattle(16.67); // ~60fps dt
    renderBattle(ctx);
    if (typeof updateInfoBar === 'function') updateInfoBar();
    return;
  }
  // Update animation
  updateAnimationFrame();
  // Update movement and AI
  updatePlayerMovement();
  updateEnemiesAI();
  updateSpellProjectiles();
  // Draw map and entities
  drawMap();
  drawPlayer();
  drawNPCs();
  drawEnemies();
  drawSpellProjectiles();
  drawLoot();
  drawEffects();
  drawDamageNumbers();
  drawParticles();
  // Overlays / minimap / time
  drawMinimap();
  if (typeof updateTimeAndWeather === 'function') updateTimeAndWeather();
  if (typeof drawDayNightOverlay === 'function') drawDayNightOverlay();
  if (typeof drawWeatherOverlay === 'function') drawWeatherOverlay();
  if (typeof drawTimeDisplay === 'function') drawTimeDisplay();
  // Always update info bar at top
  if (typeof updateInfoBar === 'function') updateInfoBar();
};

// End of unified rpg.js
// --- Start Main Game Loop ---
function mainLoop() {
  if (typeof gameLoop === 'function') gameLoop();
  requestAnimationFrame(mainLoop);
}

window.addEventListener('DOMContentLoaded', () => {
  const btn = document.createElement('button');
  btn.id = 'pauseBtn';
  btn.textContent = 'Pause';
  btn.style.position = 'absolute';
  btn.style.top = '18px';
  btn.style.left = '18px';
  btn.style.zIndex = 200;
  btn.onclick = togglePause;
  document.body.appendChild(btn);

  // Remove any previously injected overlay panel
  const oldStatsPanel = document.getElementById('statsPanel');
  if (oldStatsPanel) oldStatsPanel.remove();
  
  // Initialize HP display
  updateInfoBar();
  mainLoop();
});

// Test key handler removed - use 'n' to attack nearby NPC

// Add a dialogue panel for messages if missing
if (!document.getElementById('dialoguePanel')) {
  const panel = document.createElement('div');
  panel.id = 'dialoguePanel';
  panel.style.position = 'fixed';
  panel.style.bottom = '120px';
  panel.style.left = '50%';
  panel.style.transform = 'translateX(-50%)';
  panel.style.background = 'rgba(40,40,40,0.92)';
  panel.style.color = '#fff';
  panel.style.padding = '12px 24px';
  panel.style.borderRadius = '10px';
  panel.style.zIndex = 999;
  panel.style.fontSize = '1.1em';
  panel.style.minWidth = '220px';
  panel.style.textAlign = 'center';
  panel.style.display = 'none';
  document.body.appendChild(panel);
}

// Patch showDialogue to display and auto-hide
window.showDialogue = function(text) {
  const panel = document.getElementById('dialoguePanel');
  if (!panel) return;
  panel.innerHTML = text;
  panel.style.display = 'block';
  setTimeout(() => { panel.style.display = 'none'; }, 1800);
};

function showGameOverScreen() {
  let overlay = document.getElementById('gameOverOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gameOverOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.zIndex = 2000;
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="font-size:4em;color:#e22;font-weight:bold;margin-bottom:0.5em;text-shadow:2px 2px 8px #000;">GAME OVER</div>
    <div style="margin-bottom:2em;"></div>
    <button id="continueBtn" style="font-size:1.5em;color:#fff;background:transparent;border:none;margin-bottom:0.5em;cursor:pointer;">Continue</button><br>
    <button id="mainMenuBtn" style="font-size:1.5em;color:#fff;background:transparent;border:none;cursor:pointer;">Main Menu</button>
  `;
  overlay.style.display = 'flex';
  document.getElementById('continueBtn').onclick = () => {
    overlay.style.display = 'none';
    respawnPlayer && respawnPlayer();
  };
  document.getElementById('mainMenuBtn').onclick = () => {
    window.location.reload();
  };
}

function respawnPlayer() {
  const p = getActivePlayer();
  p.hp = p.maxHp;
  updateInfoBar && updateInfoBar();
}

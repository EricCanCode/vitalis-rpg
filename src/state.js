import { ABILITY_UNLOCKS, AREAS, BESTIARY, ITEMS, LOOT_TABLES, NPC_DIALOGUE, PARTY_TEMPLATE, QUESTS, SPELLS, STORY_EVENTS, WEAPONS } from './data.js';

const SAVE_KEY = 'vitalis-rpg-v2-save';

export function createGameState() {
  return {
    scene: 'town',
    gold: 65,
    inventory: { potion: 4, ether: 1, fire_bomb: 1, vitalis_shard: 0, weapons: ['iron_sword', 'ember_staff', 'guardian_mace', 'twin_daggers'] },
    currentAreaId: 'forest_road',
    areaProgress: createAreaProgress(),
    party: structuredClone(PARTY_TEMPLATE),
    battle: null,
    lastReward: null,
    lastSavedAt: null,
    bestiary: {},
    storyEvents: ['prologue'],
    titleSeen: false,
    log: ['The party gathers in the village. The road beyond is restless.']
  };
}

function createAreaProgress() {
  return Object.fromEntries(AREAS.map(area => [area.id, { wins: 0, nextEncounter: 0, searched: false }]));
}

export let gameState = loadGame() || createGameState();

export function resetGame() {
  gameState = createGameState();
  saveGame();
}

export function saveGame() {
  gameState.lastSavedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!Array.isArray(save.party)) return null;
    return hydrateSave(save);
  } catch {
    return null;
  }
}

function hydrateSave(save) {
  const fresh = createGameState();
  save.party = fresh.party.map(template => {
    const member = {
      ...template,
      ...(save.party.find(savedMember => savedMember.id === template.id) || {})
    };
    applyAbilityUnlocks(member);
    return member;
  });
  save.inventory = { ...fresh.inventory, ...(save.inventory || {}) };
  save.inventory.weapons = Array.from(new Set([...(fresh.inventory.weapons || []), ...(save.inventory.weapons || [])]));
  save.storyEvents = Array.from(new Set([...(fresh.storyEvents || []), ...(save.storyEvents || [])]));
  save.bestiary = { ...fresh.bestiary, ...(save.bestiary || {}) };
  save.areaProgress = mergeAreaProgress(fresh.areaProgress, save);
  save.currentAreaId = AREAS.some(area => area.id === save.currentAreaId) ? save.currentAreaId : fresh.currentAreaId;
  save.log = Array.isArray(save.log) ? save.log : fresh.log;
  save.scene = save.scene || fresh.scene;
  if (save.battle) {
    save.battle.intents = save.battle.intents || {};
    save.battle.lastFx = save.battle.lastFx || null;
    save.battle.shield = save.battle.shield || 0;
  }
  return { ...fresh, ...save };
}

function mergeAreaProgress(freshProgress, save) {
  const savedProgress = save.areaProgress || {};
  const merged = structuredClone(freshProgress);
  Object.keys(merged).forEach(areaId => {
    merged[areaId] = {
      ...merged[areaId],
      ...(savedProgress[areaId] || {})
    };
  });
  if (!save.areaProgress && typeof save.encounterIndex === 'number') {
    merged.forest_road.wins = Math.min(save.encounterIndex, 2);
    merged.forest_road.nextEncounter = save.encounterIndex;
  }
  return merged;
}

export function pushLog(message) {
  gameState.log.unshift(message);
  gameState.log = gameState.log.slice(0, 14);
}

export function getWeapon(character) {
  return WEAPONS[character.weapon] || WEAPONS.iron_sword;
}

export function xpToNextLevel(character) {
  return character.level * 32;
}

export function livingParty() {
  return gameState.party.filter(member => member.hp > 0);
}

export function completedQuestCount() {
  return QUESTS.filter(quest => getQuestProgress(quest.id).complete).length;
}

export function isAreaUnlocked(areaId) {
  const area = AREAS.find(entry => entry.id === areaId);
  if (!area) return false;
  return completedQuestCount() >= area.unlocksAt;
}

export function getUnlockedAreas() {
  return AREAS.filter(area => isAreaUnlocked(area.id));
}

export function getQuestProgress(questId) {
  const quest = QUESTS.find(entry => entry.id === questId);
  const areaProgress = quest ? gameState.areaProgress[quest.areaId] : null;
  const wins = areaProgress?.wins || 0;
  const requiredWins = quest?.requiredWins || 1;
  return {
    quest,
    wins,
    requiredWins,
    complete: wins >= requiredWins,
    percent: Math.min(100, Math.round((wins / requiredWins) * 100))
  };
}

export function averagePartyLevel() {
  const total = gameState.party.reduce((sum, member) => sum + member.level, 0);
  return Math.max(1, Math.round(total / gameState.party.length));
}

export function getAreaReadiness(areaId) {
  const area = AREAS.find(entry => entry.id === areaId);
  if (!area) return { label: 'Unknown', tone: 'locked', detail: 'No route data.' };
  if (!isAreaUnlocked(areaId)) return { label: 'Locked', tone: 'locked', detail: 'Complete the previous objective.' };
  const averageLevel = averagePartyLevel();
  const gap = averageLevel - area.recommendedLevel;
  if (gap >= 1) return { label: 'Safe', tone: 'safe', detail: `Recommended Lv ${area.recommendedLevel}. Party Lv ${averageLevel}.` };
  if (gap === 0) return { label: 'Ready', tone: 'ready', detail: `Recommended Lv ${area.recommendedLevel}. Party Lv ${averageLevel}.` };
  return { label: 'Danger', tone: 'danger', detail: `Recommended Lv ${area.recommendedLevel}. Party Lv ${averageLevel}. Rest and stock supplies.` };
}

export function getNextEncounterPreview(areaId) {
  const area = AREAS.find(entry => entry.id === areaId);
  if (!area) return null;
  const progress = gameState.areaProgress[area.id] || { nextEncounter: 0 };
  const encounter = area.encounters[progress.nextEncounter % area.encounters.length];
  return {
    area,
    encounter,
    enemies: encounter.enemies.map(enemy => enemy.name)
  };
}

export function getBestiaryEntries() {
  return Object.entries(BESTIARY).map(([type, entry]) => ({
    type,
    ...entry,
    discovered: !!gameState.bestiary[type]?.discovered,
    defeated: gameState.bestiary[type]?.defeated || 0
  }));
}

function discoverEnemyType(enemyType, defeated = 0) {
  if (!enemyType) return;
  const current = gameState.bestiary[enemyType] || { discovered: false, defeated: 0 };
  gameState.bestiary[enemyType] = {
    discovered: true,
    defeated: current.defeated + defeated
  };
}

function discoverEnemies(enemies) {
  enemies.forEach(enemy => discoverEnemyType(enemy.type));
}

export function scoutArea(areaId) {
  const preview = getNextEncounterPreview(areaId);
  if (!preview || !isAreaUnlocked(areaId)) return null;
  discoverEnemies(preview.encounter.enemies);
  pushLog(`Scouted ${preview.area.name}: ${preview.enemies.join(', ')}.`);
  saveGame();
  return preview;
}

export function searchAreaCache(areaId) {
  const area = AREAS.find(entry => entry.id === areaId);
  if (!area || !isAreaUnlocked(areaId)) return false;
  const progress = gameState.areaProgress[areaId];
  if (progress.searched) {
    pushLog(`${area.name} has already been searched before this encounter.`);
    return false;
  }
  const itemId = area.fieldEvent?.cacheItemId || 'potion';
  const item = ITEMS[itemId];
  progress.searched = true;
  gameState.inventory[itemId] = (gameState.inventory[itemId] || 0) + 1;
  pushLog(`Found one ${item.name} while searching ${area.name}.`);
  saveGame();
  return true;
}

export function selectArea(areaId) {
  if (!isAreaUnlocked(areaId)) {
    pushLog('That path is still locked.');
    return false;
  }
  gameState.currentAreaId = areaId;
  saveGame();
  return true;
}

export function startEncounter(areaId = gameState.currentAreaId) {
  if (!selectArea(areaId)) return false;
  const area = AREAS.find(entry => entry.id === gameState.currentAreaId) || AREAS[0];
  const progress = gameState.areaProgress[area.id] || { wins: 0, nextEncounter: 0 };
  const encounter = structuredClone(area.encounters[progress.nextEncounter % area.encounters.length]);
  discoverEnemies(encounter.enemies);
  gameState.battle = {
    areaId: area.id,
    encounter,
    enemies: encounter.enemies,
    turn: 'party',
    actorIndex: nextLivingPartyIndex(0),
    guarding: {},
    rally: 0,
    shield: 0,
    intents: {},
    lastFx: null,
    won: false,
    lost: false
  };
  chooseEnemyIntents();
  gameState.scene = 'battle';
  pushLog(`${encounter.name} begins.`);
  saveGame();
  return true;
}

export function endBattleVictory() {
  const completedBefore = completedQuestCount();
  const defeated = gameState.battle.enemies.filter(enemy => enemy.hp <= 0);
  const beforeParty = gameState.party.map(member => ({
    id: member.id,
    level: member.level,
    spells: [...member.spells]
  }));
  defeated.forEach(enemy => discoverEnemyType(enemy.type, 1));
  const xp = defeated.reduce((sum, enemy) => sum + enemy.xp, 0);
  const gold = defeated.reduce((sum, enemy) => sum + enemy.gold, 0);
  const areaId = gameState.battle.areaId || gameState.currentAreaId;
  const area = AREAS.find(entry => entry.id === areaId);
  if (!gameState.areaProgress[areaId]) gameState.areaProgress[areaId] = { wins: 0, nextEncounter: 0 };
  gameState.areaProgress[areaId].wins += 1;
  gameState.areaProgress[areaId].nextEncounter += 1;
  gameState.areaProgress[areaId].searched = false;
  gameState.gold += gold;
  const loot = grantLoot(defeated);
  livingParty().forEach(member => addXp(member, xp));
  const levelUps = gameState.party.map(member => {
    const before = beforeParty.find(entry => entry.id === member.id);
    const learned = member.spells.filter(spellId => !before?.spells.includes(spellId));
    return {
      id: member.id,
      name: member.name,
      from: before?.level || member.level,
      to: member.level,
      learned
    };
  }).filter(entry => entry.to > entry.from || entry.learned.length > 0);
  gameState.battle.won = true;
  gameState.lastReward = { areaId, xp, gold, loot, progress: gameState.areaProgress[areaId].wins, levelUps };
  pushLog(`Victory. The party earns ${xp} XP and ${gold} gold.`);
  if (completedQuestCount() > completedBefore && area) {
    const quest = QUESTS.find(entry => entry.areaId === area.id);
    unlockStoryEvent(quest.id);
    if (quest.id === 'claim-crystal') gameState.inventory.vitalis_shard = (gameState.inventory.vitalis_shard || 0) + 1;
    pushLog(`${quest.title} complete. ${quest.reward}.`);
  }
  saveGame();
}

function grantLoot(defeatedEnemies) {
  const found = {};
  defeatedEnemies.forEach(enemy => {
    (LOOT_TABLES[enemy.type] || []).forEach(drop => {
      if (Math.random() <= drop.chance) {
        found[drop.itemId] = (found[drop.itemId] || 0) + drop.quantity;
      }
    });
  });
  Object.entries(found).forEach(([itemId, quantity]) => {
    const item = ITEMS[itemId];
    gameState.inventory[itemId] = (gameState.inventory[itemId] || 0) + quantity;
    pushLog(`Found ${quantity} ${item.name}${quantity > 1 ? 's' : ''}.`);
  });
  return Object.entries(found).map(([itemId, quantity]) => ({ itemId, quantity }));
}

function unlockStoryEvent(eventId) {
  if (!gameState.storyEvents.includes(eventId)) {
    gameState.storyEvents.push(eventId);
    const event = STORY_EVENTS.find(entry => entry.id === eventId);
    if (event) pushLog(`Journal updated: ${event.title}.`);
  }
}

export function returnToTown() {
  gameState.battle = null;
  gameState.scene = 'town';
  saveGame();
}

export function camp() {
  if (gameState.gold < 10) {
    pushLog('The innkeeper asks for 10 gold. You are short.');
    return false;
  }
  gameState.gold -= 10;
  gameState.party.forEach(member => {
    member.hp = member.maxHp;
    member.mp = member.maxMp;
  });
  pushLog('The party rests at the inn and recovers.');
  saveGame();
  return true;
}

export function buyPotion() {
  return buyItem('potion');
}

export function buyItem(itemId) {
  const item = ITEMS[itemId];
  if (!item || item.kind === 'key') return false;
  if (gameState.gold < item.cost) {
    pushLog(`${item.name} costs ${item.cost} gold.`);
    return false;
  }
  gameState.gold -= item.cost;
  gameState.inventory[itemId] = (gameState.inventory[itemId] || 0) + 1;
  pushLog(`Bought one ${item.name}.`);
  saveGame();
  return true;
}

export function equipWeapon(characterId, weaponId) {
  const character = gameState.party.find(member => member.id === characterId);
  const weapon = WEAPONS[weaponId];
  if (!character || !weapon) return false;
  const ownsWeapon = gameState.inventory.weapons.includes(weaponId);
  if (character.weapon === weaponId) {
    pushLog(`${character.name} already has ${weapon.name} equipped.`);
    return true;
  }
  if (!ownsWeapon && weapon.cost > 0 && gameState.gold < weapon.cost) {
    pushLog(`${weapon.name} costs ${weapon.cost} gold.`);
    return false;
  }
  if (!ownsWeapon && weapon.cost > 0) {
    gameState.gold -= weapon.cost;
    gameState.inventory.weapons.push(weaponId);
    pushLog(`Bought ${weapon.name}.`);
  }
  character.weapon = weaponId;
  pushLog(`${character.name} equips ${weapon.name}.`);
  saveGame();
  return true;
}

export function getAbilityUnlocks(characterId) {
  return ABILITY_UNLOCKS.filter(unlock => unlock.characterId === characterId)
    .map(unlock => ({ ...unlock, spell: SPELLS[unlock.spellId] }));
}

export function getStoryEvents() {
  return gameState.storyEvents
    .map(eventId => STORY_EVENTS.find(event => event.id === eventId))
    .filter(Boolean);
}

export function getNpcDialogue(npcId) {
  const npc = NPC_DIALOGUE[npcId];
  if (!npc) return null;
  const lineIndex = Math.min(completedQuestCount(), npc.lines.length - 1);
  return { name: npc.name, line: npc.lines[lineIndex] };
}

export function partyAttack(targetId) {
  const battle = gameState.battle;
  const actor = gameState.party[battle.actorIndex];
  const target = battle.enemies.find(enemy => enemy.id === targetId && enemy.hp > 0) || firstLivingEnemy();
  if (!actor || !target) return;
  const weapon = getWeapon(actor);
  const damage = Math.max(1, actor.stats.atk + weapon.atk + battle.rally - target.def + roll(1, 4));
  target.hp = Math.max(0, target.hp - damage);
  setFx('hit', target.id, damage, `-${damage}`, actor.id);
  pushLog(`${actor.name} strikes ${target.name} for ${damage}.`);
  afterPartyAction();
}

export function castSpell(spellId, targetId) {
  const battle = gameState.battle;
  const actor = gameState.party[battle.actorIndex];
  const spell = SPELLS[spellId];
  if (!actor || !spell || actor.mp < spell.mp) {
    pushLog('Not enough MP.');
    return;
  }
  if (spell.target === 'ally') {
    const target = gameState.party.find(member => member.id === targetId && member.hp > 0) || actor;
    if (target.hp >= target.maxHp) {
      pushLog(`${target.name} is already at full HP.`);
      return;
    }
  }
  actor.mp -= spell.mp;

  if (spell.target === 'enemy') {
    const target = battle.enemies.find(enemy => enemy.id === targetId && enemy.hp > 0) || firstLivingEnemy();
    if (!target) return;
    const weapon = getWeapon(actor);
    const statValue = spell.stat === 'atk' ? actor.stats.atk + weapon.atk : actor.stats.mag + weapon.mag;
    const damage = Math.max(2, statValue + spell.power - target.def + roll(1, 5));
    target.hp = Math.max(0, target.hp - damage);
    if (spell.id === 'guard_break') target.def = Math.max(0, target.def - 1);
    setFx(spell.id === 'guard_break' ? 'break' : 'magic', target.id, damage, `-${damage}`, actor.id);
    pushLog(`${actor.name} casts ${spell.name} for ${damage}.`);
  }

  if (spell.target === 'allEnemies') {
    const weapon = getWeapon(actor);
    let total = 0;
    battle.enemies.filter(enemy => enemy.hp > 0).forEach(enemy => {
      const statValue = spell.stat === 'atk' ? actor.stats.atk + weapon.atk : actor.stats.mag + weapon.mag;
      const damage = Math.max(2, statValue + spell.power - enemy.def + roll(1, 4));
      enemy.hp = Math.max(0, enemy.hp - damage);
      total += damage;
    });
    setFx('wave', 'allEnemies', total, `-${total}`, actor.id);
    pushLog(`${actor.name} casts ${spell.name} across the field.`);
  }

  if (spell.target === 'ally') {
    const target = gameState.party.find(member => member.id === targetId && member.hp > 0) || actor;
    const heal = spell.power + actor.stats.mag + roll(2, 6);
    target.hp = Math.min(target.maxHp, target.hp + heal);
    setFx('heal', target.id, heal, `+${heal}`, actor.id);
    pushLog(`${actor.name} restores ${heal} HP to ${target.name}.`);
  }

  if (spell.target === 'party') {
    battle.rally = Math.max(battle.rally, 3);
    setFx('buff', 'allParty', spell.power, 'Rally', actor.id);
    pushLog(`${actor.name} rallies the party. Attack rises.`);
  }

  if (spell.target === 'partyShield') {
    battle.shield = Math.max(battle.shield, spell.power);
    setFx('shield', 'allParty', spell.power, 'Shield', actor.id);
    pushLog(`${actor.name} shields the party. Incoming damage falls.`);
  }

  afterPartyAction();
}

export function guard() {
  const battle = gameState.battle;
  const actor = gameState.party[battle.actorIndex];
  battle.guarding[actor.id] = true;
  setFx('guard', actor.id, 0, 'Guard', actor.id);
  pushLog(`${actor.name} guards.`);
  afterPartyAction();
}

export function usePotion(targetId) {
  return useItem('potion', targetId);
}

export function useItem(itemId, targetId) {
  const item = ITEMS[itemId];
  if (!item || item.kind === 'key' || (gameState.inventory[itemId] || 0) <= 0) {
    pushLog(`${item?.name || 'That item'} is not available.`);
    return false;
  }
  if (item.kind === 'heal') return useHealingItem(item, targetId);
  if (item.kind === 'mp') return useMpItem(item, targetId);
  if (item.kind === 'damageAll') return useDamageAllItem(item);
  return false;
}

function useHealingItem(item, targetId) {
  const target = gameState.party.find(member => member.id === targetId && member.hp > 0);
  if (!target) return false;
  if (target.hp >= target.maxHp) {
    pushLog(`${target.name} is already at full HP.`);
    return false;
  }
  gameState.inventory[item.id] -= 1;
  target.hp = Math.min(target.maxHp, target.hp + item.amount);
  setFx('heal', target.id, item.amount, `+${item.amount}`, target.id);
  pushLog(`${target.name} uses ${item.name}.`);
  afterPartyAction();
  return true;
}

function useMpItem(item, targetId) {
  const target = gameState.party.find(member => member.id === targetId && member.hp > 0);
  if (!target) return false;
  if (target.mp >= target.maxMp) {
    pushLog(`${target.name} is already at full MP.`);
    return false;
  }
  gameState.inventory[item.id] -= 1;
  target.mp = Math.min(target.maxMp, target.mp + item.amount);
  setFx('heal', target.id, item.amount, `+${item.amount} MP`, target.id);
  pushLog(`${target.name} uses ${item.name}.`);
  afterPartyAction();
  return true;
}

function useDamageAllItem(item) {
  const battle = gameState.battle;
  if (!battle) return false;
  gameState.inventory[item.id] -= 1;
  battle.enemies.filter(enemy => enemy.hp > 0).forEach(enemy => {
    enemy.hp = Math.max(0, enemy.hp - item.amount);
  });
  setFx('wave', 'allEnemies', item.amount, `-${item.amount}`, gameState.party[gameState.battle.actorIndex]?.id);
  pushLog(`The party throws a ${item.name}.`);
  afterPartyAction();
  return true;
}

function afterPartyAction() {
  if (firstLivingEnemy() === null) {
    endBattleVictory();
    return;
  }
  const nextIndex = nextLivingPartyIndex(gameState.battle.actorIndex + 1);
  if (nextIndex === -1) {
    gameState.battle.lost = true;
    pushLog('The party falls.');
    return;
  }
  if (nextIndex <= gameState.battle.actorIndex) {
    gameState.battle.turn = 'enemy';
    enemiesAct();
    gameState.battle.turn = 'party';
    gameState.battle.guarding = {};
    gameState.battle.shield = Math.max(0, gameState.battle.shield - 3);
    chooseEnemyIntents();
  }
  gameState.battle.actorIndex = nextLivingPartyIndex(nextIndex);
  saveGame();
}

function enemiesAct() {
  const battle = gameState.battle;
  battle.enemies.filter(enemy => enemy.hp > 0).forEach(enemy => {
    const targets = livingParty();
    if (targets.length === 0) return;
    const intent = battle.intents[enemy.id] || createEnemyIntent(enemy);
    const target = gameState.party.find(member => member.id === intent.targetId && member.hp > 0) || targets[Math.floor(Math.random() * targets.length)];
    const guarded = battle.guarding[target.id];
    const multiplier = intent.type === 'heavy' ? 1.45 : intent.type === 'quick' ? 0.85 : intent.type === 'guard' ? 0 : 1;
    if (intent.type === 'guard') {
      enemy.def += 1;
      pushLog(`${enemy.name} braces for impact.`);
      return;
    }
    const shield = battle.shield || 0;
    const damage = Math.max(1, Math.round((enemy.atk * multiplier) - target.stats.def + roll(1, 5) - (guarded ? 4 : 0) - shield));
    target.hp = Math.max(0, target.hp - damage);
    setFx('enemyHit', target.id, damage, `-${damage}`, enemy.id);
    pushLog(`${enemy.name} ${enemyVerb(intent.type)} ${target.name} for ${damage}.`);
  });
  if (livingParty().length === 0) {
    battle.lost = true;
    pushLog('The party falls. Return to town and rest.');
  }
}

function enemyVerb(intentType) {
  if (intentType === 'heavy') return 'crushes';
  if (intentType === 'quick') return 'snaps at';
  return 'hits';
}

function chooseEnemyIntents() {
  const battle = gameState.battle;
  if (!battle) return;
  battle.intents = {};
  battle.enemies.filter(enemy => enemy.hp > 0).forEach(enemy => {
    battle.intents[enemy.id] = createEnemyIntent(enemy);
  });
}

function createEnemyIntent(enemy) {
  const targets = livingParty();
  const target = targets[Math.floor(Math.random() * Math.max(1, targets.length))];
  const rollValue = Math.random();
  const type = pickIntentType(enemy.type, rollValue);
  return {
    type,
    targetId: target?.id,
    label: intentLabel(type)
  };
}

function pickIntentType(enemyType, rollValue) {
  if (enemyType === 'goblin') return rollValue > 0.68 ? 'heavy' : 'attack';
  if (enemyType === 'orc') return rollValue > 0.7 ? 'guard' : rollValue > 0.36 ? 'heavy' : 'attack';
  if (enemyType === 'troll') return rollValue > 0.74 ? 'guard' : 'heavy';
  if (enemyType === 'cave_lizard') return rollValue > 0.62 ? 'quick' : 'attack';
  return rollValue > 0.82 ? 'guard' : rollValue > 0.56 ? 'heavy' : 'attack';
}

function intentLabel(type) {
  if (type === 'guard') return 'Guard';
  if (type === 'heavy') return 'Heavy Attack';
  if (type === 'quick') return 'Quick Bite';
  return 'Attack';
}

function setFx(type, targetId, value, label, actorId = null) {
  if (!gameState.battle) return;
  gameState.battle.lastFx = {
    type,
    actorId,
    targetId,
    value,
    label,
    id: Date.now()
  };
}

function addXp(member, amount) {
  member.xp += amount;
  while (member.xp >= xpToNextLevel(member)) {
    member.xp -= xpToNextLevel(member);
    member.level += 1;
    member.maxHp += 5;
    member.maxMp += 2;
    member.stats.atk += member.role === 'Vanguard' || member.role === 'Wayfinder' ? 2 : 1;
    member.stats.mag += member.role === 'Pyromancer' || member.role === 'Warden' ? 2 : 1;
    member.stats.def += 1;
    member.hp = member.maxHp;
    member.mp = member.maxMp;
    pushLog(`${member.name} reaches level ${member.level}.`);
    const unlocked = applyAbilityUnlocks(member);
    unlocked.forEach(spell => pushLog(`${member.name} learns ${spell.name}.`));
  }
}

function applyAbilityUnlocks(member) {
  const learned = [];
  getAbilityUnlocks(member.id).forEach(unlock => {
    if (member.level >= unlock.level && !member.spells.includes(unlock.spellId)) {
      member.spells.push(unlock.spellId);
      learned.push(unlock.spell);
    }
  });
  return learned;
}

export function firstLivingEnemy() {
  return gameState.battle?.enemies.find(enemy => enemy.hp > 0) || null;
}

export function nextLivingPartyIndex(start) {
  for (let offset = 0; offset < gameState.party.length; offset += 1) {
    const index = (start + offset) % gameState.party.length;
    if (gameState.party[index].hp > 0) return index;
  }
  return -1;
}

function roll(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

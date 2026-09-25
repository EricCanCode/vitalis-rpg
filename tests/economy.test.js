// Non-battle progression: quest/area gating, shop and inn economy,
// achievements, scouting/searching. None of this touches Math.random, so no
// RNG stubbing is needed here (see battle.test.js for the combat math).
import './support/setup.mjs';
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { BESTIARY, ITEMS, QUESTS, WEAPONS } from '../src/data.js';
import * as state from '../src/state.js';

beforeEach(() => {
  localStorage.clear();
  state.resetGame();
});

test('a fresh game starts with only the Forest Road unlocked', () => {
  assert.ok(state.isAreaUnlocked('forest_road'));
  assert.equal(state.isAreaUnlocked('old_ruins'), false);
});

test('completing an area\'s quest unlocks the next area', () => {
  const quest = QUESTS.find(q => q.areaId === 'forest_road');
  state.gameState.areaProgress.forest_road.wins = quest.requiredWins;
  assert.ok(state.getQuestProgress('secure-road').complete);
  assert.ok(state.isAreaUnlocked('old_ruins'));
});

test('getQuestProgress reports partial progress as a percentage, not yet complete', () => {
  state.gameState.areaProgress.forest_road.wins = 1;
  const progress = state.getQuestProgress('secure-road');
  assert.equal(progress.complete, false);
  assert.equal(progress.percent, 50);
});

test('getUnlockedAreas grows, in area order, as quests complete', () => {
  assert.deepEqual(state.getUnlockedAreas().map(a => a.id), ['forest_road']);
  state.gameState.areaProgress.forest_road.wins = 2;
  assert.deepEqual(state.getUnlockedAreas().map(a => a.id), ['forest_road', 'old_ruins']);
});

test('buyItem refuses an unaffordable purchase and touches neither gold nor inventory', () => {
  state.gameState.gold = 0;
  const before = state.gameState.inventory.potion;
  assert.equal(state.buyItem('potion'), false);
  assert.equal(state.gameState.gold, 0);
  assert.equal(state.gameState.inventory.potion, before);
});

test('buyItem deducts the listed cost and adds one of the item when affordable', () => {
  state.gameState.gold = 100;
  const before = state.gameState.inventory.potion;
  assert.ok(state.buyItem('potion'));
  assert.equal(state.gameState.gold, 100 - ITEMS.potion.cost);
  assert.equal(state.gameState.inventory.potion, before + 1);
});

test('equipWeapon charges gold only the first time a weapon is bought, never on a re-equip', () => {
  state.gameState.gold = 100;
  assert.ok(state.equipWeapon('kael', 'oak_wand'));
  const goldAfterBuy = state.gameState.gold;
  assert.equal(goldAfterBuy, 100 - WEAPONS.oak_wand.cost);

  state.equipWeapon('kael', 'iron_sword');
  assert.ok(state.equipWeapon('kael', 'oak_wand')); // already owned this time
  assert.equal(state.gameState.gold, goldAfterBuy, 'equipping an already-owned weapon again must not charge gold twice');
});

test('equipWeapon refuses an unaffordable weapon and leaves the current weapon equipped', () => {
  state.gameState.gold = 0;
  assert.equal(state.equipWeapon('kael', 'oak_wand'), false);
  const kael = state.gameState.party.find(m => m.id === 'kael');
  assert.equal(kael.weapon, 'iron_sword');
});

test('camp fully restores the party\'s HP and MP for a flat 10 gold', () => {
  state.gameState.gold = 50;
  state.gameState.party[0].hp = 1;
  state.gameState.party[0].mp = 0;
  assert.ok(state.camp());
  assert.equal(state.gameState.gold, 40);
  assert.equal(state.gameState.party[0].hp, state.gameState.party[0].maxHp);
  assert.equal(state.gameState.party[0].mp, state.gameState.party[0].maxMp);
});

test('camp refuses when the party cannot afford the innkeeper, and does not heal', () => {
  state.gameState.gold = 5;
  state.gameState.party[0].hp = 1;
  assert.equal(state.camp(), false);
  assert.equal(state.gameState.party[0].hp, 1);
  assert.equal(state.gameState.gold, 5);
});

test('pushLog keeps only the 14 most recent entries, newest first', () => {
  for (let i = 0; i < 20; i += 1) state.pushLog(`entry ${i}`);
  assert.equal(state.gameState.log.length, 14);
  assert.equal(state.gameState.log[0], 'entry 19');
});

test('scoutArea reveals the next encounter\'s enemies in the bestiary without touching the search cache', () => {
  const preview = state.scoutArea('forest_road');
  assert.ok(preview.enemies.length > 0);
  assert.ok(Object.keys(state.gameState.bestiary).length > 0);
  assert.equal(state.gameState.areaProgress.forest_road.searched, false, 'scouting is not the same action as searching the cache');
});

test('searchAreaCache grants an item once, then refuses a second search before the next encounter', () => {
  const before = state.gameState.inventory.potion;
  assert.ok(state.searchAreaCache('forest_road'));
  assert.equal(state.gameState.inventory.potion, before + 1);
  assert.equal(state.searchAreaCache('forest_road'), false, 'already searched since the last encounter');
});

test('checkAchievements unlocks well_provisioned at 400 gold and not one gold before', () => {
  state.gameState.gold = 399;
  state.checkAchievements();
  assert.equal(state.gameState.achievements.includes('well_provisioned'), false);

  state.gameState.gold = 400;
  state.checkAchievements();
  assert.ok(state.gameState.achievements.includes('well_provisioned'));
});

test('checkAchievements unlocks chronicler only once every bestiary entry is discovered', () => {
  const allTypes = Object.keys(BESTIARY);
  allTypes.slice(0, -1).forEach(type => {
    state.gameState.bestiary[type] = { discovered: true, defeated: 0 };
  });
  state.checkAchievements();
  assert.equal(state.gameState.achievements.includes('chronicler'), false, 'one undiscovered type should still block it');

  state.gameState.bestiary[allTypes[allTypes.length - 1]] = { discovered: true, defeated: 0 };
  state.checkAchievements();
  assert.ok(state.gameState.achievements.includes('chronicler'));
});

test('markEndingSeen and markFenEndingSeen are independent flags, not a shared one', () => {
  assert.equal(state.gameState.endingSeen, false);
  assert.equal(state.gameState.fenEndingSeen, false);

  state.markEndingSeen();
  assert.equal(state.gameState.endingSeen, true);
  assert.equal(state.gameState.fenEndingSeen, false, 'the Chapter One ending must not also mark the Blackroot Fen ending as seen');

  state.markFenEndingSeen();
  assert.equal(state.gameState.fenEndingSeen, true);
});

test('drainAchievementToasts returns newly-earned achievements once, then empties', () => {
  state.gameState.gold = 400;
  state.checkAchievements();
  const toasts = state.drainAchievementToasts();
  assert.ok(toasts.some(a => a.id === 'well_provisioned'));
  assert.deepEqual(state.drainAchievementToasts(), []);
});

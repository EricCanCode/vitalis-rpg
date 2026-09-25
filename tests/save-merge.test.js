// The highest-risk code in state.js: hydrateSave/mergeAreaProgress decide
// what happens to a player's progress every time they reload the game after
// a content update. A bug here silently eats save data rather than crashing,
// which is exactly the kind of regression that's easy to ship unnoticed.
import './support/setup.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AREAS, PARTY_TEMPLATE } from '../src/data.js';
import { loadGame, createGameState, SAVE_KEY } from '../src/state.js';

function seedRawSave(raw) {
  localStorage.clear();
  localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
}

test('loadGame returns null when nothing has been saved yet', () => {
  localStorage.clear();
  assert.equal(loadGame(), null);
});

test('loadGame returns null for a save with no party array, rather than a half-hydrated object', () => {
  seedRawSave({ gold: 50 });
  assert.equal(loadGame(), null);
});

test('loadGame returns null for corrupted (non-JSON) save data instead of throwing', () => {
  localStorage.clear();
  localStorage.setItem(SAVE_KEY, '{not valid json');
  assert.equal(loadGame(), null);
});

test('hydrateSave keeps a saved hero\'s progress but fills in any field only the fresh template has', () => {
  seedRawSave({ party: [{ id: 'kael', level: 5, hp: 40, maxHp: 50 }], gold: 120 });
  const loaded = loadGame();
  assert.equal(loaded.party.length, PARTY_TEMPLATE.length, 'heroes missing from the save must be restored, not dropped');

  const kael = loaded.party.find(m => m.id === 'kael');
  assert.equal(kael.level, 5, 'saved progress survives the merge');
  assert.equal(kael.hp, 40);
  assert.ok(kael.stats, 'fields the partial save omitted (stats) come from the fresh template');

  const mira = loaded.party.find(m => m.id === 'mira');
  assert.equal(mira.level, 1, 'a hero entirely absent from the save comes back as a fresh template member, not undefined');
});

test('hydrateSave re-applies an ability unlock a saved level already earned, even if the raw save lost it', () => {
  seedRawSave({ party: [{ id: 'kael', level: 2, spells: [] }] });
  const kael = loadGame().party.find(m => m.id === 'kael');
  assert.ok(kael.spells.includes('cleave'), 'level 2 should always carry kael\'s level-2 unlock');
});

test('hydrateSave unions weapon ownership instead of letting the save replace it', () => {
  seedRawSave({ party: [{ id: 'kael' }], inventory: { weapons: ['oak_wand'] } });
  const loaded = loadGame();
  const fresh = createGameState();
  fresh.inventory.weapons.forEach(weaponId => {
    assert.ok(loaded.inventory.weapons.includes(weaponId), `a starting weapon (${weaponId}) must not be lost on load`);
  });
  assert.ok(loaded.inventory.weapons.includes('oak_wand'), 'a weapon bought since the template was fixed must be kept');
});

test('hydrateSave unions story events instead of replacing them', () => {
  seedRawSave({ party: [{ id: 'kael' }], storyEvents: ['claim-crystal'] });
  const loaded = loadGame();
  assert.ok(loaded.storyEvents.includes('prologue'), 'the always-present opening event must not be lost');
  assert.ok(loaded.storyEvents.includes('claim-crystal'));
});

test('hydrateSave merges per-area progress and backfills areas the save never mentions', () => {
  seedRawSave({
    party: [{ id: 'kael' }],
    areaProgress: { forest_road: { wins: 2, nextEncounter: 2, searched: true } }
  });
  const loaded = loadGame();
  assert.equal(loaded.areaProgress.forest_road.wins, 2, 'saved progress for a covered area is kept');
  AREAS.forEach(area => {
    assert.ok(loaded.areaProgress[area.id], `area ${area.id} missing from the save must still get a fresh entry, not be undefined`);
  });
  assert.equal(loaded.areaProgress.old_ruins.wins, 0, 'an area the save never mentions starts at zero, not undefined');
});

test('hydrateSave migrates the legacy single-number encounterIndex field into forest_road progress', () => {
  seedRawSave({ party: [{ id: 'kael' }], encounterIndex: 1 });
  const loaded = loadGame();
  assert.equal(loaded.areaProgress.forest_road.wins, 1);
  assert.equal(loaded.areaProgress.forest_road.nextEncounter, 1);
});

test('hydrateSave falls back to the fresh currentAreaId if the saved one no longer exists in AREAS', () => {
  seedRawSave({ party: [{ id: 'kael' }], currentAreaId: 'an_area_that_was_removed' });
  assert.equal(loadGame().currentAreaId, createGameState().currentAreaId);
});

test('hydrateSave keeps a currentAreaId that still exists', () => {
  seedRawSave({ party: [{ id: 'kael' }], currentAreaId: 'crystal_cave' });
  assert.equal(loadGame().currentAreaId, 'crystal_cave');
});

test('hydrateSave patches in missing battle sub-fields without discarding an in-progress battle', () => {
  seedRawSave({ party: [{ id: 'kael' }], battle: { areaId: 'forest_road', enemies: [] } });
  const loaded = loadGame();
  assert.deepEqual(loaded.battle.intents, {});
  assert.equal(loaded.battle.lastFx, null);
  assert.equal(loaded.battle.shield, 0);
  assert.equal(loaded.battle.areaId, 'forest_road', 'the actual saved battle must not be discarded, only patched');
});

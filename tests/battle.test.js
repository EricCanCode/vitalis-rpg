// Combat resolution -- damage/heal formulas, MP/item gating, turn order, and
// victory rewards. All of it lives in state.js, not the Phaser-facing
// main.js, so it's fully testable without a browser or canvas.
import './support/setup.mjs';
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { AREAS, QUESTS, SPELLS, WEAPONS } from '../src/data.js';
import { withFixedRandom } from './support/random.mjs';
import * as state from '../src/state.js';

beforeEach(() => {
  localStorage.clear();
  state.resetGame();
});

// Every action below runs Math.random-dependent code (roll(), enemy intent
// selection). A fixed draw keeps damage numbers reproducible instead of
// merely "probably positive" -- a failing assertion should always fail the
// same way.
function act(fn) {
  return withFixedRandom(0.5, fn);
}

function enterForestRoad() {
  act(() => state.startEncounter('forest_road'));
  return state.gameState.battle;
}

test('startEncounter opens a battle against the area\'s first encounter with intents pre-chosen for every enemy', () => {
  const battle = enterForestRoad();
  assert.equal(state.gameState.scene, 'battle');
  assert.ok(battle.enemies.length > 0);
  battle.enemies.forEach(enemy => {
    assert.ok(battle.intents[enemy.id], `enemy ${enemy.id} should have an intent chosen before the player acts`);
  });
});

test('startEncounter toughens enemies 12% per party level above the area\'s recommendedLevel, never below it', () => {
  const area = AREAS.find(entry => entry.id === 'forest_road');
  const baseEnemies = area.encounters[0].enemies;

  const atRecommended = enterForestRoad();
  atRecommended.enemies.forEach((enemy, i) => {
    assert.equal(enemy.maxHp, baseEnemies[i].maxHp, 'party at the recommended level should face the table as-authored');
    assert.equal(enemy.atk, baseEnemies[i].atk);
  });

  state.gameState.party.forEach(member => { member.level = area.recommendedLevel + 3; }); // 3 levels over
  const overleveled = enterForestRoad();
  overleveled.enemies.forEach((enemy, i) => {
    assert.equal(enemy.maxHp, Math.max(1, Math.round(baseEnemies[i].maxHp * 1.36)), '3 levels over should scale enemy hp by 1 + 3*0.12');
    assert.equal(enemy.hp, enemy.maxHp);
    assert.equal(enemy.atk, Math.max(1, Math.round(baseEnemies[i].atk * 1.36)));
  });
});

test('partyAttack deals the exact damage the formula predicts for a fixed roll', () => {
  const battle = enterForestRoad();
  const kael = state.gameState.party[0]; // actorIndex starts at the first living member
  const weapon = WEAPONS[kael.weapon];
  const target = battle.enemies[0];
  const expectedRoll = Math.floor(0.5 * 4) + 1; // roll(1, 4) with Math.random fixed at 0.5
  const expectedDamage = kael.stats.atk + weapon.atk + battle.rally - target.def + expectedRoll;

  act(() => state.partyAttack(target.id));
  assert.equal(target.hp, Math.max(0, target.maxHp - expectedDamage));
});

test('partyAttack never drops a target below zero HP, even on overkill', () => {
  const battle = enterForestRoad();
  const target = battle.enemies[0];
  target.hp = 1;
  act(() => state.partyAttack(target.id));
  assert.equal(target.hp, 0);
});

test('castSpell refuses without enough MP and leaves the target and the caster\'s MP unchanged', () => {
  const battle = enterForestRoad();
  const kael = state.gameState.party[0];
  kael.mp = 0;
  const target = battle.enemies[0];
  const hpBefore = target.hp;
  act(() => state.castSpell('guard_break', target.id));
  assert.equal(target.hp, hpBefore);
  assert.equal(kael.mp, 0);
});

test('castSpell on an ally heals, and is refused once that ally is already at full HP', () => {
  enterForestRoad();
  state.gameState.battle.actorIndex = 2; // rowan, the party's healer
  const rowan = state.gameState.party[2];
  const kael = state.gameState.party[0];
  kael.hp = 1;

  act(() => state.castSpell('mend', kael.id));
  assert.ok(kael.hp > 1, 'mend should have healed kael');
  assert.equal(rowan.mp, rowan.maxMp - SPELLS.mend.mp);

  kael.hp = kael.maxHp; // now force the "already full" branch
  state.gameState.battle.actorIndex = 2;
  const mpBefore = rowan.mp;
  act(() => state.castSpell('mend', kael.id));
  assert.equal(kael.hp, kael.maxHp, 'no overheal past max HP');
  assert.equal(rowan.mp, mpBefore, 'a refused heal must not spend MP');
});

test('castSpell with an allEnemies target damages every living enemy', () => {
  const battle = enterForestRoad();
  state.gameState.battle.actorIndex = 1; // mira
  const mira = state.gameState.party[1];
  const before = battle.enemies.map(e => e.hp);

  act(() => state.castSpell('flame_wave', null));
  battle.enemies.forEach((enemy, i) => {
    assert.ok(enemy.hp < before[i], `enemy ${enemy.id} should take flame_wave damage`);
  });
  assert.equal(mira.mp, mira.maxMp - SPELLS.flame_wave.mp);
});

test('castSpell with a party target (rally) raises battle.rally for the whole party', () => {
  enterForestRoad();
  const kael = state.gameState.party[0]; // rally is kael's own spell
  assert.equal(state.gameState.battle.rally, 0);
  act(() => state.castSpell('rally', null));
  assert.equal(state.gameState.battle.rally, 3);
  assert.equal(kael.mp, kael.maxMp - SPELLS.rally.mp);
});

test('castSpell with a partyShield target raises battle.shield', () => {
  enterForestRoad();
  state.gameState.battle.actorIndex = 2; // rowan
  act(() => state.castSpell('shield_prayer', null));
  assert.equal(state.gameState.battle.shield, SPELLS.shield_prayer.power);
});

test('guard marks the current actor as guarding for the rest of the round', () => {
  enterForestRoad();
  const kael = state.gameState.party[0];
  act(() => state.guard());
  assert.ok(state.gameState.battle.guarding[kael.id]);
});

test('usePotion heals a wounded ally and consumes exactly one potion', () => {
  enterForestRoad();
  const kael = state.gameState.party[0];
  kael.hp = 5;
  const potionsBefore = state.gameState.inventory.potion;
  assert.ok(act(() => state.usePotion(kael.id)));
  assert.equal(kael.hp, Math.min(kael.maxHp, 5 + 22));
  assert.equal(state.gameState.inventory.potion, potionsBefore - 1);
});

test('useItem refuses when none of that item remain', () => {
  enterForestRoad();
  state.gameState.inventory.fire_bomb = 0;
  assert.equal(state.useItem('fire_bomb', null), false);
});

test('useItem with a damageAll item hits every living enemy for the same flat amount', () => {
  const battle = enterForestRoad();
  state.gameState.inventory.fire_bomb = 1;
  const before = battle.enemies.map(e => e.hp);
  state.useItem('fire_bomb', null);
  battle.enemies.forEach((enemy, i) => {
    assert.equal(enemy.hp, Math.max(0, before[i] - 14));
  });
});

test('once every living party member has acted, the enemies retaliate once and control returns to the party', () => {
  enterForestRoad();
  const partyHpBefore = state.gameState.party.reduce((sum, m) => sum + m.hp, 0);

  act(() => {
    state.guard(); // kael
    state.guard(); // mira
    state.guard(); // rowan
    state.guard(); // nyx -- the 4th action should trigger the enemy phase
  });

  assert.equal(state.gameState.battle.turn, 'party', 'control should return to the party after the enemy phase');
  assert.equal(state.gameState.battle.actorIndex, 0, 'a new round starts back at the first living party member');
  assert.deepEqual(state.gameState.battle.guarding, {}, 'guarding clears once the round that used it ends');

  const partyHpAfter = state.gameState.party.reduce((sum, m) => sum + m.hp, 0);
  assert.ok(partyHpAfter < partyHpBefore, 'the enemy phase should have dealt real damage back');
});

test('endBattleVictory grants gold/xp, advances area progress, and completes the area quest at the win threshold', () => {
  const battle = enterForestRoad();
  const quest = QUESTS.find(q => q.areaId === 'forest_road');
  state.gameState.areaProgress.forest_road.wins = quest.requiredWins - 1; // one win away from completing it
  const goldBefore = state.gameState.gold;
  const kael = state.gameState.party[0];
  const kaelXpBefore = kael.xp;

  battle.enemies.forEach(enemy => { enemy.hp = 0; });
  const totalXp = battle.enemies.reduce((sum, e) => sum + e.xp, 0);
  const totalGold = battle.enemies.reduce((sum, e) => sum + e.gold, 0);

  act(() => state.endBattleVictory());

  assert.ok(state.gameState.battle.won);
  assert.equal(state.gameState.gold, goldBefore + totalGold);
  assert.equal(state.gameState.areaProgress.forest_road.wins, quest.requiredWins);
  assert.equal(kael.xp, kaelXpBefore + totalXp, 'each living member gets the full xp reward, not a split share');
  assert.ok(state.gameState.storyEvents.includes(quest.id), 'completing the quest should unlock its story event');
});

test('a big enough xp grant levels up, fully restores hp but not mp, and unlocks the level-2 ability', () => {
  const battle = enterForestRoad();
  const kael = state.gameState.party[0];
  kael.hp = 1; // prove leveling fully heals hp, not just adds hp
  kael.mp = 1; // prove leveling does NOT restore mp, only hp

  battle.enemies.forEach(enemy => { enemy.hp = 0; enemy.xp = 100; }); // force at least one level-up
  act(() => state.endBattleVictory());

  assert.ok(kael.level >= 2);
  assert.equal(kael.hp, kael.maxHp, 'leveling up should fully heal, not leave the character wounded');
  assert.equal(kael.mp, 1, 'leveling up should not refill mp -- that stays a town-economy cost');
  assert.ok(kael.spells.includes('cleave'), 'the level-2 unlock should fire the moment that level is reached');
});

// Status effects (poison, silence, the party-wide defense debuff) are the
// mechanism that actually defeats "reactive single-target healing" -- see
// RESEARCH_LOG-style reasoning in the design discussion. These tests force a
// specific enemy intent the same way the "enemies retaliate" test above
// does, then drive the round forward with guard()/partyAttack() to observe
// the real enemiesAct()/tickStatuses() resolution, not a reimplementation.

test('a poison intent bites for reduced damage and applies a status that ticks for flat damage each following round', () => {
  const battle = enterForestRoad();
  const kael = state.gameState.party[0];
  const enemy = battle.enemies[0];
  battle.intents[enemy.id] = { type: 'poison', targetId: kael.id, label: 'Venom Bite' };

  const hpBeforeBite = kael.hp;
  act(() => {
    state.guard(); // kael
    state.guard(); // mira
    state.guard(); // rowan
    state.guard(); // nyx -- triggers the enemy phase, where the forced poison bite resolves
  });
  const bittenRoll = Math.floor(0.5 * 5) + 1; // roll(1, 5) with Math.random fixed at 0.5
  // kael guards herself as the round's first action (same 4x-guard pattern
  // as above), so the bite also gets guard()'s -4 damage reduction.
  const expectedBite = Math.max(1, Math.round(enemy.atk * 0.6 - kael.stats.def + bittenRoll - 4));
  assert.equal(kael.hp, hpBeforeBite - expectedBite, 'the bite itself deals reduced (0.6x) direct damage');
  assert.equal(state.gameState.battle.statuses[kael.id].poisonTurns, 3);

  // Round 2: nothing re-forces this enemy's intent, so it reverts to a plain
  // 'attack' (goblin's pickIntentType at roll 0.5) aimed elsewhere by the
  // same fixed random draw -- kael's only expected damage this round is the
  // poison tick, resolved once for the whole party when the round turns over.
  const hpBeforeTick = kael.hp;
  act(() => {
    state.guard(); state.guard(); state.guard(); state.guard();
  });
  assert.equal(kael.hp, hpBeforeTick - 6, 'poison ticks for a flat 6 damage per round, independent of any roll');
  assert.equal(state.gameState.battle.statuses[kael.id].poisonTurns, 2, 'poison counts down by one per round');
});

test('silence blocks castSpell outright -- no MP spent, no turn consumed -- and wears off after its duration', () => {
  const battle = enterForestRoad();
  const rowan = state.gameState.party[2]; // the party's only healer (mend, renewal)
  const enemy = battle.enemies[0];
  battle.intents[enemy.id] = { type: 'silence', targetId: rowan.id, label: 'Mind Drain' };

  act(() => {
    state.guard(); state.guard(); state.guard(); state.guard(); // round 1 -> silence lands going into round 2
  });
  assert.equal(state.gameState.battle.statuses[rowan.id].silenceTurns, 3);

  act(() => {
    state.guard(); // kael's round-2 turn
    state.guard(); // mira's round-2 turn
  });
  assert.equal(state.gameState.battle.actorIndex, 2, 'it should now be the silenced healer\'s turn');

  rowan.hp = 5; // wounded, so an unblocked mend would visibly change this
  const mpBefore = rowan.mp;
  act(() => state.castSpell('mend', rowan.id));
  assert.equal(rowan.hp, 5, 'a silenced caster cannot cast -- HP is unchanged');
  assert.equal(rowan.mp, mpBefore, 'MP is not spent on a blocked cast');
  assert.equal(state.gameState.battle.actorIndex, 2, 'a blocked cast must not consume the turn');

  act(() => {
    state.guard(); // rowan actually takes her turn this time
    state.guard(); // nyx -- completes round 2, ticking silenceTurns down
  });
  assert.equal(state.gameState.battle.statuses[rowan.id].silenceTurns, 2, 'silence counts down by one per round like poison');
});

test("a roar cracks the party's defense: the debuff applies, decays over three rounds, and raises damage taken while active", () => {
  const battle = enterForestRoad();
  const kael = state.gameState.party[0];
  const enemy = battle.enemies[0];
  battle.intents[enemy.id] = { type: 'roar', targetId: kael.id, label: 'Roar' };

  act(() => {
    state.guard(); state.guard(); state.guard(); state.guard();
  });
  assert.deepEqual(state.gameState.battle.partyDefDebuff, { amount: 3, turns: 3 });

  // Round 2: force the same enemy into a plain attack on kael, who attacks
  // back instead of guarding -- guarding would mask the debuff behind its
  // own -4 damage reduction, confounding the comparison.
  kael.hp = kael.maxHp;
  battle.intents[enemy.id] = { type: 'attack', targetId: kael.id, label: 'Attack' };
  const hpBefore = kael.hp;
  act(() => {
    state.partyAttack(enemy.id); // kael
    state.guard(); // mira
    state.guard(); // rowan
    state.guard(); // nyx -- triggers the enemy phase
  });
  const hitRoll = Math.floor(0.5 * 5) + 1;
  const expectedDamage = Math.max(1, Math.round(enemy.atk - Math.max(0, kael.stats.def - 3) + hitRoll));
  assert.equal(kael.hp, hpBefore - expectedDamage, 'the debuff should shave 3 off effective defense for this hit');
  assert.equal(state.gameState.battle.partyDefDebuff.turns, 2, 'the debuff counts down by one per round');
});

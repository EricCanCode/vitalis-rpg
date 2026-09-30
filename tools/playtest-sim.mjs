// One-off simulation harness for a balance/playtest pass -- not shipped
// with the game, not part of the automated test suite (this is analysis,
// not a pass/fail assertion). Drives the REAL game logic in state.js (no
// reimplementation of combat math) through N full playthroughs with a
// simple-but-sensible AI policy, then reports win rate, level pacing, and
// the gold/potion economy per area.
//
// Policy per turn: if any living party member is below 45% HP, the acting
// character heals them if they know a heal spell and can afford it,
// otherwise uses a potion if one is held. Otherwise the actor either casts
// a single-target damage spell (60% of the time, if it knows one and can
// afford it) or makes a basic attack, always targeting the weakest living
// enemy. Between battles: restock potions if flush, camp if the party's
// average HP is below 70% and camping is affordable.
//
// Usage: node tools/playtest-sim.mjs [N]
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  clear: () => { store.clear(); }
};

import { AREAS, ITEMS, QUESTS, SPELLS } from '../src/data.js';
import * as state from '../src/state.js';
import { isSilenced } from '../src/state.js';

const N = Number(process.argv[2] || 200);

function mostWoundedLiving(members) {
  return members.filter(m => m.hp > 0).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
}

function weakestLivingEnemy(enemies) {
  return enemies.filter(e => e.hp > 0).sort((a, b) => a.hp - b.hp)[0];
}

function healSpellFor(actor) {
  if (isSilenced(actor)) return null;
  return actor.spells.find(id => SPELLS[id]?.target === 'ally' && SPELLS[id].mp <= actor.mp);
}

function damageSpellFor(actor) {
  if (isSilenced(actor)) return null;
  return actor.spells.find(id => SPELLS[id]?.target === 'enemy' && SPELLS[id].mp <= actor.mp);
}

function takeTurn() {
  const battle = state.gameState.battle;
  const actor = state.gameState.party[battle.actorIndex];
  const wounded = mostWoundedLiving(state.gameState.party);
  const woundedRatio = wounded.hp / wounded.maxHp;

  if (woundedRatio < 0.45) {
    const healId = healSpellFor(actor);
    if (healId) { state.castSpell(healId, wounded.id); return; }
    if (state.gameState.inventory.potion > 0) { state.usePotion(wounded.id); return; }
  }

  const target = weakestLivingEnemy(battle.enemies);
  if (!target) return; // battle should already be won/lost by now
  const dmgId = damageSpellFor(actor);
  if (dmgId && Math.random() < 0.6) state.castSpell(dmgId, target.id);
  else state.partyAttack(target.id);
}

function runBattle(areaId) {
  state.startEncounter(areaId);
  let guard = 0;
  let minPartyHpPct = 1;
  let turns = 0;
  while (state.gameState.battle && !state.gameState.battle.won && !state.gameState.battle.lost) {
    takeTurn();
    turns += 1;
    const totalHp = state.gameState.party.reduce((sum, m) => sum + Math.max(0, m.hp), 0);
    const totalMaxHp = state.gameState.party.reduce((sum, m) => sum + m.maxHp, 0);
    minPartyHpPct = Math.min(minPartyHpPct, totalHp / totalMaxHp);
    guard += 1;
    if (guard > 200) return { outcome: 'stuck', minPartyHpPct, turns };
  }
  return { outcome: state.gameState.battle?.lost ? 'lost' : 'won', minPartyHpPct, turns };
}

function townUpkeep() {
  state.returnToTown();
  while (state.gameState.gold >= ITEMS.potion.cost + 20 && state.gameState.inventory.potion < 4) {
    if (!state.buyItem('potion')) break;
  }
  const avgHpPct = state.gameState.party.reduce((sum, m) => sum + m.hp / m.maxHp, 0) / state.gameState.party.length;
  if (avgHpPct < 0.7 && state.gameState.gold >= 10) state.camp();
}

function playOne() {
  localStorage.clear();
  state.resetGame();
  const log = { areas: {}, softlocked: false, finalGold: 0 };

  for (const area of AREAS) {
    const quest = QUESTS.find(q => q.areaId === area.id);
    const entryLevels = state.gameState.party.map(m => m.level);
    let battles = 0;
    let losses = 0;
    const margins = [];

    while (!state.getQuestProgress(quest.id).complete) {
      if (!state.isAreaUnlocked(area.id)) { log.areas[area.id] = { skipped: true }; break; }
      const result = runBattle(area.id);
      battles += 1;
      margins.push(result.minPartyHpPct);
      if (result.outcome === 'lost') {
        losses += 1;
        townUpkeep();
        if (state.gameState.party.every(m => m.hp <= 0) && state.gameState.gold < 10) {
          log.softlocked = true;
          return log;
        }
      } else if (result.outcome === 'won') {
        townUpkeep();
      } else {
        log.areas[area.id] = { stuck: true };
        return log;
      }
      if (battles > 20) { log.areas[area.id] = { runaway: true }; break; }
    }

    log.areas[area.id] = {
      ...log.areas[area.id],
      battles, losses, margins,
      entryLevels, recommendedLevel: area.recommendedLevel,
      exitLevels: state.gameState.party.map(m => m.level)
    };
  }

  log.finalGold = state.gameState.gold;
  return log;
}

const results = [];
for (let i = 0; i < N; i += 1) results.push(playOne());

console.log(`Simulated ${N} full playthroughs.\n`);

const softlocks = results.filter(r => r.softlocked).length;
console.log(`Soft-locks (party wiped, gold < 10, unrecoverable): ${softlocks}/${N}`);

AREAS.forEach(area => {
  const entries = results.map(r => r.areas[area.id]).filter(Boolean);
  const clean = entries.filter(e => !e.skipped && !e.stuck && !e.runaway);
  const totalLosses = clean.reduce((sum, e) => sum + (e.losses || 0), 0);
  const totalBattles = clean.reduce((sum, e) => sum + (e.battles || 0), 0);
  const avgEntryLevel = clean.length
    ? (clean.reduce((sum, e) => sum + e.entryLevels.reduce((a, b) => a + b, 0) / e.entryLevels.length, 0) / clean.length).toFixed(2)
    : 'n/a';
  const stuckCount = entries.filter(e => e.stuck).length;
  const runawayCount = entries.filter(e => e.runaway).length;
  const allMargins = clean.flatMap(e => e.margins || []).sort((a, b) => a - b);
  const worstMargin = allMargins.length ? (allMargins[0] * 100).toFixed(1) : 'n/a';
  const p10Margin = allMargins.length ? (allMargins[Math.floor(allMargins.length * 0.1)] * 100).toFixed(1) : 'n/a';
  const medianMargin = allMargins.length ? (allMargins[Math.floor(allMargins.length * 0.5)] * 100).toFixed(1) : 'n/a';
  console.log(
    `${area.id.padEnd(14)} recommended Lv ${area.recommendedLevel} | avg party Lv on entry ${avgEntryLevel} | ` +
    `loss rate ${totalBattles ? ((totalLosses / totalBattles) * 100).toFixed(1) : 'n/a'}% (${totalLosses}/${totalBattles}) | ` +
    `stuck ${stuckCount} runaway ${runawayCount}\n` +
    `${''.padEnd(14)} min party HP% reached in a battle -- worst ${worstMargin}% | p10 ${p10Margin}% | median ${medianMargin}%`
  );
});

const finalGolds = results.map(r => r.finalGold).sort((a, b) => a - b);
if (finalGolds.length) {
  console.log(`\nFinal gold after clearing everything -- median ${finalGolds[Math.floor(finalGolds.length / 2)]}, min ${finalGolds[0]}, max ${finalGolds[finalGolds.length - 1]}`);
}

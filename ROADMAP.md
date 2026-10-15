# Vitalis — Roadmap to Steam

## Vision

A four-hero, Chrono Trigger–inspired turn-based RPG, shipped as a real desktop
title on Steam. Solo-developed. This doc exists so "what's next" lives in the
repo next to `DESIGN.md`, not in someone's head.

## Honest state of the project (updated 2026-10-15)

What's genuinely solid:
- A working town/battle/cutscene game built on Phaser 3 (vendored locally, no
  build step), ~5,600 lines across `main.js`, `data.js`, `state.js`, `audio.js`,
  `intro.js`, `settings.js`.
- Full turn-based party combat (intents, guard/shield/rally, targeted spells),
  town navigation with NPC dialogue, walkable world map, area-transition wipes,
  intro and two chapter-ending cutscenes, difficulty scaling, achievements, a
  bestiary.
- 4 playable heroes, 4 story areas (Forest Road, Old Ruins, Crystal Cave,
  Blackroot Fen) with 2 distinct encounters each.
- **Status effects** (poison, silence, defense-break) so reactive healing no
  longer trivialises every fight, and **party-level encounter scaling**
  (`LEVEL_SCALE_PER_LEVEL = 0.20`).
- A save system (`state.js`) whose `hydrateSave` merges old saves against
  current templates so saves survive content updates.
- **Tests and CI.** 54 tests in `tests/` (save merge, economy, combat
  resolution, audio theme) run with `npm test` and in GitHub Actions on every
  push/PR to `main`.
- **Balance is measured, not guessed.** `tools/playtest-sim.mjs` drives the
  real `state.js` logic through thousands of simulated playthroughs. The
  recent balance changes (+30% enemy damage, status effects, scaling 0.20)
  were each chosen from a sweep, with loss and softlock rates recorded in the
  commit messages.
- A clear, opinionated `DESIGN.md` with guardrails on what must NOT change.

What's a real gap, not just polish:
- **Content length is still the largest gap, and the recent "longer
  campaign" change did not close it.** Each area's win requirement went from
  2 to 4, so the campaign is 16 battles instead of 8. But each area only has 2
  distinct encounters, so the extra wins cycle through the same pair. That is
  padding, not content. Playtime is still well short of the 6-15+ hours of
  typical paid Steam RPGs, and this is design/writing work, not something
  more engineering solves.
- **Difficulty is now mild by design, not by accident.** At scale 0.20 the
  simulator shows roughly 2% loss in Blackroot Fen and about 0.1% in Crystal
  Cave under a competent-but-not-perfect policy. Area transitions are gated
  by win count rather than level, so longer areas leave the party
  overlevelled for the next one. Revisit if a real playtester finds it too
  easy.
- **Audio is still fully procedural** (`audio.js`: WebAudio oscillator
  recipes, now with a bass drone and harmony accent, but no samples). No real
  music or sound design yet. This needs a plan (compose, commission, or
  license) before launch, not after.
- **Art pipeline is AI-assisted.** `tools/repack-sheets.mjs` describes
  repairing "hand-assembled or AI-generated sheets." Steam requires AI-content
  disclosure on store pages. Not a blocker, but a store-page requirement.
- **Packaging is a proof-of-concept only.** `electron/main.js` opens
  `index.html` unmodified in a sandboxed window and was verified under Xvfb
  on Linux. There is no installer or build script (no electron-builder or
  similar), and Windows/Mac builds are untested.
- **Saves are still browser `localStorage`** (`state.js`). Inside Electron
  that is tied to the app's profile directory and is not Steam Cloud
  compatible.
- **No Steamworks integration.** Achievements exist in `data.js` as data but
  are not wired to Steam; no cloud save, no store API.
- **Chapter Two does not exist.** The Blackroot Fen ending now plays a real
  5-beat cutscene, but it closes the playable arc on a hook; it does not
  lead anywhere.

## Reality check

This is realistically 1–3+ years of solo part-time work if content is written
to match typical paid-RPG length, on top of everything above. That's not a
reason not to do it — plenty of Steam titles started exactly like this — but
the plan below is built around **not** trying to build the "full" game in one
uninterrupted push. Instead: prove the full pipeline end-to-end at small
scale first (a short vertical slice that could theoretically already be
shown to strangers), *then* scale content, so packaging/Steamworks surprises
get caught early instead of after months of content work.

## Phases

### Phase 0 — Foundation hardening (mostly done)
*Goal: make it safe to build on top of what exists.*
- [x] This roadmap.
- [x] Automated tests for `state.js` (save-merge, economy, combat
      resolution) plus an audio-theme test: 54 tests, `npm test`.
- [x] Minimal CI (GitHub Actions) running those tests on push and PR.
- [ ] Tests for the `main.js` scene layer (UI flow, scene transitions) are
      still absent; only `state.js` logic is covered.
- Decision made: stay build-tool-free for now (no bundler/npm) — the project
  works fine without one today, and introducing one before it's needed just
  adds complexity. Revisit this in Phase 2, since Electron will likely force
  the question anyway.

### Phase 1 — Vertical slice (in progress)
*Goal: a short but genuinely finished loop — the version you'd show a
stranger or run through Steam Next Fest as a demo.*
- [x] Story arc ending: Chapter One and Blackroot Fen both have proper
      endings. Decide whether Blackroot Fen's hook is the slice's final beat
      or whether Chapter Two content is needed before a demo.
- [ ] At least a few pieces of real music (even 2-3 tracks: town, battle,
      one emotional beat). Procedural audio was improved but not replaced.
- [x] A full playtest + balance pass on what exists today (simulated; see
      `tools/playtest-sim.mjs`). A human playtest by someone who isn't the
      developer has not happened and is the next real test.
- [ ] Replace the cycled encounters with genuinely distinct ones (more enemy
      types and encounter variety per area). This is the honest fix for the
      campaign-length padding described above.
- Target: something a stranger could finish in one sitting and come away
  thinking "this is a real game," not "this is a tech demo."

### Phase 2 — Desktop packaging & Steam technical prerequisites (started)
*Goal: prove the non-content-related Steam blockers aren't surprises.*
- [x] Electron wrap proof-of-concept (`electron/main.js`, Phaser vendored).
- [ ] Confirm save persistence inside Electron and move off browser
  `localStorage` to file-based saves + Steam Cloud, rather than assuming the
  browser API carries over cleanly.
- [ ] Packaging: an installer/build script (e.g. electron-builder), and
  build + smoke-test on Windows/Mac/Linux. Only Linux/Xvfb has been checked.
- Steamworks integration scaffolding (`steamworks.js` or Greenworks) —
  wire the existing `ACHIEVEMENTS` array to real Steam achievements, add
  cloud save.
- Build and smoke-test on Windows/Mac/Linux.
- Steam Direct application ($100 fee + tax/business paperwork — not
  engineering work, but needs to happen on this track), store page draft
  (capsule art, trailer, screenshots), and the AI-art disclosure required by
  Steam's content survey.

### Phase 3 — Full content build-out
*Goal: scale the proven slice to a real game length.*
- Only start this once Phases 0–2 are done — no point writing hours of
  content against a save system or packaging path that hasn't been proven.
- New areas, enemies, hero abilities/spells, side content, more music.
- Define an actual target length (e.g. 6–10 hours) rather than leaving it
  open-ended — a number to aim at, revisit as content work proves out pacing.

### Phase 4 — QA, polish, launch
- Full regression pass, performance profiling.
- Consider a Steam Next Fest demo before full launch.
- Launch checklist (store page live, build uploaded, marketing push).

## Immediate next steps

1. ~~This roadmap~~ — done, and refreshed 2026-10-15.
2. ~~Test coverage + CI~~ — done (54 tests, GitHub Actions).
3. ~~Barebones Electron wrapper~~ — done as a proof-of-concept.
4. **Decide target length.** Pick a number (e.g. 6-10 hours) and what content
   gets there. This unblocks Phase 3 and needs your direction.
5. **Distinct encounters per area.** Replace the cycled pair with real
   variety so the 16-battle campaign stops being padding.
6. **Get one outside playtester.** The simulator can't tell whether it's fun.
7. **Packaging pass.** Installer/build script, a Windows build, and a file
   based save to replace `localStorage`.

## Explicitly not started here

- New story/area content — design decisions that need your direction, not
  something to freelance.
- Real music (composition, commissioning, or licensing) — needs a decision
  on approach and budget.
- Steam Direct paperwork — business/legal, not engineering.

# Vitalis — Roadmap to Steam

## Vision

A four-hero, Chrono Trigger–inspired turn-based RPG, shipped as a real desktop
title on Steam. Solo-developed. This doc exists so "what's next" lives in the
repo next to `DESIGN.md`, not in someone's head.

## Honest state of the project (as of this doc)

What's genuinely solid:
- A working town/battle/cutscene game built on Phaser 3, no build step, ~5,400
  lines across `main.js`, `data.js`, `state.js`, `audio.js`, `intro.js`,
  `settings.js`.
- Full turn-based party combat (intents, guard/shield/rally, targeted spells),
  town navigation with NPC dialogue and proximity interaction, area-transition
  wipes, an intro/ending cutscene system, difficulty scaling (easy/normal/hard),
  achievements, a bestiary.
- 4 playable heroes with complete walk + battle sprite sheets, 4 story areas
  (Forest Road → Old Ruins → Crystal Cave → Blackroot Fen) each with multiple
  encounters.
- A save system (`state.js`) that already does real work — `hydrateSave` merges
  old saves against current templates so saves survive content updates.
- A clear, opinionated `DESIGN.md` — art direction, tone, and explicit
  guardrails on what must NOT change (combat mechanics, expedition structure,
  readiness system). That discipline is worth keeping as scope grows.

What's a real gap, not just polish:
- **Content length.** ~30–60 minutes of playable content today. Most paid
  Steam RPGs run 6–15+ hours. This is the largest gap and it's design/writing
  work, not something that gets solved by more engineering.
- **Audio is fully procedural** (`audio.js` — WebAudio oscillator recipes, no
  samples, ported from the legacy build). No real music or sound design yet.
  Reviews notice audio first; this needs a real plan (compose, commission, or
  license) before launch, not after.
- **Art pipeline is AI-assisted.** `tools/repack-sheets.mjs`'s own comments
  describe repairing "hand-assembled or AI-generated sheets" and scrubbing
  "generation residue." Steam has required AI-generated content disclosure on
  store pages since 2024. This isn't a blocker, but it's a real store-page
  requirement to plan for, not a footnote.
- **Zero automated tests, zero CI.** Nothing catches a regression in combat
  math or save merging. This gets more dangerous, not less, as content scales.
- **No packaging path yet.** Phaser is browser-only. Steam needs a native
  executable — the standard path is an Electron (or Tauri) wrap, not yet
  started.
- **No Steamworks integration.** Achievements already exist in `data.js` as
  data but aren't wired to anything Steam-side; no cloud save, no store API.

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

### Phase 0 — Foundation hardening
*Goal: make it safe to build on top of what exists.*
- [x] This roadmap.
- [ ] Automated tests for `state.js` (save/load merge logic specifically —
      it's the piece most likely to silently corrupt player progress as
      content changes) and core combat resolution in `main.js`.
- [ ] Minimal CI (GitHub Actions) running those tests on push.
- Decision made: stay build-tool-free for now (no bundler/npm) — the project
  works fine without one today, and introducing one before it's needed just
  adds complexity. Revisit this in Phase 2, since Electron will likely force
  the question anyway.

### Phase 1 — Vertical slice
*Goal: a short but genuinely finished loop — the version you'd show a
stranger or run through Steam Next Fest as a demo.*
- Finish the story arc properly. It currently stops abruptly after Blackroot
  Fen — decide whether that's the intended slice-ending or needs a proper
  climax/resolution beat.
- At least a few pieces of real music (even 2–3 tracks: town, battle, one
  emotional beat) to replace/supplement the procedural audio for the areas
  that matter most.
- A full playtest + balance pass on what exists today.
- Target: something a stranger could finish in one sitting and come away
  thinking "this is a real game," not "this is a tech demo."

### Phase 2 — Desktop packaging & Steam technical prerequisites
*Goal: prove the non-content-related Steam blockers aren't surprises.*
- Electron wrap of the existing game; confirm save persistence works inside
  Electron (likely move off browser `localStorage` to file-based saves +
  Steam Cloud, rather than assuming the browser API carries over cleanly).
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

1. This roadmap — done.
2. Test coverage + CI for `state.js` save merging and combat resolution —
   the highest-leverage safety net before anything else changes.
3. A barebones Electron wrapper running locally, even before more content —
   proves the packaging path isn't a late surprise, and is cheap to try now.

## Explicitly not started here

- New story/area content — design decisions that need your direction, not
  something to freelance.
- Real music (composition, commissioning, or licensing) — needs a decision
  on approach and budget.
- Steam Direct paperwork — business/legal, not engineering.

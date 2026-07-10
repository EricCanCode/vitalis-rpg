# Vitalis — Global Design Directive

## Core directive

**Vitalis adopts Chrono Trigger–style gameplay and aesthetic influences wherever
compatible with the existing architecture.** This is stylistic inspiration — study
of what made that era of Square RPGs readable and expressive — not reproduction of
any copyrighted asset, character, or composition. All art is original to Vitalis.

## How the directive applies

### Town movement & proximity interaction (roadmap Step 8, ongoing)
- Movement feels smooth, expressive, and readable: responsive 8-direction walking,
  clean stops, characters that visibly face what they interact with.
- Interaction cues are diegetic and immediate: clear in-world prompts near NPCs and
  markers (already implemented as the `E - …` prompt), no menu-diving required to
  talk or travel.

### Battle presentation (roadmap Steps 10–13)
- Hero battle stances: expressive silhouettes, wide readable poses, weapon drawn —
  each hero identifiable by outline alone.
- Enemy sprites: strong pose personality (goblin coiled, orc braced, troll looming,
  lizard low and fast) so intent reads at a glance.
- Idle animation: subtle life in the frame (breathing-style motion) rather than
  static statues, subject to the Step 11 scope decision.

### Cutscene pacing (roadmap Steps 4 & 9)
- Emotional, atmospheric beats; soft fades and cross-transitions; short, focused
  narrative moments that trust the player. No beat overstays — the existing intro
  durations (4–7s per beat, always skippable) are the ceiling, not the floor.

### Art direction (roadmap Step 11 and all future assets)
- Blend soft painterly shading with Vitalis's dark, solemn, spiritual tone.
- Muted low-saturation palettes anchored to the existing UI colors
  (deep green-black `#101918`/`#0d1211`, candle-gold `#f3c65f`/`#fff3cc`,
  ember `#ef6f6c`, moss `#66d17b`).
- Warm rim-light as if lit by lantern or Vitalis-glow; heroes carry a faint
  spiritual light, enemies read as hollow and light-absent.
- Strong silhouettes, minimal interior detail; no hard cartoon outlines or
  high-contrast saturation.
- Consistent foot-anchored baselines (the renderer uses foot-anchored origins;
  no baked-in drop shadows — the engine draws shadow ellipses).

## Explicitly out of scope — do NOT alter

These systems remain as designed, regardless of the directive:

1. **The turn-based combat system** (party-vs-group turns, intents, guard/shield/
   rally, spell targeting, items) — presentation may evolve, mechanics may not.
2. **The expedition structure** (menu-driven area selection, scout/search/begin
   flow, win-counter quest objectives).
3. **The readiness / recommended-level system** (Safe/Ready/Danger advice).

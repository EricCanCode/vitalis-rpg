// Lightweight WebAudio synth, ported from the legacy build's playSound
// (archive/legacy-rpg-starter/rpg.js). No samples: every cue is a short
// oscillator recipe so the whole soundscape ships in code.
let context = null;
let enabled = true;

export function setAudioEnabled(value) {
  enabled = !!value;
}

export function isAudioEnabled() {
  return enabled;
}

function getContext() {
  if (context) {
    if (context.state === 'suspended') context.resume();
    return context;
  }
  try {
    context = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    context = null;
  }
  return context;
}

// One-time unlock on the first user gesture (browser autoplay policy).
if (typeof document !== 'undefined') {
  const unlock = () => getContext();
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}

const RECIPES = {
  click: { wave: 'triangle', from: 660, to: 660, duration: 0.05, volume: 0.1 },
  hit: { wave: 'square', from: 200, to: 170, duration: 0.1, volume: 0.32 },
  enemyHit: { wave: 'square', from: 150, to: 110, duration: 0.13, volume: 0.34 },
  break: { wave: 'square', from: 280, to: 140, duration: 0.16, volume: 0.3 },
  magic: { wave: 'sawtooth', from: 520, to: 220, duration: 0.22, volume: 0.22 },
  wave: { wave: 'sawtooth', from: 380, to: 140, duration: 0.3, volume: 0.24 },
  heal: { wave: 'sine', from: 392, to: 660, duration: 0.26, volume: 0.26 },
  shield: { wave: 'triangle', from: 330, to: 392, duration: 0.18, volume: 0.24 },
  guard: { wave: 'triangle', from: 262, to: 262, duration: 0.12, volume: 0.2 },
  buff: { wave: 'triangle', from: 330, to: 494, duration: 0.2, volume: 0.22 },
  encounter: { wave: 'sawtooth', from: 196, to: 98, duration: 0.35, volume: 0.26 },
  achievement: { wave: 'sine', from: 587, to: 880, duration: 0.3, volume: 0.24 }
};

function playTone(ctx, { wave, from, to, duration, volume }, at = 0) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const start = ctx.currentTime + at;
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(from, start);
  if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playSound(type, volumeScale = 1) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (type === 'victory') {
      [[523, 0], [659, 0.11], [784, 0.22]].forEach(([freq, at]) => {
        playTone(ctx, { wave: 'sine', from: freq, to: freq, duration: 0.16, volume: 0.22 * volumeScale }, at);
      });
    } else {
      const recipe = RECIPES[type] || RECIPES.hit;
      playTone(ctx, { ...recipe, volume: recipe.volume * volumeScale });
    }
    if (typeof window !== 'undefined') {
      window.__VITALIS_AUDIO__ = window.__VITALIS_AUDIO__ || { count: 0, last: null };
      window.__VITALIS_AUDIO__.count += 1;
      window.__VITALIS_AUDIO__.last = type;
    }
  } catch {
    // Audio is decorative: never let it break the game.
  }
}

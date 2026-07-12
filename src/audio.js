// Lightweight WebAudio synth, ported from the legacy build's playSound
// (archive/legacy-rpg-starter/rpg.js). No samples: every cue is a short
// oscillator recipe so the whole soundscape ships in code.
let context = null;
let enabled = true;
let musicTimer = null;
let activeTheme = null;
let audioUnlocked = false;

export function setAudioEnabled(value) {
  enabled = !!value;
  if (!enabled) stopMusic();
}

export function isAudioEnabled() {
  return enabled;
}

function getContext() {
  if (!audioUnlocked) return null;
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
  const unlock = () => {
    audioUnlocked = true;
    getContext();
    if (activeTheme) startThemePhrase(activeTheme);
  };
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
  transition: { wave: 'triangle', from: 330, to: 165, duration: 0.32, volume: 0.16 },
  achievement: { wave: 'sine', from: 587, to: 880, duration: 0.3, volume: 0.24 }
};

const MUSIC_THEMES = {
  town: { wave: 'triangle', notes: [262, 330, 392, 330], tempo: 0.42, gap: 4.8, volume: 0.055 },
  inn: { wave: 'sine', notes: [330, 392, 440, 392, 330], tempo: 0.5, gap: 5.4, volume: 0.05 },
  world: { wave: 'triangle', notes: [220, 294, 349, 440, 392], tempo: 0.38, gap: 5.2, volume: 0.052 },
  forest_road: { wave: 'triangle', notes: [196, 247, 294, 330], tempo: 0.36, gap: 4.6, volume: 0.055 },
  old_ruins: { wave: 'sine', notes: [147, 196, 220, 175], tempo: 0.48, gap: 5.8, volume: 0.05 },
  crystal_cave: { wave: 'sine', notes: [247, 330, 494, 392], tempo: 0.44, gap: 5.6, volume: 0.052 },
  blackroot_fen: { wave: 'triangle', notes: [165, 196, 220, 185], tempo: 0.52, gap: 6.1, volume: 0.05 },
  battle: { wave: 'sawtooth', notes: [196, 233, 262, 311, 262], tempo: 0.22, gap: 3.2, volume: 0.045 }
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

function playNoise(ctx, duration, volume, at = 0) {
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(ctx.destination);
  const start = ctx.currentTime + at;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function startThemePhrase(themeId) {
  const theme = MUSIC_THEMES[themeId] || MUSIC_THEMES.town;
  playThemePhrase({ id: themeId, ...theme });
}

function playThemePhrase(theme) {
  if (!enabled || !theme || activeTheme !== theme.id) return;
  const ctx = getContext();
  if (!ctx) return;
  theme.notes.forEach((frequency, index) => {
    playTone(ctx, {
      wave: theme.wave,
      from: frequency,
      to: frequency,
      duration: theme.tempo * 0.82,
      volume: theme.volume
    }, index * theme.tempo);
  });
  musicTimer = window.setTimeout(() => playThemePhrase(theme), (theme.notes.length * theme.tempo + theme.gap) * 1000);
}

export function playMusicTheme(themeId) {
  if (!enabled) return;
  if (activeTheme === themeId) return;
  stopMusic();
  activeTheme = themeId;
  startThemePhrase(themeId);
}

export function stopMusic() {
  if (musicTimer) window.clearTimeout(musicTimer);
  musicTimer = null;
  activeTheme = null;
}

export function playAmbient(type, volumeScale = 1) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (type === 'forest_road' || type === 'town' || type === 'world') {
      playNoise(ctx, 0.8, 0.018 * volumeScale);
      playTone(ctx, { wave: 'sine', from: 880, to: 660, duration: 0.2, volume: 0.035 * volumeScale }, 0.08);
    } else if (type === 'crystal_cave') {
      [660, 990, 1320].forEach((freq, index) => {
        playTone(ctx, { wave: 'sine', from: freq, to: freq * 1.12, duration: 0.55, volume: 0.035 * volumeScale }, index * 0.12);
      });
    } else if (type === 'old_ruins') {
      playTone(ctx, { wave: 'triangle', from: 110, to: 92, duration: 0.6, volume: 0.035 * volumeScale });
      playNoise(ctx, 0.5, 0.012 * volumeScale, 0.1);
    } else if (type === 'blackroot_fen') {
      playTone(ctx, { wave: 'sine', from: 147, to: 123, duration: 0.7, volume: 0.03 * volumeScale });
      playNoise(ctx, 0.7, 0.016 * volumeScale);
    } else if (type === 'inn') {
      playTone(ctx, { wave: 'sine', from: 523, to: 659, duration: 0.32, volume: 0.034 * volumeScale });
    }
    if (typeof window !== 'undefined') {
      window.__VITALIS_AUDIO__ = window.__VITALIS_AUDIO__ || { count: 0, last: null };
      window.__VITALIS_AUDIO__.ambient = type;
    }
  } catch {
    // Decorative ambience should never interrupt play.
  }
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

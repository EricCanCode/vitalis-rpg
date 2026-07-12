// Player settings: persisted separately from the save so they survive
// New Game. Difficulty scales enemy stats at encounter creation only —
// the combat mechanics themselves are protected by DESIGN.md.
import { setAudioEnabled } from './audio.js';

const SETTINGS_KEY = 'vitalis-settings';

export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', enemyScale: 0.85, note: 'Enemies hit softer and fall faster.' },
  { id: 'normal', label: 'Normal', enemyScale: 1, note: 'The intended Vitalis experience.' },
  { id: 'hard', label: 'Hard', enemyScale: 1.2, note: 'Enemies are tougher and hit harder.' }
];

const DEFAULTS = { sound: true, effects: true, difficulty: 'normal' };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = load();

export function updateSetting(key, value) {
  settings[key] = value;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private-mode storage failures should not break the game.
  }
  applySettings();
}

export function applySettings() {
  setAudioEnabled(settings.sound);
}

export function getDifficulty() {
  return DIFFICULTIES.find(entry => entry.id === settings.difficulty) || DIFFICULTIES[1];
}

export function effectsEnabled() {
  return settings.effects;
}

applySettings();

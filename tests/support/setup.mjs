// Installs an in-memory localStorage before src/state.js or src/settings.js
// is ever imported -- both read it at module load time (`const initialSave =
// loadGame()`, `export const settings = load()`), and plain Node has no
// browser storage global of its own. Must be the first import in any test
// file that touches those modules.
const store = new Map();

globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: key => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: index => Array.from(store.keys())[index] ?? null
};

// Deterministic Math.random for tests that exercise roll()/loot/enemy-intent
// selection, all of which are unexported internals only reachable through
// state.js's public actions. Always restores the real Math.random, even if
// the callback throws, so a failing assertion can't leak a stubbed RNG into
// a later, unrelated test.
export function withFixedRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

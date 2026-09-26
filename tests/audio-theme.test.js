// audio.js is otherwise browser-only (AudioContext, document listeners at
// module load), but buildPhraseEvents is a pure function -- given a theme,
// it returns the note/timing data playThemePhrase feeds to the real
// WebAudio calls. Testing it here catches a broken interval or an event
// that overruns into the next phrase without needing a browser at all.
import './support/setup.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPhraseEvents, MUSIC_THEMES } from '../src/audio.js';

const ALL_THEMES = Object.entries(MUSIC_THEMES);

test('buildPhraseEvents returns one melody event per note, plus one bass and one harmony event', () => {
  ALL_THEMES.forEach(([id, theme]) => {
    const events = buildPhraseEvents(theme);
    const melody = events.filter(e => e.voice === 'melody');
    const bass = events.filter(e => e.voice === 'bass');
    const harmony = events.filter(e => e.voice === 'harmony');
    assert.equal(melody.length, theme.notes.length, `${id}: one melody event per note`);
    assert.equal(bass.length, 1, `${id}: exactly one bass drone`);
    assert.equal(harmony.length, 1, `${id}: exactly one harmony accent`);
  });
});

test('the melody events reproduce the theme\'s notes and timing unchanged', () => {
  const theme = MUSIC_THEMES.town;
  const melody = buildPhraseEvents(theme).filter(e => e.voice === 'melody');
  theme.notes.forEach((frequency, index) => {
    assert.equal(melody[index].from, frequency);
    assert.equal(melody[index].to, frequency);
    assert.equal(melody[index].at, index * theme.tempo);
    assert.equal(melody[index].duration, theme.tempo * 0.82);
    assert.equal(melody[index].volume, theme.volume);
  });
});

test('the bass drone sits an octave below the phrase\'s opening note and spans the whole phrase', () => {
  const theme = MUSIC_THEMES.blackroot_fen;
  const bass = buildPhraseEvents(theme).find(e => e.voice === 'bass');
  assert.equal(bass.from, theme.notes[0] / 2);
  assert.equal(bass.to, theme.notes[0] / 2);
  assert.equal(bass.at, 0);
  assert.equal(bass.duration, theme.notes.length * theme.tempo, 'the drone should last exactly as long as the melody, not overrun into the gap');
  assert.equal(bass.volume, theme.volume * 0.55);
});

test('the harmony accent is a perfect fifth above the opening note, on the downbeat only', () => {
  const theme = MUSIC_THEMES.crystal_cave;
  const harmony = buildPhraseEvents(theme).find(e => e.voice === 'harmony');
  assert.equal(harmony.from, theme.notes[0] * 1.5);
  assert.equal(harmony.at, 0);
  assert.equal(harmony.volume, theme.volume * 0.45);
});

test('no event runs past the end of the phrase into where the next loop iteration would start', () => {
  ALL_THEMES.forEach(([id, theme]) => {
    const phraseLength = theme.notes.length * theme.tempo;
    buildPhraseEvents(theme).forEach(event => {
      assert.ok(
        event.at + event.duration <= phraseLength + 1e-9,
        `${id} ${event.voice} event (at ${event.at} + duration ${event.duration}) overruns the ${phraseLength}s phrase`
      );
    });
  });
});

test('added voices stay well under the melody\'s own volume, so they thicken the sound instead of drowning it out', () => {
  ALL_THEMES.forEach(([id, theme]) => {
    const events = buildPhraseEvents(theme);
    const bass = events.find(e => e.voice === 'bass');
    const harmony = events.find(e => e.voice === 'harmony');
    assert.ok(bass.volume < theme.volume, `${id}: bass should be quieter than the lead melody`);
    assert.ok(harmony.volume < theme.volume, `${id}: harmony should be quieter than the lead melody`);
  });
});

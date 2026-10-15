const test = require('node:test');
const assert = require('node:assert/strict');
const { SKIPDIFF_DEFAULTS, normalizeSettings } = require('../src/defaults.js');

test('defaults include memory limits', () => {
  assert.equal(SKIPDIFF_DEFAULTS.memoryDays, 30);
  assert.equal(SKIPDIFF_DEFAULTS.memoryMax, 100);
});

test('normalize fills missing settings from defaults', () => {
  assert.deepEqual(normalizeSettings(undefined), { ...SKIPDIFF_DEFAULTS });
  assert.deepEqual(normalizeSettings({ mode: 'collapse' }), { ...SKIPDIFF_DEFAULTS, mode: 'collapse' });
});

test('normalize keeps valid stored values', () => {
  const s = { patterns: ['a/**'], mode: 'collapse', memoryDays: 7, memoryMax: 5 };
  assert.deepEqual(normalizeSettings(s), s);
});

test('normalize replaces invalid values with defaults', () => {
  const s = normalizeSettings({ patterns: 'x', mode: 'nope', memoryDays: 0, memoryMax: 2.5 });
  assert.deepEqual(s, { ...SKIPDIFF_DEFAULTS });
  assert.equal(normalizeSettings({ memoryDays: '7' }).memoryDays, 30);
  assert.equal(normalizeSettings({ memoryMax: -1 }).memoryMax, 100);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { SKIPDIFF_DEFAULTS, normalizeSettings } = require('../src/defaults.js');

test('normalize fills missing settings from defaults', () => {
  assert.deepEqual(normalizeSettings(undefined), { ...SKIPDIFF_DEFAULTS });
  assert.deepEqual(normalizeSettings({ enabled: false }), { ...SKIPDIFF_DEFAULTS, enabled: false });
});

test('normalize keeps valid stored values', () => {
  const s = { enabled: false, patterns: ['a/**'] };
  assert.deepEqual(normalizeSettings(s), s);
});

test('normalize replaces invalid values with defaults', () => {
  assert.deepEqual(normalizeSettings({ enabled: 'no', patterns: 'x' }), { ...SKIPDIFF_DEFAULTS });
});

test('normalize drops settings of older versions', () => {
  const s = normalizeSettings({ patterns: ['a'], mode: 'viewed', memoryDays: 30, memoryMax: 100 });
  assert.deepEqual(s, { enabled: true, patterns: ['a'] });
});

test('default patterns match lock files', () => {
  const { matchesPath } = require('../src/matcher.js');
  for (const p of ['yarn.lock', 'pkg/Cargo.lock', 'package-lock.json', 'web/pnpm-lock.yaml', 'bun.lockb', 'go.sum']) {
    assert.ok(matchesPath(p, SKIPDIFF_DEFAULTS.patterns), p);
  }
  assert.ok(!matchesPath('package.json', SKIPDIFF_DEFAULTS.patterns));
});

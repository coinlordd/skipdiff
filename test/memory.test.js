const test = require('node:test');
const assert = require('node:assert/strict');
const { rememberTicked, wasTicked, pruneTicked } = require('../src/memory.js');

const DAY = 24 * 60 * 60 * 1000;
const LIMITS = { days: 30, max: 100 };

test('remember then lookup', () => {
  const t = rememberTicked({}, 'pr1', 'a.test.ts', 1000, LIMITS);
  assert.equal(wasTicked(t, 'pr1', 'a.test.ts'), true);
  assert.equal(wasTicked(t, 'pr1', 'b.test.ts'), false);
  assert.equal(wasTicked(t, 'pr2', 'a.test.ts'), false);
});

test('lookup tolerates missing or malformed data', () => {
  assert.equal(wasTicked(undefined, 'pr1', 'a'), false);
  assert.equal(wasTicked({ pr1: null }, 'pr1', 'a'), false);
  assert.equal(wasTicked({ pr1: { at: 1 } }, 'pr1', 'a'), false);
});

test('remember refreshes the timestamp of the PR', () => {
  let t = rememberTicked({}, 'pr1', 'a', 1000, LIMITS);
  t = rememberTicked(t, 'pr1', 'b', 5000, LIMITS);
  assert.equal(t.pr1.at, 5000);
  assert.deepEqual(Object.keys(t.pr1.paths).sort(), ['a', 'b']);
});

test('prune drops PRs not touched within the given number of days', () => {
  const t = { old: { at: 0, paths: { a: true } }, fresh: { at: 31 * DAY, paths: { a: true } } };
  assert.deepEqual(Object.keys(pruneTicked(t, 31 * DAY, LIMITS)), ['fresh']);
  assert.deepEqual(Object.keys(pruneTicked(t, 31 * DAY, { days: 40, max: 100 })).sort(), ['fresh', 'old']);
});

test('prune keeps at most the given number of PRs, dropping the least recently touched', () => {
  let t = {};
  for (let i = 0; i <= 100; i++) t = rememberTicked(t, 'pr' + i, 'a', i, LIMITS);
  assert.equal(Object.keys(t).length, 100);
  assert.equal('pr0' in t, false);
  assert.equal('pr100' in t, true);
  const small = pruneTicked(t, 100, { days: 30, max: 3 });
  assert.deepEqual(Object.keys(small).sort(), ['pr100', 'pr98', 'pr99']);
});

test('prune drops malformed entries', () => {
  const t = pruneTicked({ bad: true, worse: { paths: {} }, ok: { at: 10, paths: { a: true } } }, 20, LIMITS);
  assert.deepEqual(Object.keys(t), ['ok']);
});

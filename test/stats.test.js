const test = require('node:test');
const assert = require('node:assert/strict');
global.matchesPath = require('../src/matcher.js').matchesPath;
const { splitStats } = require('../src/stats.js');

test('splits totals into kept and skipped files', () => {
  const s = splitStats([
    { path: 'src/a.ts', linesAdded: 10, linesDeleted: 2 },
    { path: 'src/a.test.ts', linesAdded: 100, linesDeleted: 50 },
    { path: 'yarn.lock', linesAdded: 1000, linesDeleted: 0 },
  ], ['*.test.*', '*.lock']);
  assert.deepEqual(s.kept, { files: 1, added: 10, deleted: 2 });
  assert.deepEqual(s.skipped, { files: 2, added: 1100, deleted: 50 });
});

test('empty list gives zero totals', () => {
  assert.deepEqual(splitStats([], ['*']), {
    kept: { files: 0, added: 0, deleted: 0 },
    skipped: { files: 0, added: 0, deleted: 0 },
  });
});

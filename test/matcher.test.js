const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesPath, globToRegExp } = require('../src/matcher.js');

const DEFAULTS = require('../src/defaults.js').SKIPDIFF_DEFAULTS.patterns;

test('basename pattern matches at any depth', () => {
  assert.equal(matchesPath('src/a/b/foo.test.ts', ['*.test.*']), true);
  assert.equal(matchesPath('foo.test.ts', ['*.test.*']), true);
});

test('basename pattern does not match a directory segment', () => {
  assert.equal(matchesPath('x.test.d/foo.ts', ['*.test.*']), false);
});

test('single star does not cross a slash', () => {
  assert.equal(matchesPath('src/deep/foo.js', ['src/*.js']), false);
  assert.equal(matchesPath('src/foo.js', ['src/*.js']), true);
});

test('double star crosses slashes', () => {
  assert.equal(matchesPath('src/a/b/fixtures/x.json', ['src/**/fixtures/*.json']), true);
  assert.equal(matchesPath('src/fixtures/x.yaml', ['src/**/fixtures/*.json']), false);
});

test('directory pattern matches at any depth', () => {
  assert.equal(matchesPath('test/a.go', ['test/**']), true);
  assert.equal(matchesPath('pkg/test/a.go', ['test/**']), true);
  assert.equal(matchesPath('pkg/testing/a.go', ['test/**']), false);
  assert.equal(matchesPath('contest/a.go', ['test/**']), false);
});

test('matching is case-sensitive', () => {
  assert.equal(matchesPath('Foo.Test.ts', ['*.test.*']), false);
});

test('blank and comment lines are ignored', () => {
  assert.equal(matchesPath('anything.js', ['', '   ', '# *.js']), false);
});

test('trailing carriage return is ignored', () => {
  assert.equal(matchesPath('foo.test.ts', ['*.test.*\r']), true);
});

test('regex metacharacters are literal and never throw', () => {
  assert.equal(matchesPath('foo.bar(1).js', ['foo.bar(1).js']), true);
  assert.equal(matchesPath('fooXbar(1).js', ['foo.bar(1).js']), false);
  assert.doesNotThrow(() => matchesPath('x', ['[', '(', '\\', '{']));
  assert.equal(matchesPath('[', ['[']), true);
});

test('empty pattern list matches nothing', () => {
  assert.equal(matchesPath('foo.test.ts', []), false);
});

test('default patterns cover common test layouts', () => {
  for (const p of ['src/foo.test.ts', 'src/foo.spec.js', 'src/__tests__/foo.js']) {
    assert.equal(matchesPath(p, DEFAULTS), true, p);
  }
  for (const p of [
    'src/foo.ts', 'src/testing.ts', 'latest/foo.js', 'pkg/foo.go',
    'test/foo.py', 'tests/unit/foo.py', 'pkg/foo_test.go',
  ]) {
    assert.equal(matchesPath(p, DEFAULTS), false, p);
  }
});

test('globToRegExp anchors both ends', () => {
  assert.equal(globToRegExp('a*').test('xa'), false);
  assert.equal(globToRegExp('a*').test('ab'), true);
});

test('double star followed by slash matches zero directories', () => {
  assert.equal(matchesPath('src/fixtures/x.json', ['src/**/fixtures/*.json']), true);
  assert.equal(matchesPath('README.md', ['**/*.md']), true);
  assert.equal(matchesPath('docs/a/b.md', ['**/*.md']), true);
});

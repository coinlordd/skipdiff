// Shared by content script and options page as a global.
const SKIPDIFF_DEFAULTS = Object.freeze({
  patterns: ['*.test.*', '*.spec.*', '__tests__/**'],
  mode: 'viewed', // 'collapse' | 'viewed'. Viewed makes GitHub collapse the diff itself.
  memoryDays: 30, // forget a PR's ticked files this many days after the last tick
  memoryMax: 100, // remember at most this many PRs; the oldest last tick goes first
});

// Stored settings merged over the defaults; any invalid value falls back to its default.
function normalizeSettings(stored) {
  const d = SKIPDIFF_DEFAULTS;
  const s = { ...d, ...(stored || {}) };
  if (!['collapse', 'viewed'].includes(s.mode)) s.mode = d.mode;
  if (!Array.isArray(s.patterns)) s.patterns = d.patterns;
  for (const k of ['memoryDays', 'memoryMax']) {
    if (!Number.isInteger(s[k]) || s[k] < 1) s[k] = d[k];
  }
  return s;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SKIPDIFF_DEFAULTS, normalizeSettings };
}

// Shared by content script and options page as a global.
const SKIPDIFF_DEFAULTS = Object.freeze({
  enabled: true, // the on/off switch in the popup; off shows every diff again
  patterns: [
    '*.test.*', '*.spec.*', '__tests__/**',
    // lock files
    '*.lock', 'package-lock.json', 'pnpm-lock.yaml', 'bun.lockb', 'go.sum',
  ],
});

// Stored settings merged over the defaults; any invalid value falls back to its
// default. Keys that are not in the defaults (e.g. the old `mode`) are dropped.
function normalizeSettings(stored) {
  const d = SKIPDIFF_DEFAULTS;
  const s = { ...d, ...(stored || {}) };
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : d.enabled,
    patterns: Array.isArray(s.patterns) ? s.patterns : d.patterns,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SKIPDIFF_DEFAULTS, normalizeSettings };
}

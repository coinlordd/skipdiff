// Memory of files SkipDiff ticked "Viewed", per PR. Pure functions, shared by
// the content script (as globals) and Node tests.
// Shape: { [prKey]: { at: <ms timestamp of last tick>, paths: { [path]: true } } }
// limits = { days, max }: a PR entry expires `days` after its last tick, and at
// most `max` entries are kept. The values come from the settings.

const DAY_MS = 24 * 60 * 60 * 1000;

function wasTicked(ticked, prKey, path) {
  const entry = ticked && ticked[prKey];
  return !!(entry && entry.paths && entry.paths[path]);
}

function rememberTicked(ticked, prKey, path, now, limits) {
  const next = { ...(ticked || {}) };
  const entry = next[prKey] && next[prKey].paths ? next[prKey] : { paths: {} };
  next[prKey] = { at: now, paths: { ...entry.paths, [path]: true } };
  return pruneTicked(next, now, limits);
}

function pruneTicked(ticked, now, limits) {
  const ttl = limits.days * DAY_MS;
  const entries = Object.entries(ticked || {})
    .filter(([, e]) => e && typeof e.at === 'number' && e.paths && now - e.at <= ttl)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, limits.max);
  return Object.fromEntries(entries);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { wasTicked, rememberTicked, pruneTicked };
}

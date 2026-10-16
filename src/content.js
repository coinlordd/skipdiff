// SkipDiff content script. Collapses or marks "Viewed" matching diffs on
// GitHub PR "Files changed" pages. Each diff is handled once per page load.
// Files this script ticked "Viewed" are remembered per PR (see memory.js), so
// a file the user unticks later is left alone on the next visit.

const FILES_URL = /^(\/[^/]+\/[^/]+\/pull\/\d+)\/(files|changes)(\/|$)/;
const DONE_ATTR = 'data-skipdiff';

// One adapter per GitHub UI variant. Each adapter knows how to find a diff
// container, read its path, and find its two controls.
const ADAPTERS = [
  {
    name: 'server-rendered',
    containers: () => document.querySelectorAll('div.file.js-file'),
    path: (el) => {
      const header = el.querySelector('.file-header[data-path]');
      if (header) return header.getAttribute('data-path');
      const entry = el.closest('copilot-diff-entry[data-file-path]');
      return entry ? entry.getAttribute('data-file-path') : el.getAttribute('data-tagsearch-path');
    },
    toggle: (el) => el.querySelector('button.js-details-target'),
    isExpanded: (el) => {
      const t = el.querySelector('button.js-details-target');
      return t ? t.getAttribute('aria-expanded') !== 'false' : el.classList.contains('open');
    },
    viewed: (el) => el.querySelector('input.js-reviewed-checkbox'),
    isViewed: (box) => box.checked,
  },
  {
    // React "Files changed" view (2026), served at /pull/N/changes.
    name: 'react',
    containers: () => document.querySelectorAll('div[role="region"][id^="diff-"]'),
    path: (el) => {
      const heading = el.querySelector('h3[id^="heading-"] code');
      if (heading) return heading.textContent.replace(/\u200e/g, '').trim();
      const withPath = el.querySelector('[data-file-path]');
      return withPath ? withPath.getAttribute('data-file-path') : null;
    },
    toggle: (el) => el.querySelector('[data-diff-header-wrapper] button'),
    isExpanded: (el) => {
      const t = el.querySelector('[data-diff-header-wrapper] button');
      if (!t) return false;
      const tip = document.getElementById(t.getAttribute('aria-labelledby') || '');
      if (tip) return /collapse/i.test(tip.textContent);
      return !!t.querySelector('svg.octicon-chevron-down');
    },
    // Rich-diff files (e.g. .md) add icon-only aria-pressed toggles before "Viewed"; only "Viewed" has text.
    viewed: (el) => [...el.querySelectorAll('[data-diff-header-wrapper] button[aria-pressed]')]
      .find((b) => b.textContent.trim()) || null,
    isViewed: (box) => box.getAttribute('aria-pressed') === 'true',
  },
];

let settings = normalizeSettings();
let ticked = {}; // see memory.js for the shape, TTL and cap

function prKey() {
  const m = FILES_URL.exec(location.pathname);
  return m ? m[1] : null;
}

function limits() {
  return { days: settings.memoryDays, max: settings.memoryMax };
}

function remember(key, path) {
  ticked = rememberTicked(ticked, key, path, Date.now(), limits());
  chrome.storage.local.set({ ticked });
}

// The React view renders its buttons before hydration, and GitHub drops
// clicks made before then. So click, check, and retry until "Viewed" sticks;
// the path is remembered only once the tick is confirmed.
const TICK_RETRY_MS = 500;
const TICK_MAX_TRIES = 10;

function tickViewed(adapter, el, key, path, tries) {
  if (!el.isConnected) return;
  const box = adapter.viewed(el);
  if (!box) return;
  if (adapter.isViewed(box)) {
    remember(key, path);
    // Some views may not collapse on "Viewed"; check once the UI settled.
    setTimeout(() => {
      if (adapter.isExpanded(el)) {
        const t = adapter.toggle(el);
        if (t) t.click();
      }
    }, 300);
    return;
  }
  if (tries >= TICK_MAX_TRIES) return;
  box.click();
  setTimeout(() => tickViewed(adapter, el, key, path, tries + 1), TICK_RETRY_MS);
}

function handle(adapter, el, key) {
  if (el.hasAttribute(DONE_ATTR)) return;
  const path = adapter.path(el);
  if (!path || !matchesPath(path, settings.patterns)) return;
  el.setAttribute(DONE_ATTR, 'done');

  if (settings.mode === 'viewed') {
    // GitHub collapses the diff itself when "Viewed" is ticked.
    if (wasTicked(ticked, key, path)) return; // ticked before; the user may have unticked it on purpose
    const box = adapter.viewed(el);
    if (box && !adapter.isViewed(box)) tickViewed(adapter, el, key, path, 0);
  } else if (adapter.isExpanded(el)) {
    const t = adapter.toggle(el);
    if (t) t.click();
  }
}

function scan() {
  const key = prKey();
  if (!key) return;
  for (const adapter of ADAPTERS) {
    for (const el of adapter.containers()) handle(adapter, el, key);
  }
}

let scanTimer;
function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scan, 100);
}

Promise.all([chrome.storage.sync.get('settings'), chrome.storage.local.get('ticked')])
  .catch(() => [{}, {}])
  .then(([sync, local]) => {
    settings = normalizeSettings(sync && sync.settings);
    ticked = pruneTicked(local && local.ticked, Date.now(), limits());
    scan();
    // GitHub navigates as a SPA (Turbo) and may replace <body>; observing the root catches every navigation.
    new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
  });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings) {
    settings = normalizeSettings(changes.settings.newValue);
    scheduleScan();
  }
  // Another tab or the popup changed the memory (e.g. "Clear memory"). Adopt
  // it, or this tab would write its stale copy back on the next tick.
  if (area === 'local' && changes.ticked) {
    ticked = changes.ticked.newValue || {};
  }
});

// SkipDiff content script. Hides the body of matching diffs on GitHub PR
// "Files changed" pages; the file header stays. It only adds CSS, so GitHub's
// "Viewed" state is left to the user. Next to GitHub's stats, a badge shows the
// PR's size without the skipped files; a click on it shows or hides them.

const FILES_URL = /^\/[^/]+\/[^/]+\/pull\/\d+\/(files|changes)(\/|$)/;
const SKIP_ATTR = 'data-skipdiff';
const HIDE_STYLE_ID = 'skipdiff-hide';

// One adapter per GitHub UI variant: a diff container, its path, the part of it
// to hide and its expand/collapse button (selectors relative to the container),
// and optionally that button's icon, turned to "collapsed" while hidden, and
// the header parts that need a closed bottom edge while the body is hidden.
const ADAPTERS = [
  {
    container: 'div.file.js-file',
    path: (el) => {
      const header = el.querySelector('.file-header[data-path]');
      if (header) return header.getAttribute('data-path');
      const entry = el.closest('copilot-diff-entry[data-file-path]');
      return entry ? entry.getAttribute('data-file-path') : el.getAttribute('data-tagsearch-path');
    },
    body: '.js-file-content',
    toggle: 'button.js-details-target',
  },
  {
    // React "Files changed" view (2026), served at /pull/N/changes. It renders
    // only the diffs near the viewport. A diff's id is `diff-<pathDigest>`.
    container: 'div[role="region"][id^="diff-"]',
    path: (el) => {
      const heading = el.querySelector('h3[id^="heading-"] code');
      if (heading) return heading.textContent.replace(/\u200e/g, '').trim();
      const withPath = el.querySelector('[data-file-path]');
      return withPath ? withPath.getAttribute('data-file-path') : null;
    },
    body: '> :not(:first-child)',
    toggle: '[data-diff-header-wrapper] button',
    chevron: '> :first-child svg.octicon-chevron-down',
    // The header's wrapper has square bottom corners and clips the header's border.
    wrapper: '> :first-child',
    header: '> :first-child > [class*="diff-file-header"]',
  },
];
const REACT = ADAPTERS[1];

let settings = normalizeSettings();
let showSkipped = false; // the badge toggle; resets when the PR's numbers change
let revealed = new Set(); // paths opened by hand with their chevron; reset with showSkipped

// ---- hiding
// Two ways, same CSS: diffs in the DOM get SKIP_ATTR from scan(); for the React
// view we also write one rule per skipped file id from GitHub's file list, so
// a diff that renders on scroll is hidden from its first paint.

// The file list split by the patterns. Cached: scan() runs on every DOM change.
let derived = null;
function derive() {
  if (!summaries) return null;
  if (derived && derived.summaries === summaries && derived.patterns === settings.patterns) return derived;
  derived = {
    summaries,
    patterns: settings.patterns,
    stats: splitStats(summaries, settings.patterns),
    skip: summaries.filter((f) => /^[0-9a-f]+$/.test(f.pathDigest) && matchesPath(f.path, settings.patterns)),
  };
  return derived;
}

// GitHub's diff header has margin-bottom: -1px to overlap the body's border.
// Without a body (collapsed by GitHub, or hidden by us) that clips the header's
// own bottom border. This also fixes GitHub's own collapsed files.
const COLLAPSED_FIX = '[class*="diff-file-header"][class*="collapsed"] { margin-bottom: 0 !important; }';

let cssMemo = null;
function hideCss(active) {
  if (!active) return '';
  if (showSkipped) return COLLAPSED_FIX;
  const d = derive();
  if (cssMemo && cssMemo.d === d && cssMemo.revealed === revealed.size) return cssMemo.css;
  const hidden = ADAPTERS.map((a) => [a, `${a.container}[${SKIP_ATTR}="skip"]`]);
  if (d) {
    for (const f of d.skip) if (!revealed.has(f.path)) hidden.push([REACT, `#diff-${f.pathDigest}`]);
  }
  const bodies = hidden.map(([a, sel]) => `${sel} ${a.body}`);
  const part = (key) => hidden.filter(([a]) => a[key]).map(([a, sel]) => `${sel} ${a[key]}`).join(',\n');
  const round = 'border-bottom-left-radius: 6px !important; border-bottom-right-radius: 6px !important;';
  const css = `${COLLAPSED_FIX}\n${bodies.join(',\n')} { display: none !important; }\n`
    + `${part('chevron')} { transform: rotate(-90deg); }\n`
    + `${part('wrapper')} { ${round} }\n`
    + `${part('header')} { margin-bottom: 0 !important; border-bottom-width: 1px !important;`
    + ` border-bottom-style: solid !important; ${round} }`;
  cssMemo = { d, revealed: revealed.size, css };
  return css;
}

function applyHideCss() {
  const css = hideCss(settings.enabled && FILES_URL.test(location.pathname));
  let style = document.getElementById(HIDE_STYLE_ID);
  if (!style) {
    if (!css) return;
    style = document.createElement('style');
    style.id = HIDE_STYLE_ID;
    document.head.append(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

function mark(adapter, el) {
  if (el.hasAttribute(SKIP_ATTR)) return;
  const path = adapter.path(el);
  if (!path) return;
  const skip = matchesPath(path, settings.patterns);
  el.setAttribute(SKIP_ATTR, !skip ? 'keep' : revealed.has(path) ? 'shown' : 'skip');
}

// A click on a hidden file's expand button shows that one file. We take the
// click before GitHub does (capture on window), so GitHub does not also toggle
// it. Later clicks on it go to GitHub as usual.
function onClick(e) {
  if (!settings.enabled || showSkipped || !(e.target instanceof Element)) return;
  for (const a of ADAPTERS) {
    const button = e.target.closest(a.toggle);
    const el = button && button.closest(a.container);
    if (!el || button !== el.querySelector(a.toggle)) continue;
    const path = a.path(el);
    const body = el.querySelector(':scope ' + a.body);
    if (!path || revealed.has(path) || !matchesPath(path, settings.patterns)) return;
    if (!body || getComputedStyle(body).display !== 'none') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    revealed.add(path);
    el.setAttribute(SKIP_ATTR, 'shown');
    applyHideCss();
    return;
  }
}

// Patterns changed: every diff must be matched again.
function unmarkAll() {
  for (const el of document.querySelectorAll(`[${SKIP_ATTR}]`)) el.removeAttribute(SKIP_ATTR);
}

// ---- GitHub's file list
// GitHub's stats ("+14.374 −53.360 ■■■■□") carry a screen-reader span with the
// raw numbers. The per-file list (diffSummaries: path, pathDigest, linesAdded,
// linesDeleted) is in the page on a hard load. A SPA navigation does not put it
// in the page, so then we fetch it from the JSON route that GitHub's SPA uses.
// We load it again when the URL or GitHub's own numbers change (new commits).

const loadPath = location.pathname; // the page the inline JSON belongs to
let inlineUsed = false;
let statsKey = null; // URL + GitHub's numbers that `summaries` belongs to
let summaries = null; // diffSummaries for statsKey; null while loading or on failure
let loading = false; // a fetch for statsKey is in flight

function listOf(json) {
  const route = json && json.payload && json.payload.pullRequestsChangesRoute;
  return route && Array.isArray(route.diffSummaries) ? route.diffSummaries : null;
}

function inlineSummaries() {
  const s = document.querySelector('script[data-target="react-app.embeddedData"]');
  try { return s ? listOf(JSON.parse(s.textContent)) : null; } catch { return null; }
}

function fetchSummaries(url) {
  return fetch(url, { headers: {
    Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'GitHub-Verified-Fetch': 'true',
  } })
    .then((r) => (r.ok ? r.json() : null))
    .then(listOf)
    .catch(() => null);
}

// Each file header has the same span for its own stats; skip those.
const DIFF_CONTAINERS = ADAPTERS.map((a) => a.container).join(', ');
function statsAnchor() {
  return [...document.querySelectorAll('span.sr-only')]
    .find((e) => e.textContent.startsWith('Lines changed:') && !e.closest(DIFF_CONTAINERS));
}

function loadSummaries(anchor) {
  const key = location.pathname + '|' + anchor.textContent;
  if (key === statsKey) return;
  statsKey = key;
  showSkipped = false;
  revealed = new Set();
  summaries = null;
  loading = false;
  if (!inlineUsed && location.pathname === loadPath) {
    inlineUsed = true;
    summaries = inlineSummaries();
    if (summaries) return;
  }
  loading = true;
  fetchSummaries(location.pathname).then((list) => {
    if (statsKey !== key) return; // navigated on meanwhile
    summaries = list;
    loading = false;
    scheduleScan();
  });
}

// ---- review-size badge (React view only)

const BADGE_ID = 'skipdiff-badge';
// Colors from the popup's palette (options.html), so the badge reads as SkipDiff.
const BADGE_CSS = `
#${BADGE_ID} { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; padding: 2px 8px 2px 4px;
  border: 1px solid #2f6b3d; border-radius: 999px; background: #14231a; color: #93a197;
  font: inherit; font-size: 12px; line-height: 18px; white-space: nowrap; cursor: pointer; }
#${BADGE_ID}:hover { border-color: #3fb950; }
#${BADGE_ID}:disabled { cursor: default; border-color: #2f6b3d; }
#${BADGE_ID} img { width: 16px; height: 16px; border-radius: 4px; }
#${BADGE_ID} .sd-files { color: #e6ede8; }
#${BADGE_ID} .sd-add { color: #3fb950; }
#${BADGE_ID} .sd-del { color: #ff8c82; }
`;
let badgeKey = null; // what the badge on screen shows, to skip no-op redraws

function span(text, cls) {
  const s = document.createElement('span');
  s.textContent = text;
  if (cls) s.className = cls;
  return s;
}

function removeBadge() {
  const old = document.getElementById(BADGE_ID);
  if (old) old.remove();
}

// parts: the nodes after the logo; title: the tooltip; pressed: null while loading.
function showBadge(anchor, key, parts, title, pressed) {
  // Checked on each call: a Turbo navigation can swap <head> and drop the style.
  if (!document.getElementById(BADGE_ID + '-style')) {
    const style = document.createElement('style');
    style.id = BADGE_ID + '-style';
    style.textContent = BADGE_CSS;
    document.head.append(style);
  }
  if (badgeKey === key && document.getElementById(BADGE_ID)) return;
  removeBadge();
  badgeKey = key;
  const logo = document.createElement('img');
  logo.src = chrome.runtime.getURL('icons/icon32.png');
  logo.alt = '';
  const b = document.createElement('button');
  b.type = 'button';
  b.id = BADGE_ID;
  b.title = title;
  if (pressed === null) b.disabled = true;
  else b.setAttribute('aria-pressed', pressed);
  b.append(logo, ...parts);
  b.addEventListener('click', () => {
    showSkipped = !showSkipped;
    scan();
  });
  anchor.parentElement.append(b);
}

function renderBadge(anchor) {
  if (loading) return showBadge(anchor, statsKey + '|loading', [span('loading…')], 'SkipDiff is loading the file list', null);
  if (!summaries) return removeBadge(); // the fetch failed
  const { kept, skipped } = derive().stats;
  if (skipped.files === 0) return removeBadge();
  const n = (x) => x.toLocaleString();
  const what = `${n(skipped.files)} files (+${n(skipped.added)} −${n(skipped.deleted)})`;
  showBadge(anchor, [statsKey, settings.patterns.join('\n'), showSkipped].join('|'), [
    span(`${n(kept.files)} files`, 'sd-files'), '·',
    span(`+${n(kept.added)}`, 'sd-add'), span(`−${n(kept.deleted)}`, 'sd-del'), '·',
    span(showSkipped ? `showing ${n(skipped.files)}` : `hidden ${n(skipped.files)}`),
  ], showSkipped ? `SkipDiff shows ${what}. Click to hide them.` : `SkipDiff hides ${what}. Click to show them.`,
  showSkipped);
}

// ---- main loop

function scan() {
  const active = settings.enabled && FILES_URL.test(location.pathname);
  const anchor = active ? statsAnchor() : null;
  if (anchor) {
    loadSummaries(anchor);
    renderBadge(anchor);
  } else {
    removeBadge();
  }
  if (active) {
    for (const adapter of ADAPTERS) {
      for (const el of document.querySelectorAll(adapter.container)) mark(adapter, el);
    }
  }
  applyHideCss();
}

let scanTimer;
function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scan, 100);
}

window.addEventListener('click', onClick, true);
chrome.storage.local.remove('ticked'); // the "Viewed" memory of v0.1; no longer used

chrome.storage.sync.get('settings')
  .catch(() => ({}))
  .then((sync) => {
    settings = normalizeSettings(sync && sync.settings);
    // GitHub navigates as a SPA (Turbo) and may replace <body>; observing the root catches every navigation.
    // Started before the first scan, so an error in a scan cannot stop it.
    new MutationObserver(scheduleScan)
      .observe(document.documentElement, { childList: true, subtree: true });
    scan();
  });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings) {
    settings = normalizeSettings(changes.settings.newValue);
    unmarkAll();
    scheduleScan();
  }
});

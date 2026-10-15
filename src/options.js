// Popup and options page. Reads and writes `settings` (sync) and shows or
// clears the memory of ticked files, `ticked` (local).
const $ = (id) => document.getElementById(id);
const patternsEl = $('patterns');
const gutterEl = $('gutter');
const daysEl = $('memoryDays');
const maxEl = $('memoryMax');
const countEl = $('count');
const clearEl = $('clear');
const statusEl = $('status');

let settings = normalizeSettings();
let saved = null; // last value written, as JSON, to skip no-op writes
let ticked = {};

// ---- form <-> settings

function fill(s) {
  patternsEl.value = s.patterns.join('\n');
  document.querySelector(`input[name=mode][value=${s.mode}]`).checked = true;
  daysEl.value = s.memoryDays;
  maxEl.value = s.memoryMax;
  updateGutter();
}

// A number field that is not a positive integer keeps the last saved value.
function readInt(el, fallback) {
  return el.checkValidity() ? Number(el.value) : fallback;
}

function current() {
  return {
    patterns: patternsEl.value.split('\n'),
    mode: document.querySelector('input[name=mode]:checked').value,
    memoryDays: readInt(daysEl, settings.memoryDays),
    memoryMax: readInt(maxEl, settings.memoryMax),
  };
}

// Save only on a finished edit (change fires when a field loses focus), never
// on each keystroke: a half-typed pattern like `*` would otherwise go live in
// every open PR tab at once.
function save() {
  if (saved === null) return; // not loaded yet: the form is still empty
  settings = normalizeSettings(current());
  const json = JSON.stringify(settings);
  if (json === saved) return;
  saved = json;
  chrome.storage.sync.set({ settings }, () => flash('saved'));
  updateCount();
}

let flashTimer;
function flash(text) {
  statusEl.textContent = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { statusEl.textContent = ''; }, 1500);
}

// ---- pattern editor line numbers

function updateGutter() {
  const n = patternsEl.value.split('\n').length;
  gutterEl.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
  gutterEl.scrollTop = patternsEl.scrollTop;
}

// ---- memory

function updateCount() {
  const n = Object.keys(pruneTicked(ticked, Date.now(), { days: settings.memoryDays, max: settings.memoryMax })).length;
  countEl.textContent = n;
  clearEl.disabled = n === 0;
}

function clearMemory() {
  chrome.storage.local.remove('ticked', () => {
    ticked = {};
    updateCount();
    flash('memory cleared');
  });
}

// ---- tabs (arrow keys move between tabs, as the ARIA tabs pattern expects)

const tabs = [...document.querySelectorAll('[role=tab]')];
function selectTab(tab, focus) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
}
for (const t of tabs) {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) selectTab(tabs[(tabs.indexOf(t) + step + tabs.length) % tabs.length], true);
  });
}

// ---- wiring

patternsEl.addEventListener('input', updateGutter);
patternsEl.addEventListener('scroll', () => { gutterEl.scrollTop = patternsEl.scrollTop; });
patternsEl.addEventListener('change', save);
for (const r of document.querySelectorAll('input[name=mode]')) r.addEventListener('change', save);
for (const el of [daysEl, maxEl]) {
  el.addEventListener('change', () => {
    if (!el.checkValidity()) el.value = el === daysEl ? settings.memoryDays : settings.memoryMax;
    save();
  });
}
clearEl.addEventListener('click', clearMemory);
$('reset').addEventListener('click', () => { fill(normalizeSettings()); save(); });
window.addEventListener('pagehide', save); // the popup can close without a blur

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.ticked) {
    ticked = changes.ticked.newValue || {};
    updateCount();
  }
});

$('version').textContent = 'v' + chrome.runtime.getManifest().version;

Promise.all([chrome.storage.sync.get('settings'), chrome.storage.local.get('ticked')])
  .then(([sync, local]) => {
    settings = normalizeSettings(sync.settings);
    ticked = local.ticked || {};
    fill(settings);
    saved = JSON.stringify(settings);
    updateCount();
  });

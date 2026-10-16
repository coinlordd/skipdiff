// Popup and options page. Reads and writes `settings` (sync).
const $ = (id) => document.getElementById(id);
const patternsEl = $('patterns');
const gutterEl = $('gutter');
const statusEl = $('status');
const enabledEl = $('enabled');

let saved = null; // last value written, as JSON, to skip no-op writes

// ---- form <-> settings

function setEnabled(on) {
  enabledEl.setAttribute('aria-checked', on);
  enabledEl.querySelector('.state').textContent = on ? 'On' : 'Off';
  document.body.classList.toggle('off', !on);
}

function fill(s) {
  setEnabled(s.enabled);
  patternsEl.value = s.patterns.join('\n');
  updateGutter();
}

function current() {
  return {
    enabled: enabledEl.getAttribute('aria-checked') === 'true',
    patterns: patternsEl.value.split('\n'),
  };
}

// Save only on a finished edit (change fires when a field loses focus), never
// on each keystroke: a half-typed pattern like `*` would otherwise go live in
// every open PR tab at once.
function save() {
  if (saved === null) return; // not loaded yet: the form is still empty
  const settings = normalizeSettings(current());
  const json = JSON.stringify(settings);
  if (json === saved) return;
  saved = json;
  chrome.storage.sync.set({ settings }, () => flash('saved'));
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

// ---- wiring

patternsEl.addEventListener('input', updateGutter);
patternsEl.addEventListener('scroll', () => { gutterEl.scrollTop = patternsEl.scrollTop; });
patternsEl.addEventListener('change', save);
enabledEl.addEventListener('click', () => {
  setEnabled(enabledEl.getAttribute('aria-checked') !== 'true');
  save();
});
$('reset').addEventListener('click', () => { fill(normalizeSettings()); save(); });
window.addEventListener('pagehide', save); // the popup can close without a blur

$('version').textContent = 'v' + chrome.runtime.getManifest().version;

chrome.storage.sync.get('settings').then((sync) => {
  const settings = normalizeSettings(sync.settings);
  fill(settings);
  saved = JSON.stringify(settings);
});

// Minimal glob matcher. Shared by the content script (as globals) and Node tests.
// Rules: `*` = any run without `/`; `**` = any run including `/`;
// `**/` also matches zero directories.
// Pattern without `/` matches the basename. Pattern with `/` matches the full
// path or any `/`-aligned suffix of it. Case-sensitive. Never throws.

const REGEX_SPECIALS = /[.+?^${}()|[\]\\]/;

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*' && glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; }
      else if (glob[i + 1] === '*') { re += '.*'; i++; }
      else { re += '[^/]*'; }
    } else if (REGEX_SPECIALS.test(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

function matchesPath(path, patterns) {
  if (typeof path !== 'string' || !Array.isArray(patterns)) return false;
  const basename = path.slice(path.lastIndexOf('/') + 1);
  return patterns.some((raw) => {
    const pattern = String(raw).trim();
    if (pattern === '' || pattern.startsWith('#')) return false;
    const re = globToRegExp(pattern);
    if (!pattern.includes('/')) return re.test(basename);
    if (re.test(path)) return true;
    for (let i = path.indexOf('/'); i !== -1; i = path.indexOf('/', i + 1)) {
      if (re.test(path.slice(i + 1))) return true;
    }
    return false;
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { matchesPath, globToRegExp };
}

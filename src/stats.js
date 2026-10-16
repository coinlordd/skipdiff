// Line and file totals of a PR without the skipped files. Pure; shared by the
// content script (as a global) and Node tests. `summaries` is GitHub's
// diffSummaries list: [{ path, linesAdded, linesDeleted }]. Needs matcher.js.

function splitStats(summaries, patterns) {
  const kept = { files: 0, added: 0, deleted: 0 };
  const skipped = { files: 0, added: 0, deleted: 0 };
  for (const f of summaries) {
    const t = matchesPath(f.path, patterns) ? skipped : kept;
    t.files++;
    t.added += f.linesAdded || 0;
    t.deleted += f.linesDeleted || 0;
  }
  return { kept, skipped };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { splitStats };
}

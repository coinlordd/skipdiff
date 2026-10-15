# SkipDiff

Chrome extension that folds diffs on GitHub pull request "Files changed"
pages (both the classic `/files` view and the new `/changes` view) when the
file path matches one of your patterns. By default it ticks the "Viewed"
checkbox, so GitHub folds the diff itself. The default patterns target test
files.

## Install (unpacked)

1. Open `chrome://extensions` and enable Developer mode.
2. Click "Load unpacked" and pick this folder.
3. Open a PR's "Files changed" tab.

## Settings

Click the extension icon. The same page is also under Options in
`chrome://extensions`. A change saves when you leave the field.

The **Rules** tab:

- **Skip paths matching**: patterns, one per line. `*` stays inside one path segment, `**`
  crosses segments. A pattern without `/` matches the file name. A pattern
  with `/` matches the full path or any directory suffix, so `test/**` also
  matches `pkg/test/a.go`. Lines starting with `#` are ignored.
- **On match**: **Mark as viewed** (GitHub folds the diff) or **Collapse
  only** (nothing stored).

The **Memory** tab:

- **Forget a PR after** N days, and **keep at most** N PRs. See "What is stored".
- **Clear memory** deletes all remembered ticks.

**Reset to defaults** resets all settings. It does not clear the memory.

Defaults: `*.test.*`, `*.spec.*`, `__tests__/**`, "Mark as viewed", forget
after 30 days, keep at most 100 PRs.

With **Collapse only**, a file you expand by hand stays expanded until the
next page load. With **Mark as viewed**, a file you untick is left alone on
later visits to that PR.

## What is stored

- `chrome.storage.sync` → `settings`: your patterns, mode and memory limits.
- `chrome.storage.local` → `ticked`: per PR, the paths this extension marked
  "Viewed", so a file you untick is never ticked again. A PR entry expires
  a set number of days after the last tick in it (default 30). A set number
  of PRs is kept (default 100); past that, the PR with the oldest last tick
  is dropped first.

Nothing else is stored. Which files were handled on the current page lives
only in the DOM (`data-skipdiff` attribute) and resets on reload.

## Develop

    npm test

No build step. Edit, then reload the extension in `chrome://extensions`.

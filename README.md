# SkipDiff

Chrome extension that hides diffs on GitHub pull request "Files changed"
pages when the file path matches one of your patterns. The file header stays;
only the diff is hidden. Click a hidden file's expand arrow to show that one
file. The default patterns target test files and lock files.

SkipDiff only adds CSS to the page. It does not tick GitHub's "Viewed"
checkbox, so "Viewed" stays yours.

## Install (unpacked)

1. Open `chrome://extensions` and enable Developer mode.
2. Click "Load unpacked" and pick this folder.
3. Open a PR's "Files changed" tab.

## Settings

Click the extension icon. The same page is also under Options in
`chrome://extensions`. Patterns save when you leave the field; the switch
saves at once.

The **On/Off** switch in the header pauses SkipDiff. When off, every diff
shows again.

- **Hide diffs matching**: patterns, one per line. `*` stays inside one path
  segment, `**` crosses segments. A pattern without `/` matches the file name.
  A pattern with `/` matches the full path or any directory suffix, so
  `test/**` also matches `pkg/test/a.go`. Lines starting with `#` are ignored.
- **Reset to defaults** resets all settings.

Defaults: on, `*.test.*`, `*.spec.*`, `__tests__/**`, and lock files
(`*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `bun.lockb`, `go.sum`).

## The badge

SkipDiff shows the PR's size without the hidden files next to GitHub's own
line stats, for example `33 files · +1,303 −590 · hidden 651`. Click it to show the hidden diffs on
this page; click again to hide them. Hover it to see what is hidden.

The per-file list comes from the JSON that GitHub's page loads. On a direct
page load it is already in the page. After an in-app navigation, SkipDiff
fetches it once from the same URL (no extra permissions, your session
cookies). It loads it again when GitHub's own line stats change, for example
after new commits. If that fails, there is no badge, and diffs are still
hidden once they render.

## What is stored

- `chrome.storage.sync` → `settings`: the on/off switch and your patterns.

Nothing else is stored. Version 0.1 stored the files it ticked "Viewed" in
`chrome.storage.local`; SkipDiff deletes that data on its next run.

## Develop

    npm test

No build step. Edit, then reload the extension in `chrome://extensions`.

Release: bump `version` in `manifest.json` and `package.json`, then make the
Chrome Web Store zip:

    zip -r skipdiff-<version>.zip manifest.json src icons fonts LICENSE -x '*.DS_Store'

# Session Explorer — implementation notes

This document records how the Desktop half of Session Explorer was built, which
host APIs were validated against the installed app, what was tested in the real
application, and what remains unverified.

Product: `opencode-session-explorer-desktop@0.2.0` (plugin id `session-explorer`).
Target host: **OpenCode Desktop / opencode v2.3.2** on Windows 11.

## 1. Upstream baseline

| Item | Value |
| --- | --- |
| Upstream repository | `https://github.com/ypxcs/opencode-session-history` |
| Upstream commit | `2d61f0cd5205ef673fb547a3a5e7b454796c026b` (v0.1.5) |
| Upstream license | MIT, retained (`LICENSE`, author/credits in `package.json`) |
| Fork location | `C:\GitHub\opencode-archive-manager` |
| Git remotes | `upstream` points at the original repository; nothing was pushed to it |
| Working history | upstream commit `2d61f0c` is the first commit; the fork's changes sit on top as uncommitted/working-tree changes plus new files |

The fork was created in place: `git init`, `git remote add upstream <url>`,
`git fetch upstream`, `git checkout` of `upstream/main`, then edits. No separate
GitHub fork was created (no remote creation was attempted), and no commits were
pushed anywhere.

Files kept from upstream: `src/index.ts` (server entry), `src/tui.tsx` (TUI
panel), `src/rpc.ts`, `src/directory.ts`, `src/sessions.ts`, the precompiled
`dist/` entries and the upstream tests. They were re-wired only where the package
identity changed (`session-history` → `session-explorer`).

## 2. Versions

| Component | Version |
| --- | --- |
| OpenCode Desktop (host) | 2.3.2 (`OpenCode.exe` 2.3.2.0) |
| opencode CLI/server | `opencode v2.3.2` |
| `@opencode/plugin` (GUI/server API) | 2.3.2 |
| `@opencode/client` | 2.3.2 |
| `effect` | 4.1.0 |
| `solid-js` | 1.9.17 |
| `@opentui/core` / `@opentui/solid` (TUI peers) | 0.9.3 |
| Vite / vite-plugin-solid | 7.3.7 / 2.11.10 |
| Babel (`@babel/core`, preset-typescript, `babel-preset-solid`) | 7.29.7 / 7.27.1 / 1.9.19 |
| TypeScript | 5.9.3 |
| Bun (build/test runner) | 1.4.4 (local devDependency, run through `npx bun`) |

**Minimum tested host version: 2.3.2.** No older or newer host was available, so
no compatibility claim is made outside that version.

## 3. Architecture

Three independent entries in one package:

```text
package.json exports
  ".":                 ./dist/index.js            server entry (upstream RPC + settings)
  "./tui":             ./dist/tui.js              terminal panel (upstream, precompiled)
  "./gui-experimental": ./dist/gui-experimental.cjs  Desktop GUI (new, prebuilt CJS)
```

```text
src/
  index.ts            upstream server registration (id renamed)
  rpc.ts              upstream RPC contracts (SessionHistory.check / settings)
  directory.ts        upstream server-side directory checks
  options.ts          upstream panel options + defaults (unchanged)
  sessions.ts         upstream pure session helpers (TUI)
  tui.tsx             upstream terminal panel (unchanged behaviour)
  explorer.ts         NEW: pure Desktop data layer (normalize/sort/filter/group/prefs)
  gui.tsx             NEW: Plugin.define({ stores, i18n, setup })
  gui/
    window.tsx        registrations (Style, Command, TitlebarItem) + dialog opener
    definition.ts     store schema + English strings
    preferences.ts    read/write/reset stored UI preferences
    controller.ts     state, refresh/generation/abort, events, mutations, navigation
    session-service.ts typed SDK adapter per server (paging, projects, running, dirs)
    SessionExplorer.tsx  dialog content, keyboard, a11y, paging, grouping
    SessionFilters.tsx   project/state/sort/group/reset/refresh controls
    SessionRow.tsx       row content, Open action, row menu
    styles.ts            injected CSS (host theme tokens only)
scripts/build.ts      upstream babel build, extended to skip src/gui* and keep the CJS bundle
vite.config.ts        official `gui()` preset
tests/run.ts          packaging + contract assertions (upstream tests extended)
tests/explorer.ts     pure data-layer assertions + a fake-client SDK adapter suite
```

The Desktop half imports only `@opencode/plugin/gui` and `solid-js`; it never
imports `@opentui/*`. The TUI half never imports the GUI runtime. Shared logic
lives in `src/explorer.ts` and is plain TypeScript (no DOM, no host imports).

### Data flow

1. `setup(ctx)` builds one controller for the window. Nothing is fetched until
   the dialog content mounts (`controller.open()`).
2. `refresh()` snapshots `ctx.servers.list()`, keeps each server's previous rows,
   and loads every compatible server in parallel.
3. Per server: `project.list({})` + `project.list({ archived: true })` and
   `session.active()` are read first; then root sessions (`parentID: null`) are
   paged with `order: "desc", limit: 100` for `archived: false` followed by
   `archived: true`, following `cursor.next` to exhaustion.
4. Each page is merged into the in-memory index and published immediately, so
   the dialog fills progressively.
5. When paging finishes, that server's directories are checked through the
   upstream `SessionHistory.check` RPC on the *same* server, in chunks of 500;
   results mark rows `present`/`missing` and everything else stays `unknown`.
6. `rows()` is the index; the dialog derives projects, counts, filtered rows,
   groups and the visible window from it with memoized helpers.
7. Searches are local over the complete index (debounced 180 ms). Sort and
   filter are local too, so nothing can be lost to a "first page only" search.

### State, races and cleanup

- Every `refresh()` increments a generation counter and aborts the previous
  request controller; results from a stale generation are dropped, so a slow
  response can never overwrite a newer query.
- Event-driven refreshes are debounced 300 ms. While the dialog is closed, events
  only mark the cache stale; the next open refreshes.
- Subscriptions are `createKeyed` over the sorted server-id list, so adding or
  dropping a server re-subscribes, and `onCleanup` stops each server's
  `data.listen` handle.
- A failed server load keeps that server's last good rows, marks the server
  `error`, shows a partial-results banner with **Try again**, and never renders as
  an empty archive.
- An empty server list is a "connecting" state (cold start), not an error.
- `ctx.servers.get(id).compatible === false` produces an incompatible-server
  banner and the server is excluded from loading.

## 4. Validated host API calls

Everything below was checked against `node_modules/@opencode/plugin` 2.3.2 and
then observed in the running Desktop app.

| API | Use | Observed |
| --- | --- | --- |
| `Plugin.define({ stores, i18n, setup })` | GUI entry default export | Bundle loaded by the host from `./gui-experimental` |
| `ctx.add(TitlebarItem, () => ({ id, label, title, icon, run }))` | global launcher | Pill "Sessions" rendered on home screen and sessions; click opens dialog |
| `ctx.add(Command, () => ({ id, title, description, keywords, group, section, bind, featured, run }))` | command | Command menu lists `Session Explorer: Open … CTRL SHIFT H`; id is `session-explorer.open` |
| `ctx.add(Style, css)` | styles | Injected once; removed with the window |
| `ctx.dialogs.open(render)` → `DialogHandle` | modal | Returns a handle; `.close()` dismisses |
| `ctx.dialogs.confirm({ title, description, confirm, cancel })` | missing directory | Resolves `true`/`false`; Cancel keeps the dialog, Open anyway proceeds |
| `ctx.dialogs.active()` | — | **Not used.** It stays `true` through the closing animation (see §6) |
| `ctx.ui.Dialog` (`title`, `size`, `footer`) | modal frame | Without it the content renders unframed and a backdrop click dismisses |
| `ctx.ui.TextInput`, `Select`, `Switch`, `Button`, `Menu`, `Loader`, `Icon` | controls | All render, keyboard-operable, themed |
| `usePlugin<typeof definition>()` | component context | Gives `ui`, `t`, `stores`, `toast`, `system`, `tabs`, `dialogs` |
| `ctx.t(key, params)` | labels | Strings resolve; `{{…}}` interpolates |
| `ctx.toast.show({ title, description, variant })` | feedback | Archive/restore/copy toasts confirmed |
| `ctx.system.copy(text)` | Copy session ID | Clipboard write succeeds |
| `ctx.stores.prefs.value` / `.set()` | UI preferences | Survives restart; `Store.global(schema, {}, [legacyKey])` imported an older key |
| `ctx.servers.list()` / `ctx.servers.get(id)` | server discovery | Returns `ServerRef { id, name, connected, compatible, client, data }`; empty during cold start |
| `ctx.tabs.list()` / `.open({ server, id }, { focus: true })` / `.focus(key)` | navigation | Existing tab focused; otherwise new focused tab; dialog closes |
| `server.data.listen(handler)` | live refresh | External archive/restore updated the open dialog without a manual refresh |
| `client.session.list({ order, limit, parentID, archived, cursor }, { signal })` | enumeration | `{ data, cursor: { next } }`; returns sessions across projects when `directory`/`project` are omitted |
| `client.project.list({})` / `({ archived: true })` | project names | Merged by id; failures are non-fatal |
| `client.session.active({ signal })` | running badge | `{ [sessionID]: { type: "running" \| … } }` |
| `client.session.get({ sessionID })` | read-back | `time.archived` present ⇒ archived |
| `client.session.update({ sessionID, archived })` | archive/restore | Accepted; state verified by the read-back |
| `client.rpc(SessionHistory).check({ directories }, { signal })` | missing directories | `{ missing: string[] }` from the owning server |

### Semantics verified during the spike

- `session.list` omits parent and project filters when they are not passed, so a
  single call returns sessions from every project/directory on that server
  (28 projects observed).
- `archived` is **not** a plain boolean field on the wire: `time.archived` is the
  marker. A restored session simply has no `time.archived`.
- `session.list` alone does not return both archive states; `false` and `true`
  were fetched separately and merged.
- The archived list is longer than the unarchived one (90 vs 4 root sessions in
  this instance); projects that only had archived sessions still appeared.
- The host opens archived sessions directly and keeps them archived; no
  unarchive happens on browse or open.
- `session.update` with `{ archived: false }` removes the archive marker and
  leaves id/project/history intact.
- Archived sessions with a deleted working directory are still openable after the
  warning; the directory is never recreated.

## 5. UI and accessibility decisions

- The dialog content is rendered inside `<ui.Dialog title size="x-large" footer>`
  so the host supplies the frame, header, close button, focus trap and Escape
  handling. The footer carries "Showing X of Y" plus **Show more**.
- Search is autofocused on mount (explicit `input.focus()` after the portal
  attaches, because `autofocus` alone loses to dialog focus).
- Keyboard: `↓` from search moves into the results, arrows move, `Home`/`End`
  jump, `Enter` opens, `Esc` closes. The results container is
  `role="listbox"` with `aria-activedescendant`; rows are `role="option"` with
  `aria-selected`. A visually hidden help paragraph is wired with
  `aria-describedby`.
- The row's click handler ignores events whose target is inside
  `.se-row-actions`, because Solid delegates `click` in the capture phase and a
  nested `stopPropagation` would run too late. The menu therefore never opens the
  row.
- Project keys used as `ui.Select` values are URL-encoded
  (`encodeURIComponent(serverId)+encodeURIComponent(projectId)`). A raw `\n`
  separator in a select value broke the host's DOM lookup and dismissed the
  dialog.
- All colors, borders and radii come from host/theme CSS variables, so the
  dialog follows light/dark theme and accent color. A media query tightens the
  layout for narrow windows; the results area is `min(54vh, 430px)` tall with a
  minimum of 180 px.
- Rows render in windows of 200 (not the full index) and use
  `content-visibility: auto`, which keeps thousands of rows cheap without
  pulling in a virtual list library. This is "incremental rendering", not true
  virtualization; revisit if a user reports jank at several thousand sessions.
- No DOM injection outside the plugin's own dialog, no host patching, no
  Electron main-process access, no SQLite access, no extra web server.

## 6. Defects found in the real app and fixed

1. **Frameless dialog / click-through.** Content passed straight to
   `ctx.dialogs.open` rendered without the modal frame and any click dismissed
   it. Fix: wrap everything in `ctx.ui.Dialog` with a title, size and footer.
2. **Project selection closed the dialog.** Project keys contained a newline;
   the host's select uses values for DOM lookup. Fix: URL-encode both halves.
3. **Escape-then-reopen did nothing.** The opener consulted
   `ctx.dialogs.active()`, which stays true during the closing animation. Fix: a
   private `showing` flag plus a 750 ms recovery timer for a render the host
   discards.
4. **Row-menu click opened the row.** `stopPropagation` inside the row came too
   late in Solid's capture-phase delegation. Fix: ignore clicks whose target is
   inside `.se-row-actions`.
5. **Repeated maps/tooltips were not announced.** Rows were buttons inside a
   nested `role="list"`; the nested list roles were removed so the listbox/option
   pairing is correct.

## 7. Packaging

- `npm run build` = `vite build` (GUI) + `scripts/build.ts` (server/TUI). The
  script scans `src/`, skips `src/gui*`, compiles to `dist/`, and preserves any
  `.cjs` file (the Vite bundle).
- `dist/` is committed and included in the tarball; there is no install-time
  build and no companion executable.
- Final `dist/` (bytes):

  ```text
  directory.js          1903
  explorer.js          11619
  gui-experimental.cjs 35752  (Vite, single CJS bundle)
  index.js              1409
  options.js            1867
  rpc.js                1967
  sessions.js           4380
  tui.js               25761
  ```

- The GUI bundle declares `@opencode/plugin/gui`, `@opencode/plugin/rpc`,
  `effect` and `solid-js` as external (host-provided) imports and has no relative
  `require`, so it is self-contained.
- `npm pack` produced `opencode-session-explorer-desktop-0.2.0.tgz`.
- Install used for verification (outside the source tree, no build tools):

  ```text
  C:\Users\dwyat\.config\opencode\plugins\opencode-session-explorer\
    node_modules\opencode-session-explorer-desktop\
  ```

  Config entry (merged into `C:\Users\dwyat\.config\opencode\opencode.jsonc`, backup
  `opencode.jsonc.bak-session-explorer`):

  ```jsonc
  "plugins": [
    ...,
    "C:/Users/dwyat/.config/opencode/plugins/opencode-session-explorer/node_modules/opencode-session-explorer-desktop"
  ]
  ```

  `opencode plugin list` reports the package as `session-explorer`, `local`;
  `opencode api plugin.list` reports `state: active` and
  `features: { server: true, tui: true, gui: true }`.

## 8. Automated tests

| Suite | What it covers | Result |
| --- | --- | --- |
| `tests/run.ts` | RPC ids/schemas, option resolution, TUI height/truncation helpers, upstream server helpers, export map, `dist/` emitted and byte-identical to a fresh build, GUI bundle imports, self-containment, message-key freshness, compiled TUI reactivity | pass |
| `tests/explorer.ts` | keys (server scoping, selector-safe project keys), path/time normalization, session normalization and merge, cursor guard, search fields and phrase matching, archive matching, sorting + tie-breaks, project listing, grouping, relative time, preference resolution/reset, fake-client project/running/paging RPC adapter, aborted loads, directory chunks/results, per-server replacement, error text | pass |

224 assertions total; `npm test` prints `all assertions passed` for both suites.
`npm run typecheck` is clean.

## 9. Manual verification in Desktop 2.3.2

Environment: Windows 11, 2304×1536 (window maximized at `-9,-9,2322,1494`),
dark theme, single built-in local server with 93 root sessions across 28
projects (89 archived / 4 unarchived at the start). The app was driven with
Windows UI Automation (UIA) and checked with screenshots; DevTools remote
debugging was not available on this build.

| ID | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| A01 | Fresh launch, home screen, no session | **pass** | After restart, the Sessions pill was present on the home screen and opened the dialog with 93 sessions; unarchived session count unchanged, so no session was created |
| A02 | All projects, archived + unarchived, archived-only projects | **pass** | 93 sessions / 28 projects; project menu includes projects whose sessions are all archived (e.g. `minecraft 2d (16)`) |
| A03 | Project + Archived + query | **pass** | `CAP-cli` + `Archived` + `plugin` → 2 rows, both `ARCHIVED`, both CAP-cli |
| A04 | Older archived match beyond a page | **partial** | 93 records came back from cursor paging; archive list is 89–90 rows, under the 100-row page, so a second page was not needed in this instance. Multi-page paging and the repeated-cursor guard are covered by `tests/explorer.ts` (3-page fake client). No fixed cap: the index is the full paged result and search is local |
| A05 | Open unarchived session from another project | **pass** | "Upstairs bedroom wall changes" (project `open code`, `C:\GitHub\open code`) opened in a new focused tab; dialog closed; root session count unchanged |
| A06 | Archived session | **pass** | Archived "Solution version comparison tab" opened directly in a new focused tab and stayed archived (`time.archived` still set); the menu also offers `Restore and open` |
| A07 | Open the same session twice | **pass** | Second open focused the existing tab; tab strip unchanged, session count unchanged |
| A08 | Archive / restore from the row menu | **pass** | Archive: toast, Unarchived 4→3, Archived 89→90, row moved to the archived view. Restore: toast, 3→4 and 90→89, row left the archived view. Same id/title/history |
| A09 | Mutation fails / disconnected | **not run** | Only a healthy local server was available. Failure paths show an error toast and do not update the row; not exercised in-app |
| A10 | Rapid filter changes while loading | **not run** | Generation counter + `AbortController` implement it; no in-app stress test and no controller unit test |
| A11 | External archive/restore/rename | **pass** | Archiving and restoring through `opencode api` while the dialog was open changed rows and counts without a manual refresh; a change made while closed was visible on the next open |
| A12 | Missing directory, deleted session | **pass** | Archived row showed `DIRECTORY MISSING`; opening it showed "Session directory is missing … Open the session anyway?"; Cancel left the dialog open, Open anyway opened the tab. Deleted sessions do not appear because the index is built from the server list |
| A13 | Duplicate project names / two servers | **not run** | One server only; `(serverId, projectId)` scoping is unit-tested |
| A14 | Restart | **pass** | Archive filter and grouping survived restarts; an unavailable saved project falls back to All (unit-tested). With `options.limit: 1` in the config the Desktop dialog still showed all 93 sessions, so the TUI limit does not cap it |
| A15 | Keyboard, light/dark, narrow window | **partial** | Keyboard pass (search autofocus, ↓ into list, arrows, Enter, Esc, focus returned). Narrow pass at 1000×1000 (dialog fits, filters wrap, rows usable). Light theme not visually verified |
| A16 | Legacy TUI panel | **partial** | Upstream + new suites, typecheck and build pass; the TUI was not driven interactively in a terminal |
| A17 | Packed install into a compatible host | **pass** | Tarball installed outside the source tree; server + TUI + GUI all loaded (`features.gui: true`, `active`), no build step |
| A18 | Older / incompatible host | **not run** | No other host version available. Incompatible servers are excluded from loading and shown in a banner |
| A19 | Uninstall | **not run** | Nothing in the plugin deletes or mutates sessions on unload; removal is config-only. Not exercised to preserve the verified install |

### Unrun tests (explicit)

- Multi-server browsing, per-server isolated errors, incompatible server banner,
  disconnected event stream, cold-start "connecting" state.
- Mutation failure and retry (`A09`), rapid-filter race (`A10`), invalid saved
  project in the app (`A14` fallback).
- Light theme and windows narrower than 1000 px (`A15`).
- Interactive TUI use (`A16`) and host versions other than 2.3.2 (`A18`).
- Uninstall (`A19`).
- Sessions beyond a single 100-row page in the real app (`A04` second page).

### Post-fix reverification (final packed install)

After the three defects in §6 were fixed, the packed tarball was reinstalled and
the app restarted:

- Cold start, home screen, no session: the pill opened the dialog, search focused,
  93 sessions.
- Command menu (`Ctrl+Shift+P`) listed `Session Explorer: Open … CTRL SHIFT H`.
- `Esc` followed immediately by `Ctrl+Shift+H` reopened the dialog (the
  `dialogs.active()` regression).
- Project selection in the dropdown kept the dialog open and filtered the list
  (the project-key regression).
- With `"options": { "limit": 1 }` in the plugin config, the dialog still showed
  "Showing 93 of 93 sessions" — the TUI `limit` does not cap Desktop.
- `npm test` (both suites) and `npm run typecheck` pass on the committed `dist/`.

## 10. Blockers and limitations

- **No blockers** for the release gate: an archived session in another project
  opens directly from the home screen with no session previously open, and stays
  archived.
- The Desktop GUI API is experimental and version-pinned. The host assigns the
  GUI half the server plugin's id; the GUI bundle therefore declares no id.
- The host gives no focus API for an already-open dialog, so a second activation
  is ignored rather than re-focused.
- "Restore and open" cannot be exercised on this host because archived sessions
  open directly. The path is implemented (restore → verify → open) and falls back
  only when direct opening fails or the user chooses it.
- Liveness of an already-open dialog after a server restart was only observed via
  external mutations, not a killed server.
- `content-visibility: auto` means UIA exposes only the on-screen rows; this is
  expected, not missing data ("Showing 93 of 93").

## 11. Repro / rollback

- Rebuild: `npx bun run typecheck`, `npx vite build`, `npx bun run scripts/build.ts`,
  `npm test`, `npm pack`.
- Reinstall: copy the tarball into the plugins folder, `npm install <tarball>`,
  restart Desktop.
- Rollback: restore `opencode.jsonc.bak-session-explorer` (or delete the plugin
  entry) and restart. Removing the plugin changes no session data.
- Logs: `C:\Users\<you>\.local\share\opencode\log\opencode.log`.

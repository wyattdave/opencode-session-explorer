# Requirements: OpenCode Session Explorer

## 1. Objective
Fork [ypxcs/opencode-session-history](https://github.com/ypxcs/opencode-session-history) and extend it into a global session launcher for OpenCode Desktop while retaining its existing terminal (TUI) functionality. The primary use case is finding and reopening archived sessions across projects **without first opening a session**.

Working product name: Session Explorer. Choose an available npm package name before publication; suggested `opencode-session-explorer`. Target OpenCode V2, Windows first, with macOS/Linux compatibility where supported. Do not fork OpenCode itself.

## 2. Instructions to Codex
- Inspect the current upstream repository, LICENSE, package manifest, lockfile, source and tests before editing. Record the upstream commit and installed OpenCode/SDK versions in `IMPLEMENTATION.md`.
- If the workspace is already a fork, reuse it; otherwise establish a fork when GitHub access permits, retaining upstream history and an `upstream` remote. Do not overwrite existing work or push to the original repository. If remote creation is unavailable, prepare a local branch and document the remaining steps.
- Retain the MIT copyright and license; credit upstream in README. Use a distinct package/plugin identity to avoid colliding with the original, preserving configuration option compatibility where feasible.
- Validate current SDK signatures from the installed types and matching OpenCode source. The GUI and session APIs are experimental; this specification is not a substitute for version-specific verification.
- Build in phases, run tests after each, and record actual results. Do not claim desktop compatibility until tested in the real application. Do not publish or push secrets, session data or credentials. No automatic npm publication.

## 3. Functional requirements

### FR-01 — Global launcher (mandatory)
Register a persistent titlebar history button using the GUI SDK's `TitlebarItem` in window-level setup, not a session-scoped panel. Register a command named `Session Explorer: Open` with a configurable shortcut (proposed Ctrl+Shift+H on Windows/Linux; platform equivalent on macOS). Check for conflicts and allow reassignment through supported host keybindings. All entry points must invoke one dialog-opening function. Avoid duplicate dialogs on repeated activation.

The button and command must work from a cold-start home screen with no active session, from a draft, and with existing sessions open. If the target host hides titlebar contributions on the home screen, investigate a documented global slot or command entry point; the no-session launcher must still work. Do not inject DOM elements or patch the host. A session-only right panel is not an acceptable substitute.

### FR-02 — Session Explorer dialog
Use the native dialog frame, theme, controls and typography via `ctx.dialogs.open` and `ctx.ui`. Provide a large responsive modal with a scrollable result area, persistent header, focus on search, keyboard navigation, Enter to open, Escape to close, accessible labels and visible focus states. Support light/dark themes and narrow windows.

```text
+--------------------------------------------------------------+
| Session Explorer                                       [X]   |
| [ Search title, project, directory or ID...                ] |
| [ All projects v ] [ All | Unarchived | Archived ]           |
| [ Last updated v ] [ Group by project ]         [ Refresh ]  |
|--------------------------------------------------------------|
| Docs (3)                                                     |
|   Implement documentation builder       18 Nov   [Open] [...]|
|   Update navigation              Archived 17 Nov  [Open] [...]|
| Game (2)                                                     |
|   Fix multiplayer sync          Archived 16 Nov   [Open] [...]|
|--------------------------------------------------------------|
|  Showing 5 sessions                         [ Load more ]    |
+--------------------------------------------------------------+
```

### FR-03 — Discover all sessions
Retrieve session metadata across all known projects on the relevant OpenCode server, independent of open tabs or current workspace. Include archived and unarchived projects/sessions. Default to All projects and All session states. Distinguish archived from unarchived, and do not conflate unarchived with actively running. Preserve directory information and server identity. Include root sessions by default; expose an optional child/subagent toggle if supported. Never create sessions merely to enumerate them.

### FR-04 — Filtering and search
- Project dropdown based on stable project IDs, display names and directory fallback; distinguish duplicate names using path/server. Keep projects with only archived sessions discoverable.
- Archive filter: All, Unarchived, Archived. Archived results must not depend on the latest unarchived page being loaded.
- Case-insensitive search over title, project name, directory and session ID. Combine search and filters using AND; do not silently search only the latest 100 records. Debounce remote requests and cancel/ignore stale responses. If the API searches titles only, use paginated metadata scanning or a complete in-memory metadata index to implement the wider search. Show when results are incomplete and provide a way to continue.
- Sort by last updated (default), created date, and title; define stable tie-breaking by server/session ID. Where API sorting is insufficient, apply client sorting to the complete matching metadata set or clearly mark partial results.
- Optional collapsible project grouping with per-group counts (indicate partial counts when applicable); flat view remains available.
- Pagination or incremental loading, with no fixed overall history cap. Handle thousands of records without loading transcripts or blocking the UI. Virtualize long lists if needed.

### FR-05 — Session row
Display title (fallback Untitled session), project, archived indicator, last updated time, and directory in details/tooltip. Show missing-directory indication if known, and optionally currently open or running indicators if reliable. Provide a primary Open action and row menu with Archive/Restore as appropriate and Copy session ID. Clicking the row or pressing Enter opens it; menu actions must not also open it.

### FR-06 — Open existing session (mandatory)
Use the original server ID and session ID. Focus an existing tab rather than creating duplicates; otherwise open a new tab and focus it through the host tabs API. Close the dialog after initiating a valid open request; report errors that can be detected. Never create, clone or resend a prompt to resume a session. Ensure project context and transcript are preserved when a different project is selected.

Test whether archived sessions open directly while retaining archive status. Prefer direct open if supported; otherwise show an explicit `Restore and open` action, restore through the supported API, verify success, then open. Do not silently unarchive on browse or on a failed open. If restore succeeds but open fails, report the resulting state and offer retry. Never simulate successful navigation: the tabs API returns void, so validate through observed tab state where possible and through manual integration tests.

### FR-07 — Archive and restore
Expose archive for unarchived sessions and restore for archived sessions, using only supported OpenCode API/SDK mutations. Preserve history, ID, project and timestamps not intentionally modified by the host. Prevent accidental archival of running sessions (disable or explicitly confirm based on host semantics). Refresh affected results and counts after success. On failure, retain previous state and show actionable feedback. No delete action in MVP. Deleted sessions are not archived sessions and must not be offered for recovery.

### FR-08 — Preferences
Persist only UI preferences via supported plugin storage: project selection (fallback to All when no longer available), archive filter, sort and grouping. Default to All projects/All statuses on first run. Search text is transient. Provide reset filters. Keep upstream TUI options and defaults intact; its existing `limit` must not cap Desktop history. Do not store transcripts, API credentials or metadata caches on disk unnecessarily.

### FR-09 — Live refresh and error states
Refresh on dialog open and explicit refresh. Subscribe to documented relevant session/project changes where available, including archive/restore, rename, creation and deletion; debounce bursts and clean up subscriptions on dialog/window disposal. If events are unavailable, refresh after mutations and on reopening. Provide loading, empty, no matches, incompatible server, disconnected, partial results and retry states. Never present a failed request as an empty archive. Retain usable cached results in memory with a stale indicator if appropriate.

### FR-10 — Multi-server and missing directories
MVP guarantees cross-project browsing on the built-in local server. If the SDK exposes other connected compatible servers, support a server selector or All connected servers with isolated errors; identify records by `(serverId, sessionId)` and projects by `(serverId, projectId)`. Do not route remote records through local paths or the wrong client. Reuse upstream missing-directory RPC when available and scoped to the owning server. Unknown directory status is not missing; warn before opening confirmed missing directories. Do not delete or recreate directories.

## 4. Technical architecture

One npm plugin with three independent entry points: the existing server entry, TUI entry and new Desktop GUI entry. Keep TypeScript/SolidJS conventions of upstream. Use pure shared helpers for filtering, metadata normalization and sorting, but separate OpenTUI and DOM/Solid rendering. Desktop must not import `@opentui/*` and TUI must not import GUI runtime modules.

Suggested layout (adapt to upstream rather than wholesale rewrite):

```text
src/
  index.ts                 # Existing server registration
  rpc.ts                   # Existing RPC contracts; extend only if needed
  directory.ts             # Existing server-side directory checks
  options.ts               # Existing configuration and defaults
  sessions.ts              # Shared pure session helpers
  tui.tsx                  # Existing terminal history panel
  gui.tsx                  # New GUI Plugin.define entry
  gui/
    SessionExplorer.tsx    # Native modal
    SessionRow.tsx
    SessionFilters.tsx
    session-service.ts     # Typed server client adapter
    session-controller.ts  # Requests, refresh, filters, errors
    preferences.ts
scripts/build.ts           # Preserve existing TUI/server build
vite.config.ts             # GUI preset
 tests/                    # Existing + new tests
 dist/                     # Prebuilt entries
```

Use the documented `@opencode/plugin/gui` API and `Plugin.define({ setup(ctx) { ... } })`. Register global contributions using `ctx.add(TitlebarItem, ...)` and `ctx.add(Command, ...)`; use `ctx.dialogs.open` and `ctx.ui.Dialog` for modal. Use host storage and event lifecycle APIs. Avoid Electron main-process privileges unless a demonstrated requirement cannot be met otherwise.

Illustrative navigation (verified documented shape; verify installed types):

```ts
ctx.tabs.open({ server: serverId, id: sessionId }, { focus: true })
```

Prefer the host-provided authenticated typed server client (`ctx.client` or appropriate `ctx.servers.get(id).client`) instead of guessing ports, credentials or URLs. Verify cross-project scope of that client. Existing server-side RPC may supplement missing features where supported, but must not bypass host authorization. Do not directly read/write OpenCode SQLite, scrape UI, run a separate web server, require another executable or introduce cloud infrastructure.

### API discovery and validation

The current API reference documents the following experimental routes:

| Route | Intended use |
|---|---|
| GET /api/session | List session metadata; supports `archived`, `project`, `directory`, `search`, `parentID`, `limit`, `order`, `cursor` |
| GET /api/session/{sessionID} | Validate/retrieve session metadata |
| PATCH /api/session/{sessionID} | Update mutable session metadata; confirm exact archive/restore payload and semantics from matching SDK/schema/source before use |
| GET /api/project | Resolve projects; verify archive inclusion semantics |
| GET /api/session/active | Optional running-state information; validate semantics |

Session list is cursor-paginated. Follow returned next cursors until exhausted as needed, guard repeating cursors, deduplicate and reset cursors when query changes. Do not invent an offset or assume server ordering equals last updated. Verify omitted `archived` returns both statuses; if not, fetch true and false separately and merge. Verify project list archive semantics similarly. Confirm exact response envelopes, ID types, timestamps and invalidation events. Never guess mutation payloads (including null vs omitted archive time). If the supported host cannot restore, report that blocker rather than writing SQLite.

Suggested internal metadata: `serverId`, `sessionId`, `projectId`, `projectName`, `directory`, `title`, `createdAt`, `updatedAt`, `archivedAt`, `parentId`, optional `directoryStatus`/`running`. Use explicit unknown states for unsupported fields; normalize timestamps once. Do not load message bodies for searching.

## 5. Packaging and installation

The Desktop SDK requires the `./gui-experimental` package export to point to a prebuilt single CommonJS bundle. Preserve existing server/TUI exports and peer dependencies. Use the official Vite GUI preset rather than bundling a separate Solid runtime:

```ts
import { defineConfig } from 'vite'
import { gui } from '@opencode/plugin/gui/vite'
export default defineConfig({ plugins: [gui()] })
```

Expected new export: `"./gui-experimental": "./dist/gui-experimental.cjs"`. Keep existing export paths as discovered in upstream. Ensure TUI build does not remove the GUI output and GUI build does not delete server/TUI artifacts (separate staging/output or explicit preservation). Update deterministic build verification and include GUI in npm tarball. Pin compatible tool versions and document minimum tested host version. Preserve upstream precompiled TUI Solid transform and package tests. No install-time compilation or companion application for consumers.

Enable globally in `~/.config/opencode/opencode.json(c)` (verify actual resolved config location on Windows). Example development config, merged with existing settings rather than overwriting:

```jsonc
{
  "plugins": [
    { "package": "C:/path/to/session-explorer" }
  ]
}
```

Build package before loading. Document watch/build workflow, Desktop reload/enable via Settings > Extensions > Plugins, uninstall and rollback. Once published, document `opencode plugin add <actual-package-name>` and global configuration. The upstream README warns that Git URL installs fail on V2.0.32; prefer local checkout or npm tarball/registry installs. Verify install from a packed tarball outside the source tree without build tools. Avoid installing both the original and fork simultaneously unless compatibility is tested. No registry publish without owner's approval.

## 6. Implementation phases

1. **Baseline and feasibility:** inspect fork; run upstream tests; identify actual OpenCode version and matching SDK; smoke-test global titlebar/command from home, list archived sessions from multiple projects, reopen archived session and validate mutation support. Record actual results before building full UI.
2. **Data layer:** normalize project/session metadata, cursor handling, archive inclusion, filtering, sorting, dedupe, server routing, mutation adapter and tests. Keep TUI behavior stable.
3. **Desktop MVP:** native global launcher, modal, project/archive filters, search, row details, pagination, keyboard accessibility and session opening. Validate cold-start home workflow.
4. **Management and polish:** archive/restore, refresh/events, preferences, grouping, missing-directory behavior, error states, optional multi-server selector.
5. **Packaging and verification:** build all entries, preserve upstream artifacts, test local and packed installs, document exact supported versions and limitations, supply screenshots from actual Desktop if available.

## 7. Acceptance tests

| ID | Scenario | Expected result |
|---|---|---|
| A01 | Fresh Desktop launch, no open session | Titlebar button/command opens explorer without creating a session |
| A02 | Projects A and B with archived and unarchived sessions | All project results discoverable, including project with only archives |
| A03 | Project B + Archived + text query | Only matching B archived records appear |
| A04 | More sessions than one page; old archived match | Older match is discoverable, no hidden first-page cap |
| A05 | Open existing unarchived session from another project | Correct transcript/project opens in focused tab; no new session created |
| A06 | Select archived session | Direct open preserves archive if supported; otherwise explicit restore-and-open succeeds |
| A07 | Open same session twice | Existing tab focused, no duplicate |
| A08 | Archive/restore from row menu | Server state and filters update, history preserved |
| A09 | Mutation fails/disconnected | Clear error, no false success or unintended change |
| A10 | Change filters rapidly while loading | Stale response cannot overwrite latest query |
| A11 | Rename/create/archive externally | Refresh reflects change; events cleaned on close |
| A12 | Missing directory, deleted session | Correct warning for missing path; deleted record absent |
| A13 | Two projects with same name, two servers with same ID fixture | Correct scoped filtering and navigation |
| A14 | Restart app | Saved preferences restored, invalid project falls back to All |
| A15 | Keyboard-only usage; light/dark; narrow window | Accessible dialog and usable results |
| A16 | Legacy TUI home/sidebar and search/resume | Existing behavior and test suite pass |
| A17 | Install packed plugin into clean compatible host | GUI, server and TUI load without consumer build steps |
| A18 | Older/incompatible host | Safe documented failure; no data loss or reliance on unsupported internals |
| A19 | Uninstall plugin | Native app continues functioning; no session changes from uninstall |

Use pure unit tests for pagination, filters, search, timestamps, sorting and state normalization; mocked SDK tests for navigation, mutations, error/retry, subscriptions and races; integration/manual tests on actual Desktop, primarily Windows. Use disposable projects and synthetic sessions for mutations. Report unrun tests separately. Use upstream commands (`bun install`, build, typecheck, tests and audit) as verified from current manifest, and add GUI build/test commands without breaking existing checks.

## 8. Deliverables and definition of done

- Fork/local implementation branch retaining upstream attribution and history.
- Functional global Desktop GUI and unchanged working TUI, sharing reusable non-UI logic.
- Compiled installable plugin package, updated lockfile, automated tests and packaging verification.
- Updated README with global install, home-screen usage, archive workflow, shortcuts, troubleshooting, version support and upstream credit.
- `IMPLEMENTATION.md` documenting architecture, upstream SHA, validated SDK calls, minimum tested host version, decisions, blockers and test outcomes.
- No unrelated feature work (transcript content search, deleting sessions, analytics, external database, standalone app or OpenCode core modifications).

The critical release gate is opening an existing archived session in another project directly from Desktop's home screen without an already-open session. If the installed host cannot support that via its public experimental plugin APIs, document the precise limitation and version; do not substitute a session-scoped panel or claim completion.

## 9. References

Reviewed 18 November 2026. Re-check against the implementation target because OpenCode V2 APIs may change.

- Upstream repository and MIT license: https://github.com/ypxcs/opencode-session-history
- Upstream README: https://github.com/ypxcs/opencode-session-history/blob/main/README.md
- GUI SDK (packaging, titlebar, dialogs, tabs, storage): https://opencode.ai/docs/build/plugins/gui
- REST API (sessions/projects): https://opencode.ai/docs/api
- Server plugin SDK: https://opencode.ai/docs/build/plugins/server
- Upstream OpenCode source for version-specific verification: https://github.com/anomalyco/opencode

Open questions requiring the feasibility spike: exact minimum Desktop build, titlebar visibility on home screen in that build, archive/restore mutation payload, direct opening of archived sessions, and server scoping. These are implementation validation tasks, not assumed capabilities. The working package name, shortcut, optional multi-server support and UI defaults are proposed design decisions and may be adjusted with documented rationale.

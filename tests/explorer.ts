/**
 * Contract test for the Desktop explorer layer.
 *
 * It runs without the OpenCode runtime: the pure helpers in `src/explorer.ts`
 * are exercised directly, and the server adapter in `src/gui/session-service.ts`
 * runs against a fake SDK client so paging, archive separation, running-state
 * detection and directory checks are validated before they touch a real app.
 */
import type { OpenCodeClient, Project, SessionInfo, SessionListInput } from "@opencode/client"
import type { ServerRef } from "@opencode/plugin/gui"
import {
  ALL_PROJECTS,
  DEFAULT_PREFS,
  archiveCounts,
  baseName,
  directoriesOf,
  filterSessions,
  groupSessions,
  matchesArchive,
  matchesQuery,
  mergeSessions,
  nextCursor,
  normalizeSession,
  projectKey,
  projectsOf,
  relativeTime,
  resolvePrefs,
  sessionKey,
  sortSessions,
  toMillis,
  type ExplorerSession,
} from "../src/explorer.js"
import {
  DIRECTORY_CHUNK,
  PAGE_SIZE,
  checkDirectories,
  describeError,
  fetchProjects,
  fetchRunning,
  loadArchiveState,
  loadServerSessions,
  replaceServerRows,
  rowsOfServer,
  serverDirectories,
  withDirectoryStatus,
} from "../src/gui/session-service.js"
import {
  readPreferences,
  resetPreferences,
  writePreferences,
  type ExplorerContext,
} from "../src/gui/preferences.js"

let failures = 0
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failures++
    console.error("  ✗ " + msg)
  } else {
    console.log("  ✓ " + msg)
  }
}

// --- fixtures ---------------------------------------------------------------

const SERVER = { id: "sidecar", name: "Local" }
const OTHER = { id: "https://remote.example", name: "Remote" }

function session(
  id: string,
  options: Partial<{
    title: string
    projectID: string
    directory: string
    created: number
    updated: number
    archived: number
    parentID: string
    subpath: string
  }> = {},
): SessionInfo {
  return {
    id,
    title: options.title ?? id,
    projectID: options.projectID ?? "p1",
    parentID: options.parentID,
    subpath: options.subpath,
    cost: 0,
    tokens: {} as never,
    location: { directory: options.directory ?? "/work/alpha" },
    time: {
      created: options.created ?? options.updated ?? 1,
      updated: options.updated ?? options.created ?? 1,
      archived: options.archived,
    },
  } as unknown as SessionInfo
}

function project(id: string, canonical: string, name?: string): Project {
  return { id, canonical, name, time: { created: 0, updated: 0 }, sandboxes: [] } as unknown as Project
}

function normalized(id: string, extra: Parameters<typeof session>[1] = {}, server = SERVER): ExplorerSession {
  return normalizeSession(server, session(id, extra), [project("p1", "/work/alpha", "Alpha")])
}

function fakeServer(id = "sidecar", name = "Local", client?: OpenCodeClient): ServerRef {
  return {
    id,
    name,
    url: "http://127.0.0.1:4096",
    client: client ?? ({} as OpenCodeClient),
    data: {} as never,
    local: true,
    builtin: true,
    compatible: true,
    connected: true,
  }
}

interface ListCall {
  readonly input: SessionListInput
  readonly aborted: boolean
}

/** A fake `session.list` that pages through canned responses per archive state. */
function pagingClient(states: Record<"archived" | "live", { data: SessionInfo[]; next?: string }[]>) {
  const calls: ListCall[] = []
  const client = {
    session: {
      list: async (input: SessionListInput, options?: { signal?: AbortSignal }) => {
        calls.push({ input, aborted: options?.signal?.aborted === true })
        const pages = input.archived ? states.archived : states.live
        const pageIndex = input.cursor === undefined ? 0 : Number(input.cursor.replace("page-", ""))
        const page = pages[pageIndex] ?? { data: [] }
        return {
          data: page.data,
          cursor: { previous: undefined, next: page.next ?? undefined },
        }
      },
    },
  }
  return { client: client as unknown as OpenCodeClient, calls }
}

// --- keys -------------------------------------------------------------------

console.log("explorer.keys")
assert(sessionKey("a", "s") !== sessionKey("b", "s"), "the same session id on two servers keys differently")
assert(sessionKey("a", "s") === "a\ns", "a key keeps the server id and the session id")
assert(projectKey("a", "p") !== projectKey("b", "p"), "projects are keyed per server")
assert(
  /^[A-Za-z0-9%+._~-]+$/.test(projectKey("C:\\work\\a b", "prj_1/2")),
  "a project key is a selector-safe host select value",
)
assert(projectKey("a\nb", "p\nq") !== projectKey("a", "b\np\nq"), "a project key cannot be forged across the separator")

console.log("explorer.baseName")
assert(baseName("C:\\work\\alpha") === "alpha", "reads a Windows path tail")
assert(baseName("/work/alpha/") === "alpha", "ignores a trailing separator")
assert(baseName("/") === "/", "root stays root")

console.log("explorer.millis")
assert(toMillis(1_700_000_000) === 1_700_000_000_000, "seconds are widened to milliseconds")
assert(toMillis(1_700_000_000_000) === 1_700_000_000_000, "milliseconds are kept")
assert(toMillis("nope") === 0 && toMillis(0) === 0 && toMillis(-5) === 0, "non-values become zero")

// --- normalization ----------------------------------------------------------

console.log("explorer.normalize")
const projects = [project("p1", "/work/alpha", "Alpha")]

const named = normalizeSession(SERVER, session("s1", { title: "  Deploy  ", updated: 20 }), projects)
assert(named.key === sessionKey("sidecar", "s1"), "keys by server and session")
assert(named.title === "Deploy", "trims the title")
assert(named.projectName === "Alpha", "takes the project's name")
assert(named.projectDirectory === "/work/alpha", "takes the project's canonical directory")
assert(named.running === undefined, "running defaults to unknown")
assert(named.directoryStatus === "unknown", "directory status defaults to unknown")

const untitled = normalizeSession(SERVER, session("s2", { title: "   " }), projects)
assert(untitled.title === "Untitled session", "a blank title falls back to Untitled session")

const noProjects = normalizeSession(SERVER, session("s3", { directory: "/work/fallback" }), [])
assert(noProjects.projectName === "fallback", "without project metadata the directory names the project")
assert(noProjects.projectDirectory === "/work/fallback", "without project metadata the directory is the root")

const subpath = normalizeSession(SERVER, session("s4", { subpath: "packages/app" }), projects)
assert(subpath.subpath === "packages/app", "keeps the subpath")
assert(normalizeSession(SERVER, session("s5"), projects).subpath === undefined, "no subpath stays undefined")

const archivedTime = normalizeSession(SERVER, session("s6", { archived: 1_700_000_000_000 }), projects)
assert(archivedTime.archivedAt === 1_700_000_000_000, "keeps the archived time")
assert(
  normalizeSession(SERVER, session("s6b", { archived: 1_700_000_000 }), projects).archivedAt === 1_700_000_000_000,
  "widens a seconds archive time",
)
assert(normalizeSession(SERVER, session("s7"), projects).archivedAt === undefined, "live sessions have no archive time")

// --- merging ----------------------------------------------------------------

console.log("explorer.merge")
const first = [normalized("a", { updated: 1 }), normalized("b", { updated: 2 })]
const second = [normalized("b", { updated: 9, title: "fresh" }), normalized("c", { updated: 3 })]
const merged = mergeSessions(first, second)
assert(merged.length === 3, "dedupes by key")
assert(merged.find((row) => row.sessionId === "b")?.title === "fresh", "the later copy wins")
assert(mergeSessions([], []).length === 0, "merging nothing yields nothing")

console.log("explorer.cursor")
assert(nextCursor(undefined, "p1", new Set()) === "p1", "follows the first cursor")
assert(nextCursor("p1", "p1", new Set(["p1"])) === undefined, "stops when the cursor repeats the request")
assert(nextCursor(undefined, undefined, new Set()) === undefined, "stops when the server sends none")
assert(nextCursor(undefined, "p2", new Set(["p2"])) === undefined, "stops on a cursor already followed")

// --- search -----------------------------------------------------------------

console.log("explorer.search")
const searchable = normalized("ses_abc123", {
  title: "Refactor auth",
  directory: "/work/alpha/service",
  subpath: "packages/api",
})
assert(matchesQuery(searchable, ""), "an empty query matches")
assert(matchesQuery(searchable, "   "), "a blank query matches")
assert(matchesQuery(searchable, "REFACTOR"), "matches the title, case-insensitively")
assert(matchesQuery(searchable, "ALPHA"), "matches the project name")
assert(matchesQuery(searchable, "/work/alpha"), "matches the project directory")
assert(matchesQuery(searchable, "packages/api"), "matches the subpath")
assert(matchesQuery(searchable, "abc123"), "matches the session id")
assert(matchesQuery(searchable, "local"), "matches the server name")
assert(!matchesQuery(searchable, "billing"), "rejects a query that matches nothing")
assert(matchesQuery(searchable, "refactor auth"), "matches a phrase across one field")

console.log("explorer.archiveFilter")
assert(matchesArchive(searchable, "all"), "all keeps live rows")
assert(matchesArchive(searchable, "unarchived"), "unarchived keeps live rows")
assert(!matchesArchive(searchable, "archived"), "archived drops live rows")
const archivedRow = normalized("x", { archived: 5 })
assert(matchesArchive(archivedRow, "archived"), "archived keeps archived rows")
assert(!matchesArchive(archivedRow, "unarchived"), "unarchived drops archived rows")

// --- sorting ----------------------------------------------------------------

console.log("explorer.sort")
const sortable = [
  normalized("b", { title: "Beta", updated: 10, created: 1 }),
  normalized("a", { title: "alpha", updated: 10, created: 3 }),
  normalized("c", { title: "Gamma", updated: 30, created: 2 }),
]
assert(
  sortSessions(sortable, "updated").map((row) => row.sessionId).join(",") === "c,a,b",
  "newest updated first, ties broken by key",
)
assert(
  sortSessions(sortable, "created").map((row) => row.sessionId).join(",") === "a,c,b",
  "newest created first",
)
assert(
  sortSessions(sortable, "title").map((row) => row.title).join(",") === "alpha,Beta,Gamma",
  "title sort is case-insensitive",
)

const crossServer = [
  normalizeSession(SERVER, session("same", { title: "Same" }), projects),
  normalizeSession(OTHER, session("same", { title: "Same" }), projects),
]
const tieBroken = sortSessions(crossServer, "title")
assert(tieBroken.length === 2 && tieBroken[0] !== tieBroken[1], "identical titles still order deterministically")
assert(
  sortSessions(crossServer, "title")
    .map((row) => row.key)
    .join("|") === sortSessions(crossServer.slice().reverse(), "title").map((row) => row.key).join("|"),
  "sorting is independent of input order",
)
assert(sortSessions([], "title").length === 0, "sorting nothing yields nothing")

// --- combined filters -------------------------------------------------------

console.log("explorer.filters")
const alpha = normalized("alpha", { title: "Deploy", directory: "/work/alpha" })
const beta = normalizeSession(
  SERVER,
  session("beta", { title: "Deploy billing", projectID: "p2" }),
  [project("p2", "/work/beta", "Beta")],
)
const onlyArchived = normalizeSession(
  SERVER,
  session("gone", { title: "Old work", projectID: "p3", archived: 7 }),
  [project("p3", "/work/gone", "Retired")],
)
const all = [alpha, beta, onlyArchived]

assert(
  filterSessions(all, { query: "", project: ALL_PROJECTS, archive: "all" }, "updated").length === 3,
  "no filters keep every row",
)
assert(
  filterSessions(all, { query: "deploy", project: ALL_PROJECTS, archive: "all" }, "updated").length === 2,
  "search spans projects",
)
assert(
  filterSessions(all, { query: "", project: projectKey("sidecar", "p2"), archive: "all" }, "updated").map(
    (row) => row.sessionId,
  ).join(",") === "beta",
  "the project filter keeps one project",
)
assert(
  filterSessions(all, { query: "deploy", project: projectKey("sidecar", "p2"), archive: "all" }, "updated").length === 1,
  "search and project filters combine",
)
assert(
  filterSessions(all, { query: "", project: ALL_PROJECTS, archive: "archived" }, "updated").map(
    (row) => row.sessionId,
  ).join(",") === "gone",
  "the archive filter isolates archived rows",
)
assert(
  filterSessions(all, { query: "nothing here", project: ALL_PROJECTS, archive: "all" }, "updated").length === 0,
  "an unmatched search yields no rows",
)

// --- projects and groups ----------------------------------------------------

console.log("explorer.projects")
const projectRows = [
  ...all,
  normalizeSession(SERVER, session("second", { title: "More", projectID: "p2" }), [
    project("p2", "/work/beta", "Beta"),
  ]),
]
const listed = projectsOf(projectRows)
assert(listed.length === 3, "one entry per project")
assert(
  listed.find((entry) => entry.projectId === "p3")?.count === 1,
  "an archived-only project is still listed",
)
assert(
  listed.find((entry) => entry.projectId === "p2")?.count === 2,
  "counts include archived and live sessions",
)
assert(
  listed.map((entry) => entry.name).join(",") === "Alpha,Beta,Retired",
  "project names sort alphabetically",
)

const duplicateNames = projectsOf([
  normalizeSession(SERVER, session("one"), [project("p1", "/work/one/app", "app")]),
  normalizeSession(SERVER, session("two", { projectID: "p2" }), [project("p2", "/work/two/app", "app")]),
])
assert(
  duplicateNames.every((entry) => entry.name.includes("—")),
  "same-named projects are disambiguated by directory",
)

const multiServerProjects = projectsOf([
  normalizeSession(SERVER, session("one"), [project("p1", "/work/app", "app")]),
  normalizeSession(OTHER, session("two"), [project("p1", "/work/app", "app")]),
])
assert(
  multiServerProjects.every((entry) => entry.name.includes("Local") || entry.name.includes("Remote")),
  "projects are qualified by server when more than one server is listed",
)
assert(multiServerProjects.length === 2, "the same project id on two servers stays two entries")

console.log("explorer.groups")
const grouped = groupSessions(
  [
    normalizeSession(SERVER, session("new", { updated: 9 }), [project("p1", "/work/alpha", "Alpha")]),
    normalizeSession(SERVER, session("old", { updated: 1 }), [project("p1", "/work/alpha", "Alpha")]),
    normalizeSession(SERVER, session("b", { updated: 5, projectID: "p2" }), [project("p2", "/work/beta", "Beta")]),
  ],
  listed,
)
assert(grouped.length === 2, "groups by project")
assert(grouped[0]?.name === "Alpha", "groups sort by name")
assert(
  grouped[0]?.sessions.map((row) => row.sessionId).join(",") === "new,old",
  "groups preserve the incoming sort order",
)
assert(groupSessions([], listed).length === 0, "grouping nothing yields nothing")

console.log("explorer.counts")
assert(
  JSON.stringify(archiveCounts(all)) === JSON.stringify({ all: 3, unarchived: 2, archived: 1 }),
  "counts split archived from unarchived",
)

console.log("explorer.time")
const now = 1_700_000_000_000
assert(relativeTime(0, now) === "unknown", "a zero time reads as unknown")
assert(relativeTime(now - 5_000, now) === "just now", "seconds read as just now")
assert(relativeTime(now - 5 * 60_000, now) === "5m ago", "minutes are rounded")
assert(relativeTime(now - 5 * 3_600_000, now) === "5h ago", "hours are rounded")
assert(relativeTime(now - 3 * 86_400_000, now) === "3d ago", "days are rounded")
assert(/2023/.test(relativeTime(now - 40 * 86_400_000, now)), "older times use a date")

console.log("explorer.prefs")
assert(JSON.stringify(resolvePrefs(undefined)) === JSON.stringify(DEFAULT_PREFS), "no value falls back to defaults")
assert(JSON.stringify(resolvePrefs(null)) === JSON.stringify(DEFAULT_PREFS), "a null value falls back to defaults")
assert(JSON.stringify(resolvePrefs("nope")) === JSON.stringify(DEFAULT_PREFS), "a string value falls back to defaults")
assert(resolvePrefs({ archive: "sideways" }).archive === "all", "an unknown archive filter falls back")
assert(resolvePrefs({ sort: "size" }).sort === "updated", "an unknown sort falls back")
assert(resolvePrefs({ group: "true" }).group === false, "only a real boolean enables grouping")
assert(resolvePrefs({ group: true }).group === true, "grouping can be enabled")
assert(
  resolvePrefs({ project: "sidecar\np1" }, ["sidecar\np1", "sidecar\np2"]).project === "sidecar\np1",
  "a known project is kept",
)
assert(
  resolvePrefs({ project: "sidecar\ngone" }, ["sidecar\np1"]).project === ALL_PROJECTS,
  "a project that no longer exists falls back to All",
)
assert(
  resolvePrefs({ project: "sidecar\ngone" }).project === "sidecar\ngone",
  "before projects load, a saved project is not discarded",
)
assert(resolvePrefs({}).project === ALL_PROJECTS, "no project selection means All")

console.log("explorer.directories")
assert(
  directoriesOf([normalized("a", { directory: "/x" }), normalized("b", { directory: "/x" }), normalized("c", { directory: "/y" })]).join(",") === "/x,/y",
  "unique directories, sorted",
)
assert(directoriesOf([normalized("d", { directory: "" })]).length === 0, "empty directories are skipped")

// --- preferences store ------------------------------------------------------

console.log("gui.preferences")
function stubContext(initial: unknown = {}): { ctx: ExplorerContext; read: () => unknown } {
  let stored = initial
  const ctx = {
    stores: {
      prefs: {
        get value() {
          return stored
        },
        set(next: unknown) {
          stored = next
        },
      },
    },
  }
  return { ctx: ctx as unknown as ExplorerContext, read: () => stored }
}

const store = stubContext({ project: "sidecar\np1", archive: "archived", sort: "title", group: true })
assert(readPreferences(store.ctx).archive === "archived", "reads the stored archive filter")
assert(readPreferences(store.ctx, []).project === ALL_PROJECTS, "drops a project missing from a loaded list")
writePreferences(store.ctx, { project: ALL_PROJECTS, archive: "unarchived", sort: "created", group: false })
assert(
  JSON.stringify(store.read()) ===
    JSON.stringify({ project: ALL_PROJECTS, archive: "unarchived", sort: "created", group: false }),
  "writes only the four UI preferences",
)
resetPreferences(store.ctx)
assert(JSON.stringify(store.read()) === JSON.stringify(DEFAULT_PREFS), "reset restores the documented defaults")

// --- SDK adapter ------------------------------------------------------------

console.log("service.fetchProjects")
{
  const requested: boolean[] = []
  const client = {
    project: {
      list: async (input: { archived?: boolean }) => {
        requested.push(input.archived === true)
        return input.archived
          ? [project("p2", "/work/beta", "Beta")]
          : [project("p1", "/work/alpha", "Alpha"), project("p2", "/work/beta", "Beta")]
      },
    },
  } as unknown as OpenCodeClient
  const result = await fetchProjects(client, new AbortController().signal)
  assert(result.length === 2, "merges live and archived projects")
  assert(requested.join(",") === "false,true", "asks for both project states explicitly")
}
{
  const client = {
    project: {
      list: async () => {
        throw new Error("offline")
      },
    },
  } as unknown as OpenCodeClient
  assert((await fetchProjects(client, new AbortController().signal)).length === 0, "a failed project read is not fatal")
}

console.log("service.fetchRunning")
{
  const client = {
    session: { active: async () => ({ s1: { type: "running" }, s2: { type: "running" } }) },
  } as unknown as OpenCodeClient
  const running = await fetchRunning(client, new AbortController().signal)
  assert(running?.has("s1") === true && running?.has("s2") === true, "reports running sessions")
  assert(running?.has("s3") === false, "idle sessions are not running")
}
{
  const client = {
    session: {
      active: async () => {
        throw new Error("offline")
      },
    },
  } as unknown as OpenCodeClient
  const running = await fetchRunning(client, new AbortController().signal)
  assert(running === undefined, "a failed running read stays unknown, not idle")
}

console.log("service.paging")
{
  const fake = pagingClient({
    live: [
      { data: [session("live-1"), session("child", { parentID: "live-1" })], next: "page-1" },
      { data: [session("live-2")] },
    ],
    archived: [{ data: [session("gone-1", { archived: 5 })] }],
  })
  const server = fakeServer("sidecar", "Local", fake.client)
  const snapshots: number[] = []
  const loaded = await loadServerSessions(server, new AbortController().signal, (rows) => {
    snapshots.push(rows.length)
  })

  assert(loaded.sessions.length === 3, "loads both archive states")
  assert(
    loaded.sessions.some((row) => row.sessionId === "gone-1"),
    "archived sessions are included",
  )
  assert(!loaded.sessions.some((row) => row.sessionId === "child"), "child sessions are excluded from the root list")
  assert(snapshots[0] === 1, "the first page is published before paging finishes")
  assert(snapshots.length >= 3, "each page is published as it arrives")
  assert(
    fake.calls.every((call) => call.input.parentID === null),
    "asks for root sessions only",
  )
  assert(
    fake.calls.every((call) => call.input.directory === undefined && call.input.project === undefined),
    "never scopes the request to one project, so every project is listed",
  )
  assert(fake.calls.map((call) => call.input.archived).join(",") === "false,false,true", "pages live then archived")
  assert(
    fake.calls.every((call) => call.input.limit === PAGE_SIZE),
    `uses a page size of ${PAGE_SIZE}`,
  )
  assert(
    fake.calls[1]?.input.cursor === "page-1",
    "follows the server cursor instead of capping the history",
  )
  assert(loaded.projects.length === 0, "a server without project metadata still yields sessions")
}

console.log("service.paging.guard")
{
  let calls = 0
  const client = {
    session: {
      list: async () => {
        calls++
        return { data: [], cursor: { previous: undefined, next: "loop" } }
      },
    },
  } as unknown as OpenCodeClient
  await loadArchiveState(client, SERVER, [], false, undefined, new AbortController().signal, () => {})
  assert(calls === 2, "a repeating cursor is followed once and then stops the chain")
}

console.log("service.paging.abort")
{
  const controller = new AbortController()
  controller.abort()
  const fake = pagingClient({ live: [{ data: [session("a")] }], archived: [] })
  const server = fakeServer("sidecar", "Local", fake.client)
  const loaded = await loadServerSessions(server, controller.signal, () => {})
  assert(loaded.sessions.length === 0, "an aborted load returns no rows")
  assert(fake.calls.length === 0, "an aborted load sends no list request")
}

console.log("service.rows")
{
  const fake = pagingClient({
    live: [{ data: [session("a"), session("b")] }],
    archived: [{ data: [session("c", { archived: 3 })] }],
  })
  const runningClient = {
    session: {
      list: fake.client.session.list,
      active: async () => ({ b: { type: "running" } }),
    },
    project: { list: async () => [project("p1", "/work/alpha", "Alpha")] },
  } as unknown as OpenCodeClient
  const loaded = await loadServerSessions(fakeServer("sidecar", "Local", runningClient), new AbortController().signal, () => {})
  assert(loaded.sessions.find((row) => row.sessionId === "b")?.running === true, "running sessions are flagged")
  assert(loaded.sessions.find((row) => row.sessionId === "a")?.running === undefined, "other sessions stay unknown")
  assert(loaded.sessions.every((row) => row.projectName === "Alpha"), "rows carry their project name")
}

console.log("service.checkDirectories")
{
  const checked: string[][] = []
  const directories = Array.from({ length: DIRECTORY_CHUNK + 3 }, (_, index) => `/dir/${index}`)
  const result = await checkDirectories(
    fakeServer(),
    directories,
    async (input) => {
      checked.push(input.directories)
      return { missing: input.directories.filter((directory) => directory === "/dir/0") }
    },
    new AbortController().signal,
  )
  assert(checked.length === 2, "splits directory checks into bounded chunks")
  assert(result.missing.has("/dir/0"), "reports the missing directory")
  assert(result.checked.size === directories.length, "marks every asked directory as checked")
  assert(!result.missing.has("/dir/1"), "present directories are not missing")
}
{
  const result = await checkDirectories(
    fakeServer(),
    ["/dir/a"],
    async () => {
      throw new Error("rpc not found")
    },
    new AbortController().signal,
  )
  assert(result.missing.size === 0, "a server without the RPC reports nothing missing")
  assert(result.checked.size === 0, "a failed check leaves the directory unknown")
}
{
  let called = false
  const controller = new AbortController()
  controller.abort()
  await checkDirectories(
    fakeServer(),
    ["/dir/a"],
    async () => {
      called = true
      return { missing: [] }
    },
    controller.signal,
  )
  assert(!called, "an aborted check sends no request")
}

console.log("service.directoryStatus")
{
  const rows = [normalized("a", { directory: "/dir/a" }), normalized("b", { directory: "/dir/b" })]
  const applied = withDirectoryStatus(rows, "sidecar", {
    missing: new Set(["/dir/a"]),
    checked: new Set(["/dir/a", "/dir/b"]),
  })
  assert(applied[0]?.directoryStatus === "missing", "a reported directory is missing")
  assert(applied[1]?.directoryStatus === "present", "a checked directory is present")
  assert(
    withDirectoryStatus(rows, "other-server", { missing: new Set(["/dir/a"]), checked: new Set(["/dir/a"]) })[0]
      ?.directoryStatus === "unknown",
    "another server's rows are untouched",
  )
  assert(
    withDirectoryStatus([normalized("c", { directory: "/dir/c" })], "sidecar", {
      missing: new Set(),
      checked: new Set(),
    })[0]?.directoryStatus === "unknown",
    "an unchecked directory stays unknown",
  )
  assert(
    serverDirectories([...rows, normalizeSession(OTHER, session("c", { directory: "/dir/z" }), [])], "sidecar").join(",") ===
      "/dir/a,/dir/b",
    "directory checks only cover the owning server's rows",
  )
}

console.log("service.replaceServerRows")
{
  const local = [normalized("a"), normalized("b")]
  const remote = [normalizeSession(OTHER, session("c"), [])]
  const replaced = replaceServerRows([...local, ...remote], "sidecar", [normalized("b", { title: "fresh" })])
  assert(replaced.length === 2, "replaces one server's rows")
  assert(
    replaced.filter((row) => row.serverId === "sidecar").length === 1,
    "drops stale rows for that server",
  )
  assert(replaced.some((row) => row.serverId === OTHER.id), "keeps other servers' rows")
  assert(rowsOfServer([...local, ...remote], "sidecar").length === 2, "filters rows by server")
}

console.log("service.errors")
assert(describeError(new Error("boom")) === "boom", "an Error reads its message")
assert(describeError("plain") === "plain", "a non-Error is stringified")
assert(describeError(new Error("")) === "Error", "an empty message falls back to the constructor name")

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed`)
  process.exit(1)
}
console.log("\nall assertions passed")

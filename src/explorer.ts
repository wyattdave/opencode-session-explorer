import type { Project, SessionInfo } from "@opencode/client"

/**
 * Pure helpers behind the Session Explorer.
 *
 * The TUI panel keeps its own helpers in `sessions.ts`; this module is the
 * shared metadata layer for the Desktop GUI (and is unit-tested directly). It
 * is free of JSX and of any OpenCode runtime import, so both the Vite GUI
 * bundle and the Bun test run can load it.
 */

/** The archive filter offered by the explorer. */
export type ArchiveFilter = "all" | "unarchived" | "archived"

/** The sort modes offered by the explorer. */
export type SortMode = "updated" | "created" | "title"

/**
 * Whether a session's working directory was found on its server.
 *
 * `unknown` is a first-class state: the server may not answer, may be remote,
 * or may not load this plugin. Unknown is never treated as missing.
 */
export type DirectoryStatus = "present" | "missing" | "unknown"

/** What we know about a server that owns sessions. */
export interface ExplorerServer {
  readonly id: string
  readonly name: string
}

/**
 * A session normalized for display and navigation.
 *
 * `serverId` and `sessionId` are kept separate because the tabs API needs both,
 * and records are keyed by the pair, never by session id alone.
 */
export interface ExplorerSession {
  /** `(serverId, sessionId)` as one key; unique across servers. */
  readonly key: string
  readonly serverId: string
  readonly serverName: string
  readonly sessionId: string
  readonly projectId: string
  readonly projectName: string
  readonly projectDirectory: string
  readonly directory: string
  readonly subpath: string | undefined
  readonly title: string
  readonly createdAt: number
  readonly updatedAt: number
  readonly archivedAt: number | undefined
  readonly parentId: string | undefined
  /** True when the server reports a running execution; undefined when unknown. */
  readonly running: boolean | undefined
  readonly directoryStatus: DirectoryStatus
}

/** Displayed when a session has no title. */
export const UNTITLED = "Untitled session"

/** The value of the project filter that matches every project. */
export const ALL_PROJECTS = "all"

/** The separator the host uses for `(server, session)` keys. */
const KEY_SEPARATOR = "\n"

/** Key a session by its owning server and its own id. */
export function sessionKey(serverId: string, sessionId: string): string {
  return `${serverId}${KEY_SEPARATOR}${sessionId}`
}

/**
 * Key a project by its owning server and project id.
 *
 * Unlike a session key, a project key is also the `value` of the host's
 * `Ui.Select`. The host renders and looks those values up in the DOM, so the
 * key must be free of whitespace, quotes and other selector-hostile characters;
 * encode both halves instead of joining them raw.
 */
export function projectKey(serverId: string, projectId: string): string {
  return `${encodeURIComponent(serverId)}+${encodeURIComponent(projectId)}`
}

/** The last path segment of a directory, used as a project/directory label. */
export function baseName(directory: string): string {
  const parts = directory.split(/[\\/]+/).filter(Boolean)
  return parts.at(-1) ?? directory
}

/**
 * Normalize a timestamp to milliseconds. The API reports milliseconds today,
 * but treating a seconds value (or a non-number) as milliseconds would show
 * 1970 dates, so normalize once at the boundary.
 */
export function toMillis(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0
  return value < 100_000_000_000 ? Math.round(value * 1000) : Math.round(value)
}

/** Resolve a project record for a session, tolerating missing metadata. */
function projectFor(
  session: SessionInfo,
  projects: readonly Project[],
): { id: string; name: string; directory: string } {
  const project = projects.find((candidate) => candidate.id === session.projectID)
  const canonical = project?.canonical ?? session.location.directory
  const name = project?.name?.trim() || baseName(canonical)
  return { id: session.projectID, name, directory: canonical }
}

/**
 * Normalize one API session for the explorer. `running` and
 * `directoryStatus` are supplied by the caller (both are separate reads) and
 * default to unknown.
 */
export function normalizeSession(
  server: ExplorerServer,
  session: SessionInfo,
  projects: readonly Project[] = [],
  options: { running?: boolean; directoryStatus?: DirectoryStatus } = {},
): ExplorerSession {
  const project = projectFor(session, projects)
  return {
    key: sessionKey(server.id, session.id),
    serverId: server.id,
    serverName: server.name,
    sessionId: session.id,
    projectId: project.id,
    projectName: project.name,
    projectDirectory: project.directory,
    directory: session.location.directory,
    subpath: session.subpath || undefined,
    title: session.title?.trim() || UNTITLED,
    createdAt: toMillis(session.time.created),
    updatedAt: toMillis(session.time.updated),
    archivedAt: session.time.archived === undefined ? undefined : toMillis(session.time.archived),
    parentId: session.parentID || undefined,
    running: options.running,
    directoryStatus: options.directoryStatus ?? "unknown",
  }
}

/** Merge normalized pages, dropping repeated `(serverId, sessionId)` records. */
export function mergeSessions(
  existing: readonly ExplorerSession[],
  incoming: readonly ExplorerSession[],
): ExplorerSession[] {
  const byKey = new Map(existing.map((session) => [session.key, session]))
  for (const session of incoming) byKey.set(session.key, session)
  return [...byKey.values()]
}

/** Follow a page chain once: return the next cursor unless it repeats or is empty. */
export function nextCursor(
  previous: string | undefined,
  next: string | null | undefined,
  seen: ReadonlySet<string>,
): string | undefined {
  if (!next || next === previous || seen.has(next)) return undefined
  return next
}

/** Whether a session matches the archive filter. */
export function matchesArchive(session: ExplorerSession, filter: ArchiveFilter): boolean {
  if (filter === "archived") return session.archivedAt !== undefined
  if (filter === "unarchived") return session.archivedAt === undefined
  return true
}

/** Case-insensitive text matched by the search box. */
export function searchText(session: ExplorerSession): string {
  return [
    session.title,
    session.projectName,
    session.projectDirectory,
    session.directory,
    session.subpath ?? "",
    session.sessionId,
    session.serverName,
  ]
    .join("\n")
    .toLowerCase()
}

/** Whether a session matches a trimmed, lowercased query. */
export function matchesQuery(session: ExplorerSession, query: string): boolean {
  const q = query.trim().toLowerCase()
  return q.length === 0 || searchText(session).includes(q)
}

/** Stable text comparison, independent of the user's locale. */
function compareText(a: string, b: string): number {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** Sort rows, with `(serverId, sessionId)` as the final stable tie-breaker. */
export function sortSessions(rows: readonly ExplorerSession[], mode: SortMode): ExplorerSession[] {
  return rows.slice().sort((a, b) => {
    if (mode === "title") {
      const byTitle = compareText(a.title, b.title)
      if (byTitle !== 0) return byTitle
    } else if (mode === "created") {
      if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
    } else if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt - a.updatedAt
    }
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })
}

/** The filters the explorer applies together (logical AND). */
export interface SessionFilters {
  readonly query: string
  readonly project: string
  readonly archive: ArchiveFilter
}

/** Apply search, project and archive filters, then sort. */
export function filterSessions(
  rows: readonly ExplorerSession[],
  filters: SessionFilters,
  mode: SortMode,
): ExplorerSession[] {
  const project = filters.project
  const matched = rows.filter((row) => {
    if (project !== ALL_PROJECTS && projectKey(row.serverId, row.projectId) !== project) return false
    if (!matchesArchive(row, filters.archive)) return false
    return matchesQuery(row, filters.query)
  })
  return sortSessions(matched, mode)
}

/** A project that can be picked in the filter. */
export interface ExplorerProject {
  readonly key: string
  readonly serverId: string
  readonly serverName: string
  readonly projectId: string
  readonly name: string
  readonly directory: string
  /** Sessions across both archive states, so archived-only projects stay listed. */
  readonly count: number
}

/**
 * Projects seen in the complete metadata set, with duplicate names
 * disambiguated by their directory and, if needed, by server.
 */
export function projectsOf(rows: readonly ExplorerSession[]): ExplorerProject[] {
  const byKey = new Map<string, { row: ExplorerSession; count: number }>()
  for (const row of rows) {
    const key = projectKey(row.serverId, row.projectId)
    const current = byKey.get(key)
    if (current) current.count++
    else byKey.set(key, { row, count: 1 })
  }

  const raw = [...byKey.entries()].map(([key, entry]) => ({
    key,
    serverId: entry.row.serverId,
    serverName: entry.row.serverName,
    projectId: entry.row.projectId,
    name: entry.row.projectName,
    directory: entry.row.projectDirectory,
    count: entry.count,
  }))

  const nameCount = new Map<string, number>()
  for (const project of raw) nameCount.set(project.name.toLowerCase(), (nameCount.get(project.name.toLowerCase()) ?? 0) + 1)
  const serverCount = new Map<string, number>()
  for (const project of raw) serverCount.set(project.serverId, (serverCount.get(project.serverId) ?? 0) + 1)
  const multiServer = serverCount.size > 1

  const directoryLabels = new Map<string, string>()
  for (const project of raw) {
    if ((nameCount.get(project.name.toLowerCase()) ?? 0) < 2) continue
    directoryLabels.set(project.key, `${project.name} — ${baseName(project.directory)}`)
  }

  const labelCount = new Map<string, number>()
  for (const project of raw) {
    const label = directoryLabels.get(project.key) ?? project.name
    labelCount.set(label.toLowerCase(), (labelCount.get(label.toLowerCase()) ?? 0) + 1)
  }

  return raw
    .map((project) => {
      const base = directoryLabels.get(project.key) ?? project.name
      const duplicate = (labelCount.get(base.toLowerCase()) ?? 0) > 1
      const name = duplicate || multiServer ? `${base} · ${project.serverName}` : base
      return { ...project, name }
    })
    .sort((a, b) => compareText(a.name, b.name) || compareText(a.key, b.key))
}

/** A collapsible project group in the result list. */
export interface ExplorerGroup {
  readonly key: string
  readonly name: string
  readonly serverId: string
  readonly directory: string
  readonly sessions: ExplorerSession[]
}

/** Group filtered rows by project, preserving the list's sort order inside each group. */
export function groupSessions(rows: readonly ExplorerSession[], projects: readonly ExplorerProject[]): ExplorerGroup[] {
  const nameByKey = new Map(projects.map((project) => [project.key, project.name]))
  const groups = new Map<string, ExplorerSession[]>()
  for (const row of rows) {
    const key = projectKey(row.serverId, row.projectId)
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  return [...groups.entries()]
    .map(([key, sessions]) => {
      const first = sessions[0]!
      return {
        key,
        name: nameByKey.get(key) ?? first.projectName,
        serverId: first.serverId,
        directory: first.projectDirectory,
        sessions,
      }
    })
    .sort((a, b) => compareText(a.name, b.name) || compareText(a.key, b.key))
}

/** Counts shown in the footer and the archive filter. */
export function archiveCounts(rows: readonly ExplorerSession[]): { all: number; unarchived: number; archived: number } {
  let archived = 0
  for (const row of rows) if (row.archivedAt !== undefined) archived++
  return { all: rows.length, unarchived: rows.length - archived, archived }
}

/** Human-readable relative time, deterministic for a supplied `now`. */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  if (timestamp <= 0) return "unknown"
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 45) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

/** The persisted UI preferences. Nothing else is stored. */
export interface ExplorerPrefs {
  readonly project: string
  readonly archive: ArchiveFilter
  readonly sort: SortMode
  readonly group: boolean
}

export const DEFAULT_PREFS: ExplorerPrefs = {
  project: ALL_PROJECTS,
  archive: "all",
  sort: "updated",
  group: false,
}

const ARCHIVE_FILTERS: readonly ArchiveFilter[] = ["all", "unarchived", "archived"]
const SORT_MODES: readonly SortMode[] = ["updated", "created", "title"]

/**
 * Read stored preferences defensively. Unknown values fall back to the
 * defaults, and a project that no longer exists falls back to All.
 *
 * Pass `availableProjects` once the projects are known. While the first load is
 * still running, omit it so a saved project selection is kept instead of being
 * reset before its project has had a chance to appear.
 */
export function resolvePrefs(value: unknown, availableProjects?: readonly string[]): ExplorerPrefs {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const archive = ARCHIVE_FILTERS.includes(raw.archive as ArchiveFilter)
    ? (raw.archive as ArchiveFilter)
    : DEFAULT_PREFS.archive
  const sort = SORT_MODES.includes(raw.sort as SortMode) ? (raw.sort as SortMode) : DEFAULT_PREFS.sort
  const project =
    typeof raw.project === "string" &&
    (raw.project === ALL_PROJECTS || availableProjects === undefined || availableProjects.includes(raw.project))
      ? raw.project
      : ALL_PROJECTS
  return { project, archive, sort, group: raw.group === true }
}

/** The subset of directories whose status should be checked. */
export function directoriesOf(rows: readonly ExplorerSession[]): string[] {
  return [...new Set(rows.map((row) => row.directory).filter((directory) => directory.length > 0))].sort()
}

import type { OpenCodeClient, Project, SessionInfo } from "@opencode/client"
import type { ServerRef } from "@opencode/plugin/gui"
import {
  directoriesOf,
  mergeSessions,
  nextCursor,
  normalizeSession,
  sessionKey,
  type ExplorerServer,
  type ExplorerSession,
} from "../explorer.js"

/**
 * Typed adapter between the explorer's normalized metadata and the servers the
 * desktop app lists. Every read is scoped to the owning server's authenticated
 * client; nothing is routed through a different server or through local paths.
 */

/** Sessions requested per page. The list follows the next cursor without a fixed total cap. */
export const PAGE_SIZE = 100

/** Directories per missing-directory RPC call, matching the upstream server limit. */
export const DIRECTORY_CHUNK = 500

/** What one server contributed to the metadata index. */
export interface ServerLoad {
  readonly sessions: ExplorerSession[]
  readonly projects: Project[]
}

/**
 * A page callback, called as each page arrives so long histories render
 * progressively. It receives every row collected so far for that request.
 */
export type PageSink = (sessions: readonly ExplorerSession[]) => void

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

/** The explorer's view of a server, keyed by the host's server id. */
export function serverOf(server: ServerRef): ExplorerServer {
  return { id: server.id, name: server.name || server.id }
}

/**
 * Projects for a server, including archived ones. A failure here is not fatal:
 * session records carry their own directory, so rows still render.
 */
export async function fetchProjects(client: OpenCodeClient, signal: AbortSignal): Promise<Project[]> {
  // Each read is started inside an async function so a synchronous failure
  // (a missing method on an older client) is rejected, not thrown past the
  // settled results.
  const results = await Promise.allSettled([
    (async () => client.project.list({}, { signal }))(),
    (async () => client.project.list({ archived: true }, { signal }))(),
  ])
  const byId = new Map<string, Project>()
  for (const result of results) {
    if (result.status !== "fulfilled") continue
    for (const project of result.value) byId.set(project.id, project)
  }
  return [...byId.values()]
}

/** Session ids the server reports as running. Unknown on failure. */
export async function fetchRunning(
  client: OpenCodeClient,
  signal: AbortSignal,
): Promise<ReadonlySet<string> | undefined> {
  try {
    const active = await client.session.active({ signal })
    return new Set(
      Object.entries(active)
        .filter(([, status]) => status?.type === "running")
        .map(([sessionID]) => sessionID),
    )
  } catch {
    return undefined
  }
}

/**
 * Page one archive state of a server's root sessions. Follows `cursor.next`
 * until exhausted, guarding a cursor that repeats or fails to advance.
 */
export async function loadArchiveState(
  client: OpenCodeClient,
  server: ExplorerServer,
  projects: readonly Project[],
  archived: boolean,
  running: ReadonlySet<string> | undefined,
  signal: AbortSignal,
  sink: PageSink,
): Promise<ExplorerSession[]> {
  let collected: ExplorerSession[] = []
  let cursor: string | undefined
  const seen = new Set<string>()

  for (;;) {
    if (signal.aborted) return collected
    const page = await client.session.list(
      {
        order: "desc",
        limit: PAGE_SIZE,
        parentID: null,
        archived,
        ...(cursor === undefined ? {} : { cursor }),
      },
      { signal },
    )
    const normalized = page.data
      .filter((session: SessionInfo) => !session.parentID)
      .map((session) =>
        normalizeSession(server, session, projects, {
          running: running?.has(session.id) === true ? true : undefined,
        }),
      )
    collected = mergeSessions(collected, normalized)
    sink(collected)

    const next = nextCursor(cursor, page.cursor?.next ?? undefined, seen)
    if (next === undefined) return collected
    seen.add(next)
    cursor = next
  }
}

/**
 * Load both archive states. They are fetched separately so archived results
 * never depend on what a default (possibly unarchived-only) list returns.
 */
export async function loadServerSessions(
  server: ServerRef,
  signal: AbortSignal,
  sink: PageSink,
): Promise<ServerLoad> {
  const explorer = serverOf(server)
  const [projects, running] = await Promise.all([
    fetchProjects(server.client, signal),
    fetchRunning(server.client, signal),
  ])

  let combined: ExplorerSession[] = []
  // Merge one archive state's accumulated rows into the combined index. Each
  // state reports its own complete set as it pages, so rows it owns replace
  // earlier copies rather than accumulating duplicates.
  const emitState = (stateRows: readonly ExplorerSession[]) => {
    const keys = new Set(stateRows.map((row) => row.key))
    combined = mergeSessions(
      combined.filter((row) => !keys.has(row.key)),
      stateRows,
    )
    sink(combined)
  }

  for (const archived of [false, true]) {
    if (signal.aborted) break
    await loadArchiveState(server.client, explorer, projects, archived, running, signal, emitState)
  }

  return { sessions: combined, projects }
}

/**
 * Ask this server's own copy of the plugin which directories are gone.
 *
 * The RPC runs on the owning server, so it checks that server's filesystem. A
 * server that does not load the plugin rejects `rpc.method_not_found`; every
 * directory then stays `unknown`, which is never reported as missing.
 */
export async function checkDirectories(
  server: ServerRef,
  directories: readonly string[],
  check: (input: { directories: string[] }, options: { signal: AbortSignal }) => Promise<{ missing: string[] }>,
  signal: AbortSignal,
): Promise<{ missing: Set<string>; checked: Set<string> }> {
  const missing = new Set<string>()
  const checked = new Set<string>()
  for (let index = 0; index < directories.length; index += DIRECTORY_CHUNK) {
    if (signal.aborted) break
    const chunk = directories.slice(index, index + DIRECTORY_CHUNK)
    if (chunk.length === 0) continue
    try {
      const result = await check({ directories: chunk }, { signal })
      for (const directory of chunk) checked.add(directory)
      for (const directory of result.missing) missing.add(directory)
    } catch {
      // Unknown for this chunk; do not mark anything missing.
    }
  }
  return { missing, checked }
}

/** Directories one server's rows need checked. */
export function serverDirectories(rows: readonly ExplorerSession[], serverId: string): string[] {
  return directoriesOf(rows.filter((row) => row.serverId === serverId))
}

/** Replace a server's rows in the shared index, keeping other servers untouched. */
export function replaceServerRows(
  rows: readonly ExplorerSession[],
  serverId: string,
  next: readonly ExplorerSession[],
): ExplorerSession[] {
  return mergeSessions(
    rows.filter((row) => row.serverId !== serverId),
    next,
  )
}

/** Rows belonging to one server. */
export function rowsOfServer(rows: readonly ExplorerSession[], serverId: string): ExplorerSession[] {
  return rows.filter((row) => row.serverId === serverId)
}

/** Apply directory results to one server's rows. */
export function withDirectoryStatus(
  rows: readonly ExplorerSession[],
  serverId: string,
  result: { missing: Set<string>; checked: Set<string> },
): ExplorerSession[] {
  return rows.map((row) => {
    if (row.serverId !== serverId) return row
    if (result.missing.has(row.directory)) return { ...row, directoryStatus: "missing" }
    if (result.checked.has(row.directory)) return { ...row, directoryStatus: "present" }
    return row
  })
}

/** A human-readable, single-line message for a rejected SDK call. */
export function describeError(error: unknown): string {
  return errorMessage(error)
}

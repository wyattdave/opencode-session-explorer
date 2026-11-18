import { createKeyed, type ServerRef } from "@opencode/plugin/gui"
import { createSignal, onCleanup, type Accessor } from "solid-js"
import {
  type ExplorerSession,
} from "../explorer.js"
import { SessionHistory } from "../rpc.js"
import type { ExplorerContext } from "./preferences.js"
import {
  checkDirectories,
  describeError,
  loadServerSessions,
  rowsOfServer,
  serverDirectories,
  serverOf,
  withDirectoryStatus,
} from "./session-service.js"

/** Events that can change the metadata index. Bursts are debounced. */
const REFRESH_EVENTS = new Set([
  "session.created",
  "session.deleted",
  "session.renamed",
  "session.metadata.updated",
  "session.archived",
  "session.unarchived",
  "session.moved",
  "project.updated",
])

const REFRESH_DEBOUNCE = 300

/** One listed server's loading state. */
export interface ServerState {
  readonly id: string
  readonly name: string
  readonly status: "loading" | "ready" | "error" | "incompatible"
  readonly message?: string
  readonly connected: boolean
}

/** The explorer's state and actions, shared by the launcher and the dialog. */
export interface ExplorerController {
  readonly rows: Accessor<ExplorerSession[]>
  readonly servers: Accessor<ServerState[]>
  readonly loading: Accessor<boolean>
  /** True while the host has not listed any server yet (cold start). */
  readonly waiting: Accessor<boolean>
  readonly stale: Accessor<boolean>
  readonly updatedAt: Accessor<number | undefined>
  /** Marks the dialog open and starts a refresh. */
  open(): void
  /** Marks the dialog closed; event-driven refreshes wait until it opens again. */
  close(): void
  readonly isOpen: Accessor<boolean>
  /** Reload metadata from every server, cancelling any request already in flight. */
  refresh(): void
  setArchived(session: ExplorerSession, archived: boolean): Promise<boolean>
  copyId(session: ExplorerSession): Promise<void>
  /** Focus the session's tab or open it, after a missing-directory warning. */
  openSession(session: ExplorerSession): Promise<boolean>
  /** Restore through the SDK, verify the call, then open. */
  restoreAndOpen(session: ExplorerSession): Promise<boolean>
  toast(kind: "default" | "success" | "error", title: string, description?: string): void
}

/**
 * Build the explorer state once, in the plugin's window setup, so the index
 * survives closing the dialog. Nothing loads until the dialog opens, and every
 * render reads the same signals.
 */
export function createExplorerController(ctx: ExplorerContext): ExplorerController {
  const [rows, setRows] = createSignal<ExplorerSession[]>([])
  const [servers, setServers] = createSignal<ServerState[]>([])
  const [loading, setLoading] = createSignal(false)
  const [waiting, setWaiting] = createSignal(false)
  const [stale, setStale] = createSignal(false)
  const [updatedAt, setUpdatedAt] = createSignal<number | undefined>(undefined)
  const [isOpen, setOpenFlag] = createSignal(false)

  let generation = 0
  let inFlight: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const toast: ExplorerController["toast"] = (kind, title, description) => {
    const variant = kind === "default" ? undefined : kind
    ctx.toast.show({ title, description, variant })
  }

  const scheduleRefresh = () => {
    if (!isOpen()) {
      // Keep the cached rows; mark them stale so reopening refreshes.
      setStale(true)
      return
    }
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void refresh()
    }, REFRESH_DEBOUNCE)
  }

  const refresh = async (): Promise<void> => {
    if (!isOpen()) return
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }

    const current = ++generation
    inFlight?.abort()
    const abort = new AbortController()
    inFlight = abort
    const signal = abort.signal

    const listed = ctx.servers
      .list()
      .map((id) => ctx.servers.get(id))
      .filter((server): server is ServerRef => server !== undefined)
    const usable = listed.filter((server) => server.compatible !== false)
    const blocked = listed.filter((server) => server.compatible === false)

    // A cold start can run before the host has listed its servers. That is not
    // an error and not an empty archive: stay in the connecting state, and the
    // server-list effect refreshes once the server appears.
    if (listed.length === 0) {
      setWaiting(true)
      setLoading(false)
      setStale(false)
      setServers([])
      return
    }
    setWaiting(false)

    setLoading(true)
    setStale(false)
    setServers([
      ...usable.map((server) => ({
        id: server.id,
        name: server.name || server.id,
        status: "loading" as const,
        connected: server.connected,
      })),
      ...blocked.map((server) => ({
        id: server.id,
        name: server.name || server.id,
        status: "incompatible" as const,
        message: ctx.t("state.incompatible"),
        connected: server.connected,
      })),
    ])

    // Keep each server's last good rows while its reload runs, and keep them if
    // it fails: a failed request is never shown as an empty archive.
    const byServer = new Map<string, ExplorerSession[]>()
    for (const row of rows()) {
      const list = byServer.get(row.serverId)
      if (list) list.push(row)
      else byServer.set(row.serverId, [row])
    }
    const publish = () => {
      if (current !== generation) return
      setRows([...byServer.values()].flat())
    }

    const outcomes = await Promise.all(
      usable.map(async (server) => {
        try {
          const load = await loadServerSessions(server, signal, (page) => {
            byServer.set(server.id, [...page])
            publish()
          })
          if (current !== generation || signal.aborted) return { server, ok: true as const }
          byServer.set(server.id, load.sessions)
          publish()

          const directories = serverDirectories(load.sessions, server.id)
          if (directories.length > 0) {
            const result = await checkDirectories(
              server,
              directories,
              (input, options) =>
                server.client.rpc(SessionHistory).check(input, options) as Promise<{ missing: string[] }>,
              signal,
            )
            if (current !== generation || signal.aborted) return { server, ok: true as const }
            byServer.set(server.id, withDirectoryStatus(load.sessions, server.id, result))
            publish()
          }
          return { server, ok: true as const }
        } catch (error) {
          if (current !== generation || signal.aborted) return { server, ok: true as const }
          return { server, ok: false as const, error }
        }
      }),
    )

    if (current !== generation) return

    const failed = new Map<string, string>()
    for (const outcome of outcomes) {
      if (!outcome.ok) failed.set(outcome.server.id, describeError(outcome.error))
    }
    setServers([
      ...usable.map((server) => ({
        id: server.id,
        name: server.name || server.id,
        status: failed.has(server.id) ? ("error" as const) : ("ready" as const),
        message: failed.get(server.id),
        connected: server.connected,
      })),
      ...blocked.map((server) => ({
        id: server.id,
        name: server.name || server.id,
        status: "incompatible" as const,
        message: ctx.t("state.incompatible"),
        connected: server.connected,
      })),
    ])
    setLoading(false)
    setUpdatedAt(Date.now())
    if (failed.size > 0) setStale(true)
    if (usable.length === 0 && blocked.length === 0) setStale(false)
  }

  const open = () => {
    if (isOpen()) return
    setOpenFlag(true)
    void refresh()
  }

  const close = () => {
    setOpenFlag(false)
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    inFlight?.abort()
    inFlight = undefined
  }

  const setArchived = async (session: ExplorerSession, archived: boolean): Promise<boolean> => {
    const server = ctx.servers.get(session.serverId)
    if (!server) {
      toast("error", ctx.t(archived ? "toast.archiveFailed" : "toast.restoreFailed"), session.serverName)
      return false
    }
    if (archived && session.running === true) {
      toast("error", ctx.t("toast.running"), session.title)
      return false
    }

    try {
      await server.client.session.update({ sessionID: session.sessionId, archived })
      // A server that accepts the call but ignores it must not be reported as
      // success. Read the session back and compare; a failed read is not proof
      // of failure, so only a contradicting answer counts.
      const confirmed = await server.client.session
        .get({ sessionID: session.sessionId })
        .then((info) => (info.time.archived !== undefined) === archived)
        .catch(() => true)
      if (!confirmed) {
        toast("error", ctx.t(archived ? "toast.archiveFailed" : "toast.restoreFailed"), session.title)
        void refresh()
        return false
      }
    } catch (error) {
      toast(
        "error",
        ctx.t(archived ? "toast.archiveFailed" : "toast.restoreFailed"),
        describeError(error),
      )
      return false
    }

    // Only after the SDK confirms: update the row and let the filters and
    // counts follow. A background refresh reconciles anything else.
    setRows((previous) =>
      previous.map((row) =>
        row.key === session.key
          ? { ...row, archivedAt: archived ? Date.now() : undefined, running: archived ? undefined : row.running }
          : row,
      ),
    )
    toast("success", ctx.t(archived ? "toast.archived" : "toast.restored"), session.title)
    scheduleRefresh()
    return true
  }

  const copyId = async (session: ExplorerSession): Promise<void> => {
    try {
      await ctx.system.copy(session.sessionId)
      toast("success", ctx.t("toast.copied"), session.sessionId)
    } catch (error) {
      toast("error", ctx.t("toast.copied"), describeError(error))
    }
  }

  const openSession = async (session: ExplorerSession): Promise<boolean> => {
    if (session.directoryStatus === "missing") {
      const proceed = await ctx.dialogs.confirm({
        title: ctx.t("confirm.missing.title"),
        description: ctx.t("confirm.missing.description", {
          directory: session.directory,
          server: session.serverName,
        }),
        confirm: ctx.t("confirm.missing.confirm"),
        cancel: ctx.t("action.cancel"),
      })
      if (!proceed) return false
    }

    const existing = ctx.tabs
      .list()
      .find(
        (tab) => tab.session?.server.id === session.serverId && tab.session.id === session.sessionId,
      )
    if (existing) ctx.tabs.focus(existing.key)
    else ctx.tabs.open({ server: session.serverId, id: session.sessionId }, { focus: true })
    return true
  }

  const restoreAndOpen = async (session: ExplorerSession): Promise<boolean> => {
    const restored = await setArchived(session, false)
    if (!restored) return false
    return openSession({ ...session, archivedAt: undefined })
  }

  // Re-subscribe when the server list changes; each server's event stream is
  // separate, so a dropped server cannot silence another.
  createKeyed(
    () => ctx.servers.list().slice().sort().join("\u0000"),
    () => {
      const stops: (() => void)[] = []
      for (const id of ctx.servers.list()) {
        const server = ctx.servers.get(id)
        if (!server) continue
        try {
          stops.push(
            server.data.listen((event) => {
              if (REFRESH_EVENTS.has(event.name)) scheduleRefresh()
            }),
          )
        } catch {
          // A server without an event stream simply refreshes when reopened.
        }
      }
      onCleanup(() => {
        for (const stop of stops) stop()
      })
    },
  )

  // A server may appear after the window mounts (cold start). While the dialog
  // is open, reload when that set changes.
  createKeyed(
    () => ctx.servers.list().slice().sort().join("\u0000"),
    () => {
      if (isOpen()) void refresh()
    },
  )

  onCleanup(() => {
    if (timer !== undefined) clearTimeout(timer)
    inFlight?.abort()
    generation++
  })

  return {
    rows,
    servers,
    loading,
    waiting,
    stale,
    updatedAt,
    open,
    close,
    isOpen,
    refresh: () => void refresh(),
    setArchived,
    copyId,
    openSession,
    restoreAndOpen,
    toast,
  }
}

/** Rows for one server, for the future server selector and tests. */
export function sessionsOf(rows: readonly ExplorerSession[], server: ServerRef): ExplorerSession[] {
  return rowsOfServer(rows, server.id)
}

/** The display name of a server, tolerating a missing one. */
export function serverName(server: ServerRef | undefined, fallback: string): string {
  return server?.name || (server ? serverOf(server).name : fallback)
}

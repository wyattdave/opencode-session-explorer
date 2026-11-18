import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { usePlugin, type DialogHandle } from "@opencode/plugin/gui"
import type { definition } from "./definition.js"
import type { ExplorerController } from "./controller.js"
import { resetPreferences, writePreferences } from "./preferences.js"
import { SessionFilters } from "./SessionFilters.js"
import { SessionRow, rowElementId } from "./SessionRow.js"
import {
  archiveCounts,
  ALL_PROJECTS,
  filterSessions,
  groupSessions,
  projectsOf,
  resolvePrefs,
  type ExplorerPrefs,
  type ExplorerSession,
} from "../explorer.js"

/** Rows rendered at once; grows with "Show more" so thousands never mount together. */
const PAGE = 200

export interface SessionExplorerProps {
  readonly dialog: DialogHandle
  readonly controller: ExplorerController
  /** Runs once the dialog content unmounts, however it closed. */
  readonly onClosed: () => void
}

/**
 * The explorer dialog. It renders in the host's `Ui.Dialog` frame and keeps all
 * state local except the metadata index, which lives in the controller.
 */
export function SessionExplorer(props: SessionExplorerProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui

  const [query, setQuery] = createSignal("")
  const [debounced, setDebounced] = createSignal("")
  const [limit, setLimit] = createSignal(PAGE)
  const [activeKey, setActiveKey] = createSignal<string | undefined>(undefined)
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set())

  let queryTimer: ReturnType<typeof setTimeout> | undefined
  createEffect(() => {
    const value = query()
    if (queryTimer !== undefined) clearTimeout(queryTimer)
    queryTimer = setTimeout(() => setDebounced(value), 180)
  })
  onCleanup(() => {
    if (queryTimer !== undefined) clearTimeout(queryTimer)
    props.onClosed()
  })

  const rows = () => props.controller.rows()
  const projects = createMemo(() => projectsOf(rows()))
  const availableProjects = createMemo(() => projects().map((project) => project.key))
  // Until the first page arrives the projects are unknown, so keep the saved
  // selection rather than resetting it to All mid-load.
  const prefs = createMemo(() =>
    resolvePrefs(ctx.stores.prefs.value, rows().length > 0 ? availableProjects() : undefined),
  )
  const filtered = createMemo(() =>
    filterSessions(
      rows(),
      { query: debounced(), project: prefs().project, archive: prefs().archive },
      prefs().sort,
    ),
  )
  const shown = createMemo(() => filtered().slice(0, limit()))
  const allGroups = createMemo(() => groupSessions(filtered(), projects()))
  const groups = createMemo(() => groupSessions(shown(), projects()))
  const counts = createMemo(() => archiveCounts(rows()))
  const multiServer = createMemo(() => new Set(rows().map((row) => row.serverId)).size > 1)

  const failed = createMemo(() => props.controller.servers().filter((server) => server.status === "error"))
  const incompatible = createMemo(() =>
    props.controller.servers().filter((server) => server.status === "incompatible"),
  )
  const disconnected = createMemo(() =>
    props.controller.servers().filter((server) => !server.connected && server.status !== "incompatible"),
  )
  const hasServers = createMemo(() => props.controller.servers().length > 0)
  const hasRows = createMemo(() => rows().length > 0)
  const emptyBecauseError = createMemo(
    () =>
      !props.controller.loading() &&
      !props.controller.waiting() &&
      !hasRows() &&
      (failed().length > 0 || !hasServers()),
  )

  // Reset paging and the active row whenever the query or a filter changes.
  let signature = ""
  createEffect(() => {
    const next = [debounced(), prefs().project, prefs().archive, prefs().sort].join("\u0000")
    if (next === signature) return
    signature = next
    setLimit(PAGE)
    setActiveKey(undefined)
  })

  // Keep a valid active row as results stream in or filters change.
  createEffect(() => {
    const list = filtered()
    const current = activeKey()
    if (list.length === 0) {
      if (current !== undefined) setActiveKey(undefined)
      return
    }
    if (current === undefined || !list.some((row) => row.key === current)) setActiveKey(list[0]!.key)
  })

  // Keep the active row visible as the keyboard moves through the list.
  createEffect(() => {
    const key = activeKey()
    if (key === undefined) return
    document.getElementById(rowElementId(key))?.scrollIntoView({ block: "nearest" })
  })

  let listRef: HTMLDivElement | undefined
  let searchRef: HTMLDivElement | undefined
  const searchInput = () => searchRef?.querySelector("input") ?? undefined

  // The host's dialog mounts into a portal after the opener has focus, so the
  // `autofocus` attribute alone does not reliably move focus into the search
  // field. Focus it explicitly, once the portal has attached. Mounting is also
  // what marks the explorer open, so a discarded render never leaves it stuck.
  onMount(() => {
    props.controller.open()
    const focus = () => {
      const input = searchInput()
      if (input && document.activeElement !== input) input.focus()
    }
    focus()
    queueMicrotask(focus)
    const timer = setTimeout(focus, 60)
    onCleanup(() => clearTimeout(timer))
  })

  const move = (delta: number) => {
    const list = filtered()
    if (list.length === 0) return
    const current = activeKey()
    const index = Math.max(0, list.findIndex((row) => row.key === current))
    const next = Math.min(list.length - 1, Math.max(0, index + delta))
    const row = list[next]
    if (!row) return
    setActiveKey(row.key)
    if (next >= limit()) setLimit(next + PAGE)
  }

  const activeRow = (): ExplorerSession | undefined =>
    filtered().find((row) => row.key === activeKey())

  const closeDialog = () => {
    props.controller.close()
    props.dialog.close()
  }

  const openSession = async (row: ExplorerSession) => {
    const opened = await props.controller.openSession(row)
    if (opened) closeDialog()
  }

  const openActive = () => {
    const row = activeRow()
    if (row) void openSession(row)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    const inSearch = target !== null && searchRef?.contains(target) === true
    const onList = target === listRef

    if (event.key === "Escape") {
      // The dialog frame also closes on Escape; closing here guarantees it even
      // when focus sits inside our search field.
      event.preventDefault()
      closeDialog()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (inSearch) {
        setActiveKey(filtered()[0]?.key)
        listRef?.focus()
      } else {
        move(1)
      }
      return
    }
    if (event.key === "ArrowUp") {
      if (inSearch) return
      event.preventDefault()
      const list = filtered()
      const index = list.findIndex((row) => row.key === activeKey())
      if (index <= 0) searchInput()?.focus()
      else move(-1)
      return
    }
    if (event.key === "Home" && !inSearch) {
      event.preventDefault()
      const first = filtered()[0]
      if (first) setActiveKey(first.key)
      return
    }
    if (event.key === "End" && !inSearch) {
      event.preventDefault()
      const list = filtered()
      const last = list.at(-1)
      if (last) {
        setActiveKey(last.key)
        setLimit(list.length)
      }
      return
    }
    if (event.key === "Enter" && onList) {
      event.preventDefault()
      openActive()
    }
  }

  const updatePrefs = (patch: Partial<ExplorerPrefs>) => {
    writePreferences(ctx, { ...prefs(), ...patch })
  }

  const resetFilters = () => {
    resetPreferences(ctx)
    setQuery("")
  }

  const toggleGroup = (key: string) => {
    const next = new Set(collapsed())
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setCollapsed(next)
  }

  const groupCount = (key: string) => allGroups().find((group) => group.key === key)?.sessions.length ?? 0

  const row = (session: ExplorerSession) => (
    <SessionRow
      session={session}
      active={activeKey() === session.key}
      showServer={multiServer()}
      onActivate={() => setActiveKey(session.key)}
      onOpen={() => void openSession(session)}
      onArchive={(archived) => void props.controller.setArchived(session, archived)}
      onRestoreAndOpen={async () => {
        const opened = await props.controller.restoreAndOpen(session)
        if (opened) closeDialog()
      }}
      onCopyId={() => void props.controller.copyId(session)}
    />
  )

  return (
    <ui.Dialog
      title={ctx.t("titlebar.title")}
      size="x-large"
      footer={
        <div class="se-dialog-footer">
          <div class="se-status" data-tone={failed().length > 0 ? "error" : undefined}>
            <Show when={props.controller.loading()}>
              <ui.Loader size="small" />
              <span>{hasRows() ? ctx.t("state.refreshing") : ctx.t("state.loading")}</span>
            </Show>
            <span>
              {ctx.t("state.showing", { shown: shown().length, total: filtered().length })}
            </span>
            <Show when={props.controller.loading() && hasRows()}>
              <span>{ctx.t("state.partialCounts")}</span>
            </Show>
          </div>
          <Show when={shown().length < filtered().length}>
            <ui.Button size="small" onClick={() => setLimit((value) => value + PAGE)}>
              {ctx.t("state.loadMore")}
            </ui.Button>
          </Show>
        </div>
      }
    >
      <div class="se-root" onKeyDown={onKeyDown}>
        <div class="se-search-row" ref={(element) => (searchRef = element)}>
        <ui.TextInput
          type="search"
          autofocus
          size="large"
          label={ctx.t("search.label")}
          placeholder={ctx.t("search.placeholder")}
          value={query()}
          onInput={setQuery}
          onSubmit={openActive}
        />
      </div>

      <p class="se-sr-only" id="session-explorer-help">
        Search sessions, then use the arrow keys to choose a row and Enter to open it.
      </p>

      <SessionFilters
        projects={projects()}
        prefs={prefs()}
        counts={counts()}
        showCounts={hasRows()}
        loading={props.controller.loading()}
        onChange={updatePrefs}
        onReset={resetFilters}
        onRefresh={props.controller.refresh}
      />

      <Show when={incompatible().length > 0}>
        <div class="se-banner" data-tone="error">
          <ui.Icon name="circle-exclamation" size="small" />
          <span>
            {ctx.t("state.incompatible")} {incompatible().map((server) => server.name).join(", ")}
          </span>
        </div>
      </Show>

      <Show when={failed().length > 0 && hasRows()}>
        <div class="se-banner" data-tone="error">
          <ui.Icon name="circle-exclamation" size="small" />
          <span>
            {ctx.t("state.partial")}: {failed().map((server) => server.name).join(", ")}
          </span>
          <ui.Button size="small" variant="ghost" onClick={props.controller.refresh}>
            {ctx.t("state.retry")}
          </ui.Button>
        </div>
      </Show>

      <Show when={disconnected().length > 0}>
        <div class="se-banner">
          <ui.Icon name="circle-exclamation" size="small" />
          <span>{ctx.t("state.disconnected")}</span>
        </div>
      </Show>

      <Show when={props.controller.stale() && hasRows() && !props.controller.loading()}>
        <div class="se-banner">
          <ui.Icon name="info" size="small" />
          <span>{ctx.t("state.stale")}</span>
          <ui.Button size="small" variant="ghost" onClick={props.controller.refresh}>
            {ctx.t("state.retry")}
          </ui.Button>
        </div>
      </Show>

      <div
        class="se-results"
        ref={(element) => (listRef = element)}
        tabIndex={0}
        role="listbox"
        aria-label={ctx.t("titlebar.title")}
        aria-describedby="session-explorer-help"
        aria-activedescendant={activeKey() === undefined ? undefined : rowElementId(activeKey()!)}
      >
        <Show when={props.controller.waiting()}>
          <div class="se-state">
            <ui.Loader size="large" />
            <span>{ctx.t("state.connecting")}</span>
          </div>
        </Show>

        <Show when={!hasRows() && props.controller.loading()}>
          <div class="se-state">
            <ui.Loader size="large" />
            <span>{ctx.t("state.loading")}</span>
          </div>
        </Show>

        <Show when={emptyBecauseError()}>
          <div class="se-state">
            <ui.Icon name="circle-exclamation" size="large" />
            <strong>{ctx.t("state.error")}</strong>
            <span>{failed().map((server) => `${server.name}: ${server.message ?? ""}`).join(" · ")}</span>
            <div class="se-state-actions">
              <ui.Button size="small" onClick={props.controller.refresh}>
                {ctx.t("state.retry")}
              </ui.Button>
            </div>
          </div>
        </Show>

        <Show when={!hasRows() && !props.controller.loading() && !props.controller.waiting() && !emptyBecauseError()}>
          <div class="se-state">
            <strong>{ctx.t("state.empty")}</strong>
            <span>{ctx.t("state.empty.description")}</span>
          </div>
        </Show>

        <Show when={hasRows() && filtered().length === 0}>
          <div class="se-state">
            <strong>{ctx.t("state.noMatches")}</strong>
            <span>{ctx.t("state.noMatches.description")}</span>
            <div class="se-state-actions">
              <ui.Button size="small" onClick={resetFilters}>
                {ctx.t("filter.reset")}
              </ui.Button>
            </div>
          </div>
        </Show>

        <Show when={filtered().length > 0 && !prefs().group}>
          <div class="se-list">
            <For each={shown()}>{(session) => row(session)}</For>
          </div>
        </Show>

        <Show when={filtered().length > 0 && prefs().group}>
          <div class="se-list">
            <For each={groups()}>
              {(group) => (
                <section>
                  <button
                    type="button"
                    class="se-group-title"
                    aria-expanded={!collapsed().has(group.key)}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <ui.Icon
                      name={collapsed().has(group.key) ? "chevron-right" : "chevron-down"}
                      size="small"
                    />
                    <span>{group.name}</span>
                    <span class="se-group-count">({groupCount(group.key)})</span>
                  </button>
                  <Show when={!collapsed().has(group.key)}>
                    <div>
                      <For each={group.sessions}>{(session) => row(session)}</For>
                    </div>
                  </Show>
                </section>
              )}
            </For>
          </div>
        </Show>
      </div>

      </div>
    </ui.Dialog>
  )
}

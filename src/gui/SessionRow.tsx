import { Show } from "solid-js"
import { usePlugin, type UiMenuEntry } from "@opencode/plugin/gui"
import type { definition } from "./definition.js"
import { relativeTime, type ExplorerSession } from "../explorer.js"

/** One session row: metadata, a primary Open action and a per-row menu. */
export interface SessionRowProps {
  readonly session: ExplorerSession
  readonly active: boolean
  readonly showServer: boolean
  readonly onActivate: () => void
  readonly onOpen: () => void
  readonly onArchive: (archived: boolean) => void
  readonly onRestoreAndOpen: () => void
  readonly onCopyId: () => void
}

/** DOM id for a row, used to keep the keyboard-active row in view. */
export function rowElementId(key: string): string {
  return `session-explorer-row-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`
}

export function SessionRow(props: SessionRowProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const archived = () => props.session.archivedAt !== undefined

  const menuItems = (): UiMenuEntry[] => {
    const items: UiMenuEntry[] = [
      { label: ctx.t("action.open"), icon: "enter", onSelect: props.onOpen },
    ]
    if (archived()) {
      items.push({ label: ctx.t("action.restoreAndOpen"), icon: "archive", onSelect: props.onRestoreAndOpen })
    }
    items.push({ type: "separator" })
    if (archived()) {
      items.push({ label: ctx.t("action.restore"), icon: "arrow-undo-down", onSelect: () => props.onArchive(false) })
    } else {
      items.push({
        label: ctx.t("action.archive"),
        icon: "archive",
        disabled: props.session.running === true,
        onSelect: () => props.onArchive(true),
      })
    }
    items.push({ label: ctx.t("action.copyId"), icon: "copy", onSelect: props.onCopyId })
    return items
  }

  return (
    <div
      id={rowElementId(props.session.key)}
      class="se-row"
      data-active={props.active}
      role="option"
      aria-selected={props.active}
      onMouseEnter={props.onActivate}
      // The row's own click is handled in the capture phase by Solid, before a
      // nested control can stop it. Ignore clicks that started in the actions
      // area so the menu never opens the row.
      onClick={(event) => {
        const target = event.target as HTMLElement | null
        if (target?.closest(".se-row-actions")) return
        props.onOpen()
      }}
    >
      <button type="button" class="se-row-main" tabIndex={-1} title={props.session.directory}>
        <span class="se-title">{props.session.title}</span>
        <span class="se-meta">
          <span class="se-project" title={props.session.projectDirectory}>
            {props.session.projectName}
          </span>
          <Show when={props.showServer}>
            <span>{props.session.serverName}</span>
          </Show>
          <Show when={archived()}>
            <span class="se-badge" data-tone="warning">
              {ctx.t("row.archived")}
            </span>
          </Show>
          <Show when={props.session.running === true}>
            <span class="se-badge" data-tone="running">
              {ctx.t("row.running")}
            </span>
          </Show>
          <Show when={props.session.directoryStatus === "missing"}>
            <span class="se-badge" data-tone="missing" title={props.session.directory}>
              {ctx.t("row.missing")}
            </span>
          </Show>
          <span title={new Date(props.session.updatedAt).toLocaleString()}>
            {ctx.t("row.updated", { time: relativeTime(props.session.updatedAt) })}
          </span>
          <span class="se-sr-only">{props.session.directory}</span>
        </span>
      </button>

      <div class="se-row-actions" onClick={(event) => event.stopPropagation()}>
        <ui.Button size="small" variant="ghost" onClick={props.onOpen}>
          {ctx.t("action.open")}
        </ui.Button>
        <ui.Menu
          label={`${ctx.t("action.more")}: ${props.session.title}`}
          items={menuItems()}
          trigger="icon"
          icon="outline-dots"
          placement="bottom-end"
        />
      </div>
    </div>
  )
}

import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition.js"
import type { ArchiveFilter, ExplorerPrefs, ExplorerProject, SortMode } from "../explorer.js"

/** The filter and sort controls above the results. */
export interface SessionFiltersProps {
  readonly projects: readonly ExplorerProject[]
  readonly prefs: ExplorerPrefs
  readonly counts: { all: number; unarchived: number; archived: number }
  readonly showCounts: boolean
  readonly loading: boolean
  readonly onChange: (patch: Partial<ExplorerPrefs>) => void
  readonly onReset: () => void
  readonly onRefresh: () => void
}

export function SessionFilters(props: SessionFiltersProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui

  const projectOptions = () => [
    { value: "all", label: ctx.t("filter.allProjects") },
    ...props.projects.map((project) => ({
      value: project.key,
      label: props.showCounts ? `${project.name} (${project.count})` : project.name,
    })),
  ]

  const archiveOptions = (): { value: ArchiveFilter; label: string }[] => [
    { value: "all", label: props.showCounts ? `${ctx.t("filter.all")} (${props.counts.all})` : ctx.t("filter.all") },
    {
      value: "unarchived",
      label: props.showCounts
        ? `${ctx.t("filter.unarchived")} (${props.counts.unarchived})`
        : ctx.t("filter.unarchived"),
    },
    {
      value: "archived",
      label: props.showCounts
        ? `${ctx.t("filter.archived")} (${props.counts.archived})`
        : ctx.t("filter.archived"),
    },
  ]

  const sortOptions = (): { value: SortMode; label: string }[] => [
    { value: "updated", label: ctx.t("filter.sort.updated") },
    { value: "created", label: ctx.t("filter.sort.created") },
    { value: "title", label: ctx.t("filter.sort.title") },
  ]

  return (
    <div class="se-controls">
      <div class="se-control">
        <span aria-hidden="true">{ctx.t("filter.project")}</span>
        <ui.Select
          label={ctx.t("filter.project")}
          options={projectOptions()}
          value={props.prefs.project}
          onChange={(project) => props.onChange({ project })}
        />
      </div>

      <div class="se-control">
        <span aria-hidden="true">{ctx.t("filter.archive")}</span>
        <ui.Select
          label={ctx.t("filter.archive")}
          options={archiveOptions()}
          value={props.prefs.archive}
          onChange={(archive) => props.onChange({ archive })}
        />
      </div>

      <div class="se-control">
        <span aria-hidden="true">{ctx.t("filter.sort")}</span>
        <ui.Select
          label={ctx.t("filter.sort")}
          options={sortOptions()}
          value={props.prefs.sort}
          onChange={(sort) => props.onChange({ sort })}
        />
      </div>

      <div class="se-group-toggle">
        <ui.Switch
          label={ctx.t("filter.group")}
          checked={props.prefs.group}
          onChange={(group) => props.onChange({ group })}
        />
      </div>

      <span class="se-spacer" />

      <ui.Button variant="ghost" size="small" onClick={props.onReset}>
        {ctx.t("filter.reset")}
      </ui.Button>

      <ui.Tooltip value={ctx.t("action.refresh")}>
        <ui.IconButton
          icon="refresh"
          label={ctx.t("action.refresh")}
          busy={props.loading}
          onClick={props.onRefresh}
        />
      </ui.Tooltip>
    </div>
  )
}

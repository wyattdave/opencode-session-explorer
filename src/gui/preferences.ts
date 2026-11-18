import type { SetupContext } from "@opencode/plugin/gui"
import { ALL_PROJECTS, DEFAULT_PREFS, resolvePrefs, type ExplorerPrefs } from "../explorer.js"
import type { definition } from "./definition.js"

/** The window context with this plugin's declared stores. */
export type ExplorerContext = SetupContext<typeof definition>

/**
 * Read the stored preferences, falling back to defaults for unknown values.
 * Pass the projects currently available so a project that no longer exists
 * falls back to All, as required after a restart or a project removal.
 */
export function readPreferences(ctx: ExplorerContext, availableProjects?: readonly string[]): ExplorerPrefs {
  return resolvePrefs(ctx.stores.prefs.value, availableProjects)
}

/** Replace the stored UI preferences. Search text is never stored. */
export function writePreferences(ctx: ExplorerContext, prefs: ExplorerPrefs): void {
  ctx.stores.prefs.set({
    project: prefs.project,
    archive: prefs.archive,
    sort: prefs.sort,
    group: prefs.group,
  })
}

/** Reset the persisted filters to their documented defaults. */
export function resetPreferences(ctx: ExplorerContext): void {
  writePreferences(ctx, {
    ...DEFAULT_PREFS,
    project: ALL_PROJECTS,
  })
}

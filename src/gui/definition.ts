import { Schema } from "effect"
import { Plugin, Store } from "@opencode/plugin/gui"

/**
 * The GUI half's declarations. The host reads these before `setup`: it loads
 * the preferences store, and registers the copy and OS support.
 *
 * Only UI preferences are stored. Session metadata stays in memory for the life
 * of the window; transcripts, credentials and caches are never written.
 */
const Preferences = Schema.Struct({
  project: Schema.optional(Schema.String),
  archive: Schema.optional(Schema.String),
  sort: Schema.optional(Schema.String),
  group: Schema.optional(Schema.Boolean),
})

export const definition = Plugin.define({
  stores: {
    // `from` imports the value once from older homes, such as a key left by an
    // earlier build of this plugin.
    prefs: Store.global(Preferences, {}, ["plugin.session-explorer.preferences"]),
  },
  i18n: {
    en: {
      "titlebar.label": "Sessions",
      "titlebar.title": "Session Explorer",
      "command.open": "Session Explorer: Open",
      "command.description": "Browse and reopen sessions across every project",
      "dialog.title": "Session Explorer",
      "dialog.description": "Search every project on the connected servers, including archived sessions.",
      "search.label": "Search sessions",
      "search.placeholder": "Search title, project, directory or ID…",
      "filter.project": "Project",
      "filter.allProjects": "All projects",
      "filter.archive": "Session state",
      "filter.all": "All",
      "filter.unarchived": "Unarchived",
      "filter.archived": "Archived",
      "filter.sort": "Sort by",
      "filter.sort.updated": "Last updated",
      "filter.sort.created": "Created",
      "filter.sort.title": "Title",
      "filter.group": "Group by project",
      "filter.reset": "Reset filters",
      "action.refresh": "Refresh",
      "action.cancel": "Cancel",
      "action.open": "Open",
      "action.more": "More actions",
      "action.archive": "Archive",
      "action.restore": "Restore",
      "action.restoreAndOpen": "Restore and open",
      "action.copyId": "Copy session ID",
      "row.archived": "Archived",
      "row.running": "Running",
      "row.missing": "Directory missing",
      "row.untitled": "Untitled session",
      "row.updated": "Updated {{time}}",
      "state.loading": "Loading sessions…",
      "state.connecting": "Connecting to the local server…",
      "state.refreshing": "Refreshing…",
      "state.empty": "No sessions yet",
      "state.empty.description": "Sessions appear here once this server has one.",
      "state.noMatches": "No sessions match these filters",
      "state.noMatches.description": "Try a different search or reset the filters.",
      "state.error": "Could not load sessions",
      "state.partial": "Some servers could not be reached",
      "state.incompatible": "This server's version is not compatible with this app.",
      "state.disconnected": "The event connection to this server is down; results may be stale.",
      "state.stale": "Showing cached results; refresh to update.",
      "state.retry": "Try again",
      "state.showing": "Showing {{shown}} of {{total}} sessions",
      "state.loadMore": "Show more",
      "state.partialCounts": "Counts are partial while sessions load.",
      "toast.copied": "Session ID copied",
      "toast.archived": "Session archived",
      "toast.restored": "Session restored",
      "toast.archiveFailed": "Could not archive the session",
      "toast.restoreFailed": "Could not restore the session",
      "toast.running": "This session is running; stop it before archiving.",
      "confirm.missing.title": "Session directory is missing",
      "confirm.missing.description": "{{directory}} no longer exists on {{server}}. Open the session anyway?",
      "confirm.missing.confirm": "Open anyway",
      "confirm.restore.title": "Restore archived session",
      "confirm.restore.description": "Restore “{{title}}” and open it?",
      "confirm.restore.confirm": "Restore and open",
      "group.count": "{{count}}",
    },
  },
})

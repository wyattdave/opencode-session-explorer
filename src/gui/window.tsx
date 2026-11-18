import { Command, Style, TitlebarItem, type DialogHandle, type Plugin } from "@opencode/plugin/gui"
import type { definition } from "./definition.js"
import { createExplorerController } from "./controller.js"
import { SessionExplorer } from "./SessionExplorer.js"
import { explorerStyles } from "./styles.js"

/**
 * The window setup.
 *
 * The controller is built once, at plugin start, so the metadata index and
 * preferences survive closing the dialog. Both launch points (the titlebar pill
 * and the command) call the same `openDialog`, which refuses to open a second
 * copy while one is showing.
 */
export const setup: Plugin.Setup<typeof definition> = (ctx) => {
  const controller = createExplorerController(ctx)
  let handle: DialogHandle | undefined
  let showing = false

  const openDialog = () => {
    // `showing` is the only guard, and it is ours rather than
    // `ctx.dialogs.active()`: the host keeps reporting an active dialog through
    // its closing animation, so consulting it made Escape-then-reopen (or a
    // click right after closing) silently do nothing.
    if (showing) return
    showing = true
    handle = ctx.dialogs.open((dialog) => (
      <SessionExplorer
        dialog={dialog}
        controller={controller}
        onClosed={() => {
          showing = false
          handle = undefined
          controller.close()
        }}
      />
    ))
    // If the host discards the content (it closes on a render error) and never
    // reports it closed, let the next activation try again instead of staying
    // stuck forever. Content that mounted marks the controller open, so this
    // does not re-arm while the dialog is showing.
    setTimeout(() => {
      if (!controller.isOpen()) showing = false
    }, 750)
  }

  ctx.add(Style, explorerStyles)

  // Read labels inside the function so they follow the interface language.
  ctx.add(Command, (): Command => ({
    id: "open",
    title: ctx.t("command.open"),
    description: ctx.t("command.description"),
    keywords: "session history archive browse reopen",
    group: ctx.t("titlebar.title"),
    section: "navigation",
    bind: "mod+shift+h",
    featured: true,
    run: openDialog,
  }))

  ctx.add(TitlebarItem, (): TitlebarItem => ({
    id: "open",
    label: ctx.t("titlebar.label"),
    title: ctx.t("titlebar.title"),
    icon: "outline-list-changelog",
    run: openDialog,
  }))

  return () => {
    handle?.close()
    controller.close()
  }
}

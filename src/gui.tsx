import { Plugin } from "@opencode/plugin/gui"
import { definition } from "./gui/definition.js"
import { setup } from "./gui/window.js"

/**
 * The Desktop GUI half, loaded from `./gui-experimental`.
 *
 * The host assigns this plugin its server part's id (`session-explorer`), so
 * the commands (`session-explorer.open`) and the titlebar pill share one
 * namespace with the server and TUI entries. No id is declared here.
 */
export default Plugin.define({ ...definition, setup })

// ----- FreeShow -----
// Svelte app entry point

import { mount } from "svelte"
import App from "./App.svelte"
import "./app.css"
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import { setupTauriApi } from "./IPC/tauri"
import { initMenuActions } from "./utils/shortcuts"

// set up the Tauri IPC bridge (replaces the Electron preload's window.api)
setupTauriApi()
initMenuActions()

const app = mount(App, { target: document.body })

export default app

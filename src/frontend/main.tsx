// ----- FreeShow -----
// React app entry point (F24.23)

import { createRoot } from "react-dom/client"
import { App } from "./react/App"
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import { setupTauriApi } from "./IPC/tauri"
import { initMenuActions } from "./utils/shortcuts"
import { activePopup } from "./stores"

// set up the Tauri IPC bridge (replaces the Electron preload's window.api)
setupTauriApi()
initMenuActions()

// solo en desarrollo: abrir kit_demo / kit_demo_react desde la consola al comparar el kit (F24.10)
if (import.meta.env.DEV) (window as unknown as { activePopup: typeof activePopup }).activePopup = activePopup

const rootElement = document.getElementById("root")
if (!rootElement) throw new Error("Root element #root not found")

createRoot(rootElement).render(<App />)

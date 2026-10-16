// ----- FreeShow -----
// Svelte app entry point

import * as Sentry from "@sentry/browser"
import { mount } from "svelte"
import App from "./App.svelte"
import "./app.css"
import { setupTauriApi } from "./IPC/tauri"
import { ERROR_FILTER } from "./utils/common"

// set up the Tauri IPC bridge (replaces the Electron preload's window.api)
setupTauriApi()

// error reporting (production only)
// if autoErrorReporting is false, electron reporting will not start and this will fail with an error which is expected
if (import.meta.env.PROD) {
    Sentry.init({
        dsn: "https://5d1069c3cb6faaa6e7ad0d9dc0145361@o4510419080445952.ingest.us.sentry.io/4510419082346496",
        beforeSend(event) {
            // filter out known non-critical errors
            const errorMessage = event.exception?.values?.[0]?.value || ""
            const shouldFilter = ERROR_FILTER.some((filter) => errorMessage.includes(filter))
            return shouldFilter ? null : event
        }
    })
}

const app = mount(App, { target: document.body })

export default app

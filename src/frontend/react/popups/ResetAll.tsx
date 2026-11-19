import { sendMain } from "../../shared/core/ipc/main"
import type { SaveData } from "../../../types/Save"
import { Main } from "../../../types/IPC/Main"
import { clearAll } from "../../components/output/clear"
import { activeEdit, activePage, activePopup, activeShow, deletedShows, renamedShows, scripturesCache } from "../../shared/core/stores"
import { save } from "../../utils/save"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"

// Port de components/main/popups/ResetAll.svelte. No lee stores: al confirmar hace backup y, 1 s después,
// escribe un Main.SAVE que vacía todos los stores de configuración y datos.
// Escribe: clearAll, scripturesCache = {}, deletedShows = [], renamedShows = [], activeShow = null,
// activeEdit = { items: [] }, activePage = "show" y activePopup = "initialize".
export function ResetAll() {
    function resetSettings() {
        sendMain(Main.SAVE, {
            // SETTINGS
            SETTINGS: {},
            SYNCED_SETTINGS: {},
            // SHOWS
            SHOWS: {},
            STAGE: {},
            // STORES
            PROJECTS: { projects: {}, folders: {}, projectTemplates: {} },
            OVERLAYS: {},
            TEMPLATES: {},
            EVENTS: {},
            MEDIA: {},
            THEMES: {},
            DRIVE_API_KEY: {},
            CACHE: { media: {}, text: {} },
            HISTORY: { undo: [], redo: [] },
            USAGE: { all: [] },
            // SAVE DATA
            closeWhenFinished: false,
            customTriggers: { reset: true }
        } as SaveData)

        clearAll()

        scripturesCache.set({})
        deletedShows.set([])
        renamedShows.set([])

        activeShow.set(null)
        activeEdit.set({ items: [] })

        activePage.set("show")
        activePopup.set("initialize")
    }

    function reset() {
        save(false, { backup: true, isAutoBackup: true })
        setTimeout(resetSettings, 1000)
    }

    return (
        <>
            <p>
                <T id="popup.reset_all_confirm" />
            </p>
            <p style={{ fontSize: "0.9em", opacity: 0.7 }}>
                <T id="popup.reset_all_action" />
            </p>

            <Button variant="outline" className="red" style={{ marginTop: "20px" }} icon="close" onClick={reset} white red>
                <T id="popup.continue" />
            </Button>
        </>
    )
}

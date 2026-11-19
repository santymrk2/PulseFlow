import { useState } from "react"
import { Main } from "../../../types/IPC/Main"
import { fetchAndImportIcs } from "../drawer/logic/calendar/calendars"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, alertMessage } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { translateText } from "../../shared/utils/language"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"
import { ChoiceGrid } from "../../shared/ui/kit/choice-grid/ChoiceGrid"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import styles from "./ImportCalendar.module.css"

// Port de components/main/popups/ImportCalendar.svelte. Sin lectura de stores de datos.
// Local: sendMain(Main.IMPORT, { channel: "calendar", format: { name: "Calendar", extensions: ["ics"] } }) y activePopup = null.
// URL: fetchAndImportIcs(url) (la URL sin recortar, sólo el chequeo usa trim); éxito -> alertMessage = "actions.imported" y activePopup = "alert";
// error -> toast "error.import" (+ ": motivo" si devuelve texto) y el popup sigue abierto. Cerrar no escribe nada.
export function ImportCalendar() {
    const [importType, setImportType] = useState("")
    const [url, setUrl] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const importTypes = [
        { id: "url", name: translateText("inputs.url"), icon: "web" },
        { id: "local", name: translateText("cloud.local"), icon: "folder" }
    ]

    async function handleUrlImport() {
        if (!url.trim() || isSubmitting) return
        setIsSubmitting(true)

        const success = await fetchAndImportIcs(url)
        setIsSubmitting(false)

        if (success !== true) {
            let msg = "error.import"
            if (typeof success === "string") msg += ": " + success
            newToast(msg)
            return
        }

        alertMessage.set("actions.imported")
        activePopup.set("alert")
    }

    function handleLocalImport() {
        sendMain(Main.IMPORT, { channel: "calendar", format: { name: "Calendar", extensions: ["ics"] } })
        activePopup.set(null)
    }

    return (
        <>
            {importType ? <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setImportType("")} /> : null}

            {importType === "url" ? (
                <div className={styles.urlImport}>
                    <TextField label="inputs.url (.ics)" value={url} onInput={(value) => setUrl(value ?? "")} autofocus />
                    <Button variant="default" icon="import" style={{ marginTop: "20px", width: "100%" }} disabled={!url.trim() || isSubmitting} onClick={handleUrlImport}>
                        <T id="actions.import" />
                    </Button>
                </div>
            ) : importType === "local" ? (
                <>
                    <p style={{ fontSize: "1.1em" }}>
                        <T id="scripture.supported_formats" />
                    </p>
                    <ul style={{ listStyle: "inside", marginTop: "10px" }}>
                        <li>
                            <span style={{ fontSize: "0.9em", fontWeight: "bold" }}>iCalendar</span>
                            <span style={{ fontSize: "0.8em", opacity: 0.8, marginLeft: "10px" }}>.ics</span>
                        </li>
                    </ul>

                    <Button variant="outline" icon="import" onClick={handleLocalImport} style={{ marginTop: "25px", width: "100%" }}>
                        <T id="actions.import" />
                    </Button>
                </>
            ) : (
                <ChoiceGrid options={importTypes} onClick={setImportType} />
            )}
        </>
    )
}

import { useEffect } from "react"
import { get } from "../../shared/core/lib/store"
import { Main } from "../../../types/IPC/Main"
import { requestMain, sendMain } from "../../shared/core/ipc/main"
import { activePopup, dataPath, dictionary, guideActive, language, popupData, timeFormat } from "../../shared/core/stores"
import { createData } from "../../app/wiring/createData"
import { getLanguageList, setLanguage, translateText } from "../../shared/utils/language"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { FolderField } from "../ui/folder-field/FolderField"
import { HRule } from "../ui/h-rule/HRule"
import { InputRow } from "../ui/input-row/InputRow"
import { SelectField } from "../ui/select-field/SelectField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./Initialize.module.css"

// Port de components/main/popups/Initialize.svelte (popup de primer arranque). Lee dataPath, dictionary, language, timeFormat. Escribe: timeFormat (12 si el
// idioma del navegador usa 12 horas; el reloj de 24 h), language (setLanguage), dataPath (+ Main.UPDATE_DATA_PATH { newPath, oldPath }), y en "empezar"
// Main.GET_PATHS → createData, Main.REFRESH_SHOWS, guideActive = true, activePopup = null; "restaurar": popupData = { back: "initialize" } y activePopup = "restore".
// No se puede cerrar con Esc / clic afuera / ✕: lo decide el marco Svelte con `disablePopupClose` (utils/shortcuts.ts), no este componente.
// Los `null` de SelectField se pasan como "" sólo por el tipo (sin defaultValue el reset no existe, es inalcanzable).
export function Initialize() {
    const dict = useStore(dictionary)
    const dataPathValue = useStore(dataPath)
    const languageValue = useStore(language)
    const timeFormatValue = useStore(timeFormat)

    useEffect(() => {
        if (!get(dataPath)) sendMain(Main.DATA_PATH)

        // check time format (based on browser language)
        const use12Hour = Intl.DateTimeFormat(navigator.language, { hour: "numeric" }).resolvedOptions().hour12
        if (use12Hour === true) timeFormat.set("12")
    }, [])

    function create() {
        requestMain(Main.GET_PATHS, undefined, (paths) => (paths ? createData(paths) : null))

        sendMain(Main.REFRESH_SHOWS)

        guideActive.set(true)
        activePopup.set(null)
    }

    function restore() {
        popupData.set({ back: "initialize" })
        activePopup.set("restore")
    }

    const languageText = translateText("settings.language", dict)
    const languageLabel = `${languageText}${languageText === "Language" ? "" : "/Language"}`

    // same as Files.svelte
    function updateDataPath(newPath: string) {
        sendMain(Main.UPDATE_DATA_PATH, { newPath, oldPath: dataPathValue })
        dataPath.set(newPath)
    }

    return (
        <>
            <Button style={{ insetInlineEnd: 0 }} className="popup-options" icon="import" iconSize={1.3} title="setup.restore_data" onClick={restore} white />

            <div className={styles.main}>
                <p>
                    <T id="setup.good_luck" />
                </p>
                <p style={{ opacity: 0.8 }}>
                    <T id="setup.tips" />
                </p>

                <HRule />

                <p style={{ marginBottom: "10px", fontStyle: "italic", fontSize: "0.8em", opacity: 0.5 }}>
                    <T id="setup.change_later" />:
                </p>

                <InputRow>
                    <SelectField style={{ width: "50%" }} label={languageLabel} value={languageValue} options={getLanguageList()} onChange={(value) => setLanguage(value ?? "")} flags />
                    <ToggleField style={{ width: "50%" }} label="settings.use24hClock" checked={timeFormatValue === "24"} onChange={(checked) => timeFormat.set(checked ? "24" : "12")} />
                </InputRow>

                <FolderField PICK_ID="DATA_SHOWS" label={translateText("settings.data_location", dict)} value={dataPathValue} onChange={updateDataPath} openButton={false} />

                <Button variant="outline" className="start" style={{ fontSize: "1.8em", padding: "15px", marginTop: "20px" }} onClick={create} white>
                    <Icon id="check" size={2.5} />
                    <T id="setup.get_started" />
                </Button>
            </div>
        </>
    )
}

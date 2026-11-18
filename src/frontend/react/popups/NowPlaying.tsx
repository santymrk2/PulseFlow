import { useState } from "react"
import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../IPC/main"
import { special } from "../../stores"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { TextareaField } from "../ui/textarea-field/TextareaField"
import styles from "./NowPlaying.module.css"

// Port de components/main/popups/NowPlaying.svelte. Lee special.nowPlayingFormat al montar y escribe special.nowPlayingFormat al cambiar el texto
// o al insertar un valor en el caret. Abre el archivo con sendMain(Main.OPEN_NOW_PLAYING).
// Las etiquetas de dynamicValues son texto fijo en el Svelte (no claves de traducción): se conservan tal cual.
const DYNAMIC_VALUES = {
    artist: { label: "Artist name" },
    title: { label: "Track title" },
    album: { label: "Album name" },
    year: { label: "Release year" },

    artwork_path: { label: "File path to artwork PNG image" },
    artwork_base64: { label: "Artwork in base64 data" },

    duration: { label: "Duration in MM:SS" },
    duration_s: { label: "Duration in seconds" }
} as const

const DEFAULT_FORMAT = `{artist} - {title} - {album}`

export function NowPlaying() {
    const [format, setFormat] = useState<string>(() => get(special).nowPlayingFormat ?? DEFAULT_FORMAT)

    function openFile() {
        sendMain(Main.OPEN_NOW_PLAYING)
    }

    function updateSpecial(key: string, value: string) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    function addValueAtCaret(value: string) {
        const textarea = document.querySelector("textarea")
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = textarea.value

        textarea.value = text.substring(0, start) + value + text.substring(end)
        setFormat(textarea.value)

        // mover el caret
        const caretPos = start + value.length
        textarea.selectionStart = caretPos
        textarea.selectionEnd = caretPos

        // disparar el cambio
        updateSpecial("nowPlayingFormat", textarea.value)
    }

    return (
        <>
            <Button className="popup-options" icon="launch" iconSize={1.1} title="main.system_open" onClick={openFile} white />

            <InputRow
                arrow
                open
                menu={
                    <div className={styles.values}>
                        {Object.entries(DYNAMIC_VALUES).map(([key, data]) => (
                            <div className={styles.value} key={key}>
                                <span>{data.label}</span>
                                <span style={{ opacity: 0.6, cursor: "pointer" }} role="none" onClick={() => addValueAtCaret(`{${key}}`)}>
                                    {`{${key}}`}
                                </span>
                            </div>
                        ))}
                    </div>
                }
            >
                <div className={styles.title}>
                    <T id="popup.dynamic_values" />
                </div>
            </InputRow>

            <div style={{ height: "20px" }} />

            <TextareaField label="NowPlaying.txt" value={format} rows={8} onChange={(value) => updateSpecial("nowPlayingFormat", value ?? "")} />
        </>
    )
}

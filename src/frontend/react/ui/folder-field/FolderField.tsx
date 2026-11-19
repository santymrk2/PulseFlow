import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { uid } from "uid"
import { Main } from "../../../../types/IPC/Main"
import { ToMain } from "../../../../types/IPC/ToMain"
import { cn } from "../../../shared/core/lib/utils"
import { destroyMain, receiveToMain, sendMain } from "../../../shared/core/ipc/main"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { Button } from "../button/Button"
import styles from "./FolderField.module.css"

// dispatch("change", string) → onChange(string) (la ruta elegida, o "" al borrar).
// Mismas llamadas IPC: sendMain(OPEN_FOLDER, { channel: PICK_ID, title, path }), sendMain(OPEN_FOLDER_PATH, value) y la escucha de OPEN_FOLDER2.
// El aviso de Linux ("el diálogo puede quedar detrás de la ventana") no se porta: AGENTS.md prohíbe código específico de Linux y la app no corre allí.
export interface FolderFieldProps {
    label: string
    value: string | undefined
    PICK_ID?: string
    disabled?: boolean
    allowEmpty?: boolean
    openButton?: boolean
    onChange?: (value: string) => void
}

export function FolderField({ label, value, PICK_ID, disabled = false, allowEmpty = false, openButton = true, onChange }: FolderFieldProps) {
    const [defaultPickId] = useState(uid) // el default de `export let PICK_ID = uid()`
    const pickId = PICK_ID ?? defaultPickId

    // El listener se registra al montar (en el Svelte, al crear el componente) y lee siempre lo último
    const latest = useRef({ pickId, onChange })
    useEffect(() => {
        latest.current = { pickId, onChange }
    })
    useEffect(() => {
        const listenerId = receiveToMain(ToMain.OPEN_FOLDER2, (data) => {
            if (data.channel !== latest.current.pickId || !data.path) return
            latest.current.onChange?.(data.path)
        })
        return () => destroyMain(listenerId)
    }, [])

    function pickFolder() {
        if (disabled) return

        sendMain(Main.OPEN_FOLDER, { channel: pickId, title: translateText(label), path: value })
    }

    // SELECT

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (disabled) return

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            pickFolder()
        }
    }

    function handleClick(event: MouseEvent<HTMLDivElement>) {
        if ((event.target as Element).closest(".button")) return
        pickFolder()
    }

    return (
        <div className={cn("textfield", styles.textfield, disabled && styles.disabled)} data-title={value || translateText("inputs.change_folder")}>
            <div className={styles.background} />

            <div className={cn("input", "edit", styles.input, styles.buttonTrigger)} role="button" tabIndex={disabled ? undefined : 0} onClick={handleClick} onKeyDown={handleKeyDown}>
                <span className={styles.selectedText}>{value?.includes("Documents") ? value.slice(value.indexOf("Documents")) : value}</span>

                <svg className={styles.arrow} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h24v24H0z" fill="none" />
                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
            </div>

            <label className={cn(styles.label, value && styles.selected)} dangerouslySetInnerHTML={{ __html: translateText(label) }} />
            <span className={styles.underline} />

            {openButton && value ? (
                <div className={cn("button", styles.button)}>
                    <Button onClick={() => sendMain(Main.OPEN_FOLDER_PATH, value)} title="main.system_open" white>
                        <Icon id="launch" white />
                    </Button>
                </div>
            ) : null}
            {allowEmpty && value ? (
                <div className={cn("button", "remove", styles.button, styles.remove)}>
                    <Button onClick={() => onChange?.("")} title="clear.general" white>
                        <Icon id="close" white />
                    </Button>
                </div>
            ) : null}
        </div>
    )
}

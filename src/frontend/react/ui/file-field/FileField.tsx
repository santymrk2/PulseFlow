import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react"
import { uid } from "uid"
import { Main } from "../../../../types/IPC/Main"
import { ToMain } from "../../../../types/IPC/ToMain"
import { cn } from "../../../shared/core/lib/utils"
import { getFileName } from "../../../components/helpers/media"
import { destroyMain, receiveToMain, sendMain } from "../../../shared/core/ipc/main"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { Button } from "../button/Button"
import styles from "./FileField.module.css"

// dispatch("change", string | string[]) → onChange (la lista si `multiple`, si no el primer archivo; "" al borrar).
// Mismas llamadas IPC: sendMain(OPEN_FILE, { channel: "MEDIA", id: PICK_ID, filter, multiple }) y la escucha de OPEN_FILE2.
export interface FileFieldProps {
    label: string
    value: string | undefined
    title?: string
    filter: { name: string; extensions: string[] }
    icon?: string
    multiple?: boolean
    disabled?: boolean
    autoTrigger?: boolean
    noLabel?: boolean
    showThumbnail?: boolean
    allowEmpty?: boolean
    style?: CSSProperties
    onChange?: (value: string | string[]) => void
}

export function FileField({ label, value, title = "", filter, icon = "", multiple = false, disabled = false, autoTrigger = false, noLabel = false, showThumbnail = false, allowEmpty = false, style, onChange }: FileFieldProps) {
    const [pickId] = useState(uid) // `const PICK_ID = uid()`

    // El listener se registra al montar (en el Svelte, al crear el componente) y lee siempre lo último
    const latest = useRef({ multiple, onChange })
    useEffect(() => {
        latest.current = { multiple, onChange }
    })
    useEffect(() => {
        const listenerId = receiveToMain(ToMain.OPEN_FILE2, (data) => {
            if (data.id !== pickId || data.channel !== "MEDIA" || !data.files?.length) return

            latest.current.onChange?.(latest.current.multiple ? data.files : data.files[0])
        })
        return () => destroyMain(listenerId)
    }, [])

    useEffect(() => {
        if (autoTrigger && !value) pickMedia()
    }, [])

    function pickMedia() {
        if (disabled) return

        // filter: { name: "Text file", extensions: ["txt"], id: "txt" }
        sendMain(Main.OPEN_FILE, { channel: "MEDIA", id: pickId, filter, multiple })
    }

    // SELECT

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (disabled) return

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            pickMedia()
        }
    }

    function handleClick(event: MouseEvent<HTMLDivElement>) {
        if ((event.target as Element).closest(".remove")) return
        pickMedia()
    }

    const thumbnail = showThumbnail && value

    return (
        <div className={cn("textfield", styles.textfield, disabled && styles.disabled)} style={style} data-title={value || translateText(title || "edit.choose_media")}>
            <div className={styles.background} />

            <div className={cn("input", "edit", styles.input, styles.buttonTrigger)} role="button" tabIndex={disabled ? undefined : 0} onClick={handleClick} onKeyDown={handleKeyDown}>
                <span className={styles.selectedText}>{!noLabel ? (typeof value === "string" && value.startsWith("data:") ? "Embeded data" : value ? getFileName(value) : null) : null}</span>

                <div className={styles.arrow} style={thumbnail ? { height: "40px" } : undefined}>
                    {thumbnail ? (
                        <img src={value} alt="thumbnail" className={styles.thumbnail} draggable={false} />
                    ) : icon ? (
                        <Icon id={icon} white />
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            {multiple ? (
                                <>
                                    <path d="M0 0h24v24H0z" fill="none" />
                                    <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z" />
                                </>
                            ) : (
                                <>
                                    <path d="M0 0h24v24H0z" fill="none" />
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                                </>
                            )}
                        </svg>
                    )}
                </div>
            </div>

            {!noLabel ? <label className={cn(styles.label, value && styles.selected)} dangerouslySetInnerHTML={{ __html: translateText(label) }} /> : null}
            <span className={styles.underline} />

            {allowEmpty && value ? (
                <div className={cn("remove", styles.remove)} style={thumbnail ? { right: "56px" } : undefined}>
                    <Button onClick={() => onChange?.("")} title="clear.general" white>
                        <Icon id="close" white />
                    </Button>
                </div>
            ) : null}
        </div>
    )
}

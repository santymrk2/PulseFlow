import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { Main } from "../../../types/IPC/Main"
import { ToMain } from "../../../types/IPC/ToMain"
import { destroyMain, receiveToMain, sendMain } from "../../shared/core/ipc/main"
import { Button } from "../ui/button/Button"

export interface MediaPickerProps {
    id: string
    filter?: unknown
    title?: string
    multiple?: boolean
    clearOnClick?: boolean
    center?: boolean
    style?: CSSProperties
    children?: ReactNode
    slotHost?: HTMLElement | null
    onPicked?: (files: string | string[]) => void
}

// (F24.20a). `dispatch("picked")` → onPicked; `<slot />` → children.
export function MediaPicker({ id, filter, title = "", multiple = false, clearOnClick = false, center = true, style, children, slotHost, onPicked }: MediaPickerProps) {
    const slotRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        const host = slotRef.current
        if (!host || !slotHost) return
        host.appendChild(slotHost)
        return () => {
            if (slotHost.parentNode === host) host.removeChild(slotHost)
        }
    }, [slotHost])

    useEffect(() => {
        const listenerId = receiveToMain(ToMain.OPEN_FILE2, (data) => {
            if (data.id !== id || data.channel !== "MEDIA" || !data.files?.length) return
            onPicked?.(multiple ? data.files : data.files[0])
        })
        return () => destroyMain(listenerId)
    }, [id, multiple, onPicked])

    function pick() {
        if (clearOnClick) {
            onPicked?.("")
            return
        }

        // filter: { name: "Text file", extensions: ["txt"], id: "txt" }
        sendMain(Main.OPEN_FILE, { channel: "MEDIA", id, filter, multiple })
    }

    return (
        <Button align={center ? "center" : "start"} title={title} style={style} onClick={pick} bold={!title}>
            <span ref={slotRef} style={{ display: "contents" }}>
                {children}
            </span>
        </Button>
    )
}

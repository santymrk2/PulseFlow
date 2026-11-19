import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from "react"
import { get } from "../../core/lib/store"
import { cn } from "../../core/lib/utils"
import { type DropAreas, ondrop, validateDrop } from "../../utils/helpers/drop"
import { deselect } from "../../utils/helpers/select"
import { selected } from "../../core/stores"
import { mediaExtensions } from "../../core/values/extensions"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import styles from "./DropArea.module.css"

// Port de components/system/DropArea.svelte. `<slot {fileOver} />` → children como nodo o como función que recibe fileOver.
// `ondrop` recibe el evento NATIVO (en Svelte era el del DOM) y los mismos argumentos que antes: dropActions[id] se invoca igual.
// `<svelte:window on:click on:dragend on:dragstart>` → listeners de window con limpieza.
export interface DropAreaProps {
    id: DropAreas
    selectChildren?: boolean
    hoverTimeout?: number
    file?: boolean
    children?: ReactNode | ((fileOver: boolean) => ReactNode)
}

function getFiles(e: DragEvent): File[] {
    const files: File[] = []
    const transfer = e.dataTransfer
    if (!transfer) return files

    // DataTransferItemList interface
    if (transfer.items) {
        for (let i = 0; i < transfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (transfer.items[i].kind === "file") {
                const file = transfer.items[i].getAsFile()
                if (file) files.push(file)
            }
        }

        return files
    }

    // DataTransfer interface
    for (let i = 0; i < transfer.files.length; i++) {
        files.push(transfer.files[i])
    }

    return files
}

function isValidUrl(string: string): boolean {
    try {
        const url = new URL(string)
        return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:"
    } catch {
        return false
    }
}

function getUrls(e: DragEvent): string[] {
    const urls: string[] = []

    // try to get any URL data
    const urlData = e.dataTransfer?.getData("text/uri-list") || e.dataTransfer?.getData("text/plain")
    if (!urlData) return []

    const lines = urlData.split("\n")
    for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith("#") && isValidUrl(trimmed)) urls.push(trimmed)
    }

    return urls
}

function isMediaUrl(string: string): boolean {
    try {
        const url = new URL(string)
        const pathname = url.pathname || ""
        const m = pathname.match(/\.([a-z0-9]{2,5})(?:$|\?)/i)
        if (!m) return false
        const ext = m[1].toLowerCase()
        return mediaExtensions.includes(ext)
    } catch {
        return false
    }
}

function getNameFromUrl(string: string): string {
    try {
        const url = new URL(string)
        const parts = url.pathname.split("/")
        const name = parts.pop() || string
        return decodeURIComponent(name)
    } catch {
        return string
    }
}

function isWebMediaFile(file: File): boolean {
    const isMediaFile = file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")
    if (!isMediaFile) return false

    // check if media is a local file
    let localPath = ""
    try {
        localPath = (file as File & { path?: string }).path || (window as Window & { api?: { showFilePath?: (f: File) => string } }).api?.showFilePath?.(file) || ""
    } catch {}

    return !localPath
}

function fileToBase64(file: File): Promise<{ name: string; path: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ name: file.name, path: reader.result as string })
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export function DropArea({ id, selectChildren = false, hoverTimeout = 500, file = false, children }: DropAreaProps) {
    const currentSelected = useStore(selected)
    const [hover, setHover] = useState(false)
    const [fileOver, setFileOver] = useState(false)
    const count = useRef(0)

    // $: active = validateDrop(id, $selected.id)
    const active = Boolean(validateDrop(id, currentSelected.id))

    function enter() {
        if (!active || !selectChildren) return

        count.current++
        setTimeout(() => {
            if (count.current > 0) setHover(false)
        }, hoverTimeout)
    }

    function leave() {
        if (!active || !selectChildren) return

        count.current = Math.max(0, count.current - 1)
        setTimeout(() => {
            if (count.current === 0) setHover(true)
        }, 10)
    }

    async function dropEvent(event: ReactDragEvent) {
        event.preventDefault()
        const e = event.nativeEvent
        const files = getFiles(e)
        if (files.length) {
            const webMediaFiles = files.filter((f) => isWebMediaFile(f))
            if (webMediaFiles.length) {
                // convert web media files to base64
                const mediaData = await Promise.all(webMediaFiles.map((f) => fileToBase64(f)))
                selected.set({ id: "media", data: mediaData })
                ondrop(e, id)
                return
            }

            // Regular local files
            selected.set({ id: "files", data: files })
            ondrop(e, id)
            return
        }

        const urls = getUrls(e)
        if (urls.length) {
            const mediaUrls = urls.filter((u) => isMediaUrl(u))
            if (mediaUrls.length) {
                const mediaData = mediaUrls.map((u) => ({ name: getNameFromUrl(u), path: u }))
                selected.set({ id: "media", data: mediaData })
                ondrop(e, id)
                return
            }

            selected.set({ id: "urls", data: urls })
            ondrop(e, id)
            return
        }

        setFileOver(false)
        setHover(false)
        const sel = get(selected)
        console.log(sel.id, "=>", id)

        if (validateDrop(id, sel.id, true)) ondrop(e, id)
    }

    function dragOver(event: ReactDragEvent) {
        event.preventDefault()
        if (file && event.dataTransfer?.items[0]?.kind === "file") setFileOver(true)
    }

    // TOUCH SCREEN
    function onTouchStart() {
        setHover(true)
    }

    function onTouchEnd(e: ReactTouchEvent) {
        if (hover && active) {
            // simulate a drop event
            ondrop(e.nativeEvent, id)
        }
        setHover(false)
    }

    useEffect(() => {
        const onClick = () => setHover(false)
        const onDragEnd = () => {
            deselect()
            setHover(false)
        }
        const onDragStart = () => setHover(active)
        window.addEventListener("click", onClick)
        window.addEventListener("dragend", onDragEnd)
        window.addEventListener("dragstart", onDragStart)
        return () => {
            window.removeEventListener("click", onClick)
            window.removeEventListener("dragend", onDragEnd)
            window.removeEventListener("dragstart", onDragStart)
        }
    }, [active])

    return (
        <>
            <div className={cn(styles.droparea, "droparea", hover && styles.hover)} onDrop={(e) => void dropEvent(e)} onDragOver={dragOver} onDragEnter={enter} onDragLeave={leave} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                <span className={cn("ParentBlock", styles.block)}>{typeof children === "function" ? children(fileOver) : children}</span>
            </div>
            {hover ? (
                <span className={styles.text}>
                    <T id="main.drop" />
                </span>
            ) : null}
        </>
    )
}

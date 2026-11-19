import { useEffect, useRef, useState, type MouseEvent } from "react"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { activeShow, showNotesActive, showsCache } from "../../shared/core/stores"
import { DEFAULT_WIDTH } from "../../utils/common"
import { translateText } from "../../utils/language"
import { _show } from "../../components/helpers/shows"
import { Icon } from "../helpers/Icon"
import { Button } from "../ui/button/Button"
import { Resizeable } from "../system/Resizeable"
import { useStore } from "../hooks/useStore"
import { Notes } from "./tools/Notes"
import styles from "./ShowNotes.module.css"

export interface ShowNotesProps {}

interface ShowWithLayouts {
    id?: string
    settings?: { activeLayout?: string }
    layouts?: Record<string, { notes?: string }>
}

// (F24.20a). `{@html formatLinks(note)}` se conserva con la misma fuente.
export function ShowNotes() {
    const currentActiveShow = useStore(activeShow)
    const currentShowsCache = useStore(showsCache)
    const active = useStore(showNotesActive)
    const showId = currentActiveShow?.id
    const currentShow = (showId ? currentShowsCache[showId] : undefined) as ShowWithLayouts | undefined
    const [note, setNote] = useState("")
    const currentLayout = useRef<string | null>(null)

    function updateNote() {
        if (!showId) return
        const layouts = _show().layouts("active")
        const notes = layouts.get("notes") as string[] | null
        setNote(notes?.[0] || "")
        currentLayout.current = currentShow?.settings?.activeLayout ?? null
    }

    useEffect(() => {
        if (showId && currentShow?.settings?.activeLayout !== currentLayout.current && active !== undefined) updateNote()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showId, currentShow?.settings?.activeLayout, active])

    function edit(value: string) {
        if (!showId || !currentShow?.layouts) return
        const layoutId = currentShow.settings?.activeLayout || ""
        if (currentShow.layouts[layoutId]?.notes === value) return
        _show().layouts("active").set({ key: "notes", value })
        updateNote()
    }

    function formatLinks(text: string) {
        return text
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g, (_match, label: string, link: string, rawUrl: string) => {
                const url = link || rawUrl
                let preview = label || rawUrl
                preview = preview.replace(/^https?:\/\//, "")
                if (preview.length > 35) preview = preview.slice(0, 35) + "..."
                return `<a href="${url}" data-title="${url}" target="_blank" rel="noopener noreferrer">${preview}</a>`
            })
            .replaceAll("\n", "&nbsp;")
    }

    function notesClick(event: MouseEvent<HTMLSpanElement>) {
        const target = event.target
        if (target instanceof Element && target.closest("a")) {
            event.preventDefault()
            const url = target.closest("a")?.getAttribute("href") || ""
            sendMain(Main.URL, url)
            return
        }
        showNotesActive.set(true)
    }

    if (active) {
        return (
            <Resizeable id="notes" side="bottom" defaultWidth={DEFAULT_WIDTH * 0.5} maxWidth={DEFAULT_WIDTH * 0.8} minWidth={47}>
                <div className={`dark ${styles.dark}`} style={{ display: "contents" }}>
                    <Notes value={note} autofocus onEdit={edit} />
                </div>
                <Button title="actions.close" onClick={() => showNotesActive.set(false)} style={{ position: "absolute", top: 9, right: "4.5px", opacity: 0.8, padding: 8 }} white>
                    <Icon id={note ? "remove" : "close"} white />
                </Button>
            </Resizeable>
        )
    }

    if (note) {
        return (
            <span className={styles.notes} role="none" data-title={translateText("tools.notes")} onClick={notesClick}>
                <Icon id="notes" size={0.8} right white />
                <p dangerouslySetInnerHTML={{ __html: formatLinks(note) }} />
            </span>
        )
    }

    return null
}

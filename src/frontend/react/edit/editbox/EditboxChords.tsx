import { useEffect, useMemo, useRef } from "react"
import type { Item } from "../../../../types/Show"
import { activeDropId, popupData, selected, storedChordsData } from "../../../stores"
import { waitForPopupData } from "../../../utils/popup"
import { clone } from "../../../components/helpers/array"
import { deleteAction } from "../../../components/helpers/clipboard"
import { history } from "../../../components/helpers/history"
import { addChords } from "../../../components/edit/scripts/chords"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import { useStore } from "../../hooks/useStore"
import styles from "./EditboxChords.module.css"

export interface EditboxChordsProps {
    item: Item
    autoSize: number
    index: number
    ref: {
        type?: "show" | "overlay" | "template" | "stage"
        showId?: string
        id: string
    }
    chordsMode?: boolean
    chordsAction?: string
}

// Port de components/edit/editbox/EditboxChords.svelte (F24.21c).
export function EditboxChords({ item, autoSize, index, ref, chordsMode = false, chordsAction = "" }: EditboxChordsProps) {
    useStore(selected)
    const currentStoredChordsData = useStore(storedChordsData)
    const currentActiveDropId = useStore(activeDropId)

    const chordButtons = useRef<{ item: Item; showRef: EditboxChordsProps["ref"]; itemIndex: number; chord: any; lineIndex: number }[]>([])
    const dragSourceIndex = useRef<number | null>(null)
    const lastDropTarget = useRef<HTMLElement | null>(null)

    const lineRadius = item?.specialStyle?.lineRadius || 0
    const lineBg = item?.specialStyle?.lineBg
    const lineStyle = (lineRadius ? `border-radius: ${lineRadius}px;` : "") + (lineBg ? `background: ${lineBg};` : "")

    const chordLines = useMemo(() => {
        if (!chordsMode || !item?.lines) return [] as string[]
        const lines: string[] = []
        chordButtons.current = []

        item.lines.forEach((line, i) => {
            if (!line.text) return

            let chords = clone(line.chords || [])

            let html = ""
            let currentIndex = 0
            line.text.forEach((text) => {
                if (!text.value) {
                    html += "<br>"
                    return
                }

                let value = text.value.replaceAll("\n", "").replaceAll("&nbsp;", " ") || ""

                let letters = value.split("")
                letters.forEach((letter) => {
                    let chordIndex = chords.findIndex((a) => a.pos === currentIndex)
                    if (chordIndex >= 0) {
                        let chord = chords[chordIndex]
                        chordButtons.current.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                        let buttonIndex = chordButtons.current.length - 1
                        html += `<span id="${buttonIndex}" draggable="true" class="context #chord chord button">${chord.key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    let style = text.style || ""
                    if (item.auto && autoSize) style += `font-size: ${autoSize}px;`

                    // in some cases spaces will get width 0 and change text layout if at line breaks (this is not an issue)
                    html += `<span id="${i}_${currentIndex}" class="invisible add" style="${style}">${letter}</span>`

                    currentIndex++
                })
            })

            if (!html) html += `<span class="invisible add"><br></span>`

            chords.forEach((chord, ci) => {
                chordButtons.current.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                let buttonIndex = chordButtons.current.length - 1
                html += `<span id="${buttonIndex}" draggable="true" class="context #chord chord button" style="transform: translate(${60 * (ci + 1)}px, -80%);">${chord.key}</span>`
            })

            if (!html) return
            lines[i] = html
        })

        return lines
    }, [chordsMode, item, item?.lines, item?.auto, autoSize, index, ref])

    async function chordClick(e: React.MouseEvent<HTMLDivElement>) {
        const target = e.target as HTMLElement
        const add = target.closest(".add") as HTMLElement | null
        if (add) {
            // only left click
            if (e.button !== 0) return
            if (e.ctrlKey || e.metaKey) storedChordsData.set({ ...(currentStoredChordsData || {}), romanKeysActive: !!currentStoredChordsData.romanKeysActive } as any)

            const pos = add.id.split("_")
            let key = chordsAction
            if (!key) key = await waitForPopupData("choose_chord")
            if (!key) return

            addChords(item, ref, index, Number(pos[0]), Number(pos[1]), key)
            popupData.set({})
            return
        }

        const btn = target.closest(".button") as HTMLElement | null
        if (!btn) return

        const data = chordButtons.current[Number(btn.id)]
        if (!data) return

        // for right click or rename click
        selected.set({ id: "chord", data: [{ chord: data.chord, index: data.lineIndex, slideId: ref.id, itemIndex: index }] } as any)

        // delete on middle mouse click
        if (e.button === 1) {
            deleteAction({ id: "chord", data: [{ chord: data.chord, index: data.lineIndex, slideId: ref.id, itemIndex: index }] } as any)
        }
    }

    function findAddTarget(el: any) {
        if (!el) return null
        return el.closest?.(".add") || null
    }

    function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
        const target = (e.target as HTMLElement)?.closest?.(".chord") as HTMLElement | null
        if (!target) return
        const id = target.id
        if (!id) return
        dragSourceIndex.current = Number(id)
        try {
            e.dataTransfer?.setData("text/plain", id)
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"
        } catch (_err) {}
    }

    function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
        const add = findAddTarget(e.target) as HTMLElement | null
        if (!add) return
        e.preventDefault()
        if (lastDropTarget.current && lastDropTarget.current !== add) lastDropTarget.current.classList.remove("drop-target")
        if (lastDropTarget.current !== add) {
            add.classList.add("drop-target")
            lastDropTarget.current = add
            activeDropId.set(add.id || "")
        }
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
    }

    function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
        const add = findAddTarget(e.target)
        if (add && lastDropTarget.current === add) {
            lastDropTarget.current?.classList.remove("drop-target")
            lastDropTarget.current = null
            activeDropId.set("")
        }
    }

    function handleDragEnd() {
        dragSourceIndex.current = null
        if (lastDropTarget.current) {
            lastDropTarget.current.classList.remove("drop-target")
            lastDropTarget.current = null
        }
        activeDropId.set("")
    }

    function moveChord(buttonIndex: number, toLine: number, toPos: number) {
        const data = chordButtons.current[buttonIndex]
        if (!data || !item.lines) return
        const chord = data.chord
        const fromLine = data.lineIndex

        const fromChords = item.lines[fromLine].chords || []
        const idx = fromChords.findIndex((c: any) => c.pos === chord.pos && c.key === chord.key)
        if (idx >= 0) fromChords.splice(idx, 1)

        chord.pos = toPos
        if (!item.lines[toLine].chords) item.lines[toLine].chords = []
        item.lines[toLine].chords.push(chord)

        item.lines[toLine].chords.sort((a: any, b: any) => (a.pos || 0) - (b.pos || 0))

        try {
            history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([item.lines]), slides: [ref.id], items: [index], showId: ref.showId } })
        } catch (_err) {}
    }

    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
        const add = findAddTarget(e.target) as HTMLElement | null
        if (!add) return
        const id = add.id
        const parts = id.split("_")
        const toLine = Number(parts[0])
        const toPos = Number(parts[1])

        let sourceIdStr = ""
        try {
            sourceIdStr = e.dataTransfer?.getData("text/plain") || ""
        } catch (_err) {}
        const sourceIndex = sourceIdStr ? Number(sourceIdStr) : dragSourceIndex.current
        if (sourceIndex == null || isNaN(sourceIndex)) return

        moveChord(sourceIndex, toLine, toPos)

        if (lastDropTarget.current) {
            lastDropTarget.current.classList.remove("drop-target")
            lastDropTarget.current = null
        }
        activeDropId.set("")
        dragSourceIndex.current = null
    }

    useEffect(() => {
        // keep activeDropId in sync if cleared elsewhere
        if (!currentActiveDropId && lastDropTarget.current) {
            lastDropTarget.current.classList.remove("drop-target")
            lastDropTarget.current = null
        }
    }, [currentActiveDropId])

    if (!item?.lines) return null

    return (
        <div className={`edit chords ${styles.edit} ${styles.chords}`} onMouseDown={chordClick} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onDragEnd={handleDragEnd}>
            {item.lines.map((line, i) => (
                <div key={i} className={`break chordsBreak ${styles.break} ${styles.chordsBreak}`} style={cssTextToStyle(`${lineStyle}${line.align || ""}`)} dangerouslySetInnerHTML={{ __html: chordLines[i] || "" }} />
            ))}
        </div>
    )
}

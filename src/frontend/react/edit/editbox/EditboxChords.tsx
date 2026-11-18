import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react"
import type { Chords, Item } from "../../../../types/Show"
import { activeDropId, popupData, selected, storedChordsData } from "../../../stores"
import { waitForPopupData } from "../../../utils/popup"
import { clone } from "../../../components/helpers/array"
import { deleteAction } from "../../../components/helpers/clipboard"
import { history } from "../../../components/helpers/history"
import { addChords } from "../../../components/edit/scripts/chords"
import { useStore } from "../../hooks/useStore"
import styles from "./EditboxChords.module.css"

interface ChordButtonData {
    item: Item
    showRef: { type?: "show" | "overlay" | "template" | "stage"; showId?: string; id: string }
    itemIndex: number
    chord: Chords
    lineIndex: number
}

export interface EditboxChordsProps {
    item: Item
    autoSize?: number
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
export function EditboxChords({ item, autoSize = 0, index, ref, chordsMode = false, chordsAction = "" }: EditboxChordsProps) {
    useStore(activeDropId)
    const currentStoredChordsData = useStore(storedChordsData)
    const [chordLines, setChordLines] = useState<string[]>([])
    const chordButtonsRef = useRef<ChordButtonData[]>([])
    const dragSourceIndexRef = useRef<number | null>(null)
    const lastDropTargetRef = useRef<HTMLElement | null>(null)
    const latest = useRef({ item, autoSize, index, ref, chordsMode, chordsAction, currentStoredChordsData })
    latest.current = { item, autoSize, index, ref, chordsMode, chordsAction, currentStoredChordsData }

    function createChordLines() {
        const { item, autoSize, index, ref } = latest.current
        const nextChordLines: string[] = []
        const nextChordButtons: ChordButtonData[] = []

        item.lines?.forEach((line, i) => {
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
                        nextChordButtons.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                        let buttonIndex = nextChordButtons.length - 1
                        html += `<span id="${buttonIndex}" draggable="true" class="context #chord chord button">${chord.key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    let style = text.style || ""
                    if (item.auto && autoSize) style += `font-size: ${autoSize}px;`

                    html += `<span id="${i}_${currentIndex}" class="invisible add" style="${style}">${letter}</span>`

                    currentIndex++
                })
            })

            if (!html) html += `<span class="invisible add"><br></span>`

            chords.forEach((chord, ci) => {
                nextChordButtons.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                let buttonIndex = nextChordButtons.length - 1
                html += `<span id="${buttonIndex}" draggable="true" class="context #chord chord button" style="transform: translate(${60 * (ci + 1)}px, -80%);">${chord.key}</span>`
            })

            if (!html) return
            nextChordLines[i] = html
        })

        chordButtonsRef.current = nextChordButtons
        setChordLines(nextChordLines)
    }

    useEffect(() => {
        if (chordsMode && (item?.lines || (item?.auto && autoSize))) createChordLines()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chordsMode, item?.lines, item?.auto, autoSize, item, index, ref, chordsAction])

    async function chordClick(e: MouseEvent<HTMLDivElement>) {
        const target = e.target as HTMLElement | null
        const add = target?.closest(".add") as HTMLElement | null
        if (add) {
            if (e.button !== 0) return
            if (e.ctrlKey || e.metaKey) storedChordsData.set({ romanKeysActive: !!latest.current.currentStoredChordsData.romanKeysActive })

            let pos = add.id.split("_")
            let key = latest.current.chordsAction
            if (!key) key = await waitForPopupData("choose_chord")
            if (!key) return

            addChords(latest.current.item, latest.current.ref, latest.current.index, Number(pos[0]), Number(pos[1]), key)
            popupData.set({})
            return
        }

        const btn = target?.closest(".button") as HTMLElement | null
        if (!btn) return

        let data = chordButtonsRef.current[Number(btn.id)]
        if (!data) return

        selected.set({ id: "chord", data: [{ chord: data.chord, index: data.lineIndex, slideId: latest.current.ref.id, itemIndex: latest.current.index }] } as unknown as Parameters<typeof selected.set>[0])

        if (e.button === 1) {
            deleteAction(selected as unknown as Parameters<typeof deleteAction>[0])
            return
        }
    }

    function findAddTarget(el: EventTarget | null) {
        if (!(el instanceof Element)) return null
        return el.closest(".add") as HTMLElement | null
    }

    function handleDragStart(e: DragEvent<HTMLDivElement>) {
        const target = (e.target as HTMLElement)?.closest?.(".chord") as HTMLElement | null
        if (!target) return
        const id = target.id
        if (!id) return
        dragSourceIndexRef.current = Number(id)
        try {
            e.dataTransfer?.setData("text/plain", id)
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"
        } catch (err) {}
    }

    function handleDragOver(e: DragEvent<HTMLDivElement>) {
        const add = findAddTarget(e.target)
        if (!add) return
        e.preventDefault()
        if (lastDropTargetRef.current && lastDropTargetRef.current !== add) lastDropTargetRef.current.classList.remove("drop-target")
        if (lastDropTargetRef.current !== add) {
            add.classList.add("drop-target")
            lastDropTargetRef.current = add
            activeDropId.set(add.id || "")
        }
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
    }

    function handleDragLeave(e: DragEvent<HTMLDivElement>) {
        const add = findAddTarget(e.target)
        if (add && lastDropTargetRef.current === add) {
            lastDropTargetRef.current?.classList.remove("drop-target")
            lastDropTargetRef.current = null
            activeDropId.set("")
        }
    }

    function handleDragEnd() {
        dragSourceIndexRef.current = null
        if (lastDropTargetRef.current) {
            lastDropTargetRef.current.classList.remove("drop-target")
            lastDropTargetRef.current = null
        }
        activeDropId.set("")
    }

    function handleDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault()
        const add = findAddTarget(e.target)
        if (!add) return
        const id = add.id
        const parts = id.split("_")
        const toLine = Number(parts[0])
        const toPos = Number(parts[1])

        let sourceIdStr = ""
        try {
            sourceIdStr = e.dataTransfer?.getData("text/plain") || ""
        } catch (err) {}
        const sourceIndex = sourceIdStr ? Number(sourceIdStr) : dragSourceIndexRef.current
        if (sourceIndex == null || isNaN(Number(sourceIndex))) return

        moveChord(Number(sourceIndex), toLine, toPos)

        if (lastDropTargetRef.current) {
            lastDropTargetRef.current.classList.remove("drop-target")
            lastDropTargetRef.current = null
        }
        activeDropId.set("")
        dragSourceIndexRef.current = null
    }

    function moveChord(buttonIndex: number, toLine: number, toPos: number) {
        const { item, ref, index } = latest.current
        const data = chordButtonsRef.current[buttonIndex]
        if (!data || !item.lines) return
        const chord = data.chord
        const fromLine = data.lineIndex

        const fromChords = item.lines[fromLine].chords || []
        const idx = fromChords.findIndex((c) => c.pos === chord.pos && c.key === chord.key)
        if (idx >= 0) fromChords.splice(idx, 1)

        chord.pos = toPos
        if (!item.lines[toLine].chords) item.lines[toLine].chords = []
        item.lines[toLine].chords!.push(chord)

        item.lines[toLine].chords!.sort((a, b) => (a.pos || 0) - (b.pos || 0))

        createChordLines()
        try {
            history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([item.lines]), slides: [ref.id], items: [index], showId: ref.showId } } as unknown as Parameters<typeof history>[0])
        } catch (err) {}
    }

    if (!item?.lines) return null

    const lineRadius = item?.specialStyle?.lineRadius || 0
    const lineBg = item?.specialStyle?.lineBg

    return (
        <div className={`edit chords ${styles.edit} ${styles.chords}`} onMouseDown={chordClick} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onDragEnd={handleDragEnd}>
            {item.lines.map((line, i) => (
                <div
                    key={i}
                    className={`break chordsBreak ${styles.break}`}
                    style={
                        {
                            ...(lineRadius ? { borderRadius: `${lineRadius}px` } : {}),
                            ...(lineBg ? { background: lineBg } : {}),
                            ...(line.align
                                ? Object.fromEntries(
                                      String(line.align)
                                          .split(";")
                                          .filter(Boolean)
                                          .map((p) => {
                                              const [k, v] = p.split(":")
                                              return [k?.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v?.trim()]
                                          })
                                  )
                                : {})
                        } as React.CSSProperties
                    }
                    dangerouslySetInnerHTML={{ __html: chordLines[i] || "" }}
                />
            ))}
        </div>
    )
}

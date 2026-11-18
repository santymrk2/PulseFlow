import { useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { uid } from "uid"
import type { Chords, Item, Line } from "../../../../types/Show"
import { splitCustomDynamicValues } from "../../../show/slides"
import { activeEdit, activeShow, activeStage, overlays, redoHistory, refreshListBoxes, showsCache, special, stageShows, templates } from "../../../stores"
import { newToast } from "../../../utils/common"
import { getNormalizedKey, isComposing, isFormattingKey } from "../../../utils/shortcuts"
import { clone } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { addToPos } from "../../../components/helpers/mover"
import { getLayoutRef } from "../../../components/helpers/show"
import { _show } from "../../../components/helpers/shows"
import { getStyles } from "../../../components/helpers/style"
import { calculateShapeVerticalOffset, getShapeFloatSide } from "../../../components/edit/scripts/shapeOutside"
import autosizeScript from "../../../components/edit/scripts/autosize"
import { getItemText, getLineText, getSelectionRange, setCaret } from "../../../components/edit/scripts/textStyle"
import { EditboxChords } from "./EditboxChords"
import { EditboxHelper } from "../../../components/edit/editbox/EditboxHelper"
import { EditboxPaste } from "../../../components/edit/editbox/EditboxPaste"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import styles from "./EditboxLines.module.css"

type SelRange = { start?: number; end?: number } | undefined
type LineTextPart = { style: string; value: string; customType?: string; sourceDynamicKey?: string }
type EditableLine = Line & { text: LineTextPart[]; chords?: Chords[] }

export interface EditboxLinesProps {
    item: Item
    ref: {
        type?: "show" | "overlay" | "template" | "stage"
        showId?: string
        origin?: string
        id: string
    }
    index: number
    editIndex?: number
    plain?: boolean
    chordsMode?: boolean
    chordsAction?: string
    isLocked?: boolean
}

// Port de components/edit/editbox/EditboxLines.svelte (F24.21c).
// contenteditable no controlado por React: el DOM se actualiza solo cuando `html` cambia (getStyle/restaurar caret),
// igual que bind:innerHTML en Svelte. Durante la escritura se lee del DOM via helpers, sin setear estado de contenido.
export function EditboxLines({ item, ref, index, editIndex: editIndexProp = -1, plain = false, chordsMode = false, chordsAction = "", isLocked = false }: EditboxLinesProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentActiveStage = useStore(activeStage)
    const currentOverlays = useStore(overlays)
    const currentRedoHistory = useStore(redoHistory)
    const currentShowsCache = useStore(showsCache)
    const currentSpecial = useStore(special)
    const currentStageShows = useStore(stageShows)
    const currentTemplates = useStore(templates)

    const textElemRef = useRef<HTMLDivElement>(null)
    const alignElemRef = useRef<HTMLDivElement>(null)

    const [html, setHtml] = useState("")
    const [autoSize, setAutoSize] = useState(0)
    const [shapeOffsetTop, setShapeOffsetTop] = useState(0)

    const s = useRef({
        composing: false,
        previousHTML: "",
        currentStyle: "",
        loaded: false,
        currentSlide: -1,
        previousChords: "",
        HISTORY_UPDATE_KEY: 0,
        updates: 0,
        recentKeyboardLineMutationAt: 0,
        pasting: false,
        lastCaretPos: { line: -1, pos: -1, lineLength: 0 } as { line: number; pos: number; lineLength: number },
        autoSizeFrame: 0,
        autosizeTimeout: null as ReturnType<typeof setTimeout> | null,
        lastMeasureDuration: 0,
        lastSignature: ""
    })
    const latest = useRef({ item, ref, index, editIndex: editIndexProp, plain, chordsMode, chordsAction, isLocked, currentActiveEdit, currentActiveShow, currentActiveStage, currentOverlays, currentRedoHistory, currentShowsCache, currentSpecial, currentStageShows, currentTemplates, html, autoSize })
    latest.current = { item, ref, index, editIndex: editIndexProp, plain, chordsMode, chordsAction, isLocked, currentActiveEdit, currentActiveShow, currentActiveStage, currentOverlays, currentRedoHistory, currentShowsCache, currentSpecial, currentStageShows, currentTemplates, html, autoSize }

    const lineGap = item?.specialStyle?.lineGap
    const lineRadius = item?.specialStyle?.lineRadius || 0
    const lineBg = item?.specialStyle?.lineBg
    const lineStyleBox = lineGap ? `gap: ${lineGap}px;` : ""
    const lineStyleRadius = lineRadius ? `border-radius: ${lineRadius}px;` : ""
    const lineStyleBg = lineBg ? `background: ${lineBg};` : ""

    const shapeOutside = getStyles(item?.style)["shape-outside"]
    const shapeFloatSide = useMemo(() => getShapeFloatSide(shapeOutside), [shapeOutside])

    const isAuto = item?.auto || (item?.textFit || "none") !== "none"
    const textArray = Array.isArray(item?.lines?.[0]?.text) ? item.lines[0].text : []
    const itemText = textArray.filter((a) => !a.customType?.includes("disableTemplate")) || []
    const itemFontSize = Number(getStyles((ref.type === "stage" ? item : itemText[0])?.style, true)?.["font-size"] || "")

    function getStyle() {
        if (s.current.composing) return
        if (!plain && latest.current.currentActiveEdit.slide === null) return
        const result = EditboxHelper.getStyleHtml(latest.current.item, plain, s.current.currentStyle, latest.current.ref.origin === "powerpoint")
        s.current.currentStyle = result.currentStyle
        s.current.previousHTML = result.html
        setHtml(result.html)
    }

    function getHTMLLineText(lineIndex: number) {
        const textElem = textElemRef.current
        if (!textElem) return ""
        let text = ""
        let lineElem = textElem.children[lineIndex]
        if (!lineElem) return ""
        new Array(...lineElem.childNodes).forEach((child: Node) => {
            if (child.nodeName === "#text") text += child.textContent || ""
            else text += (child as HTMLElement).innerText || ""
        })
        return text.trim()
    }

    function storeCurrentCaretPos() {
        let sel = getSelectionRange()
        let caretLineIndex = sel.findIndex((line) => line?.start !== undefined)
        if (caretLineIndex > -1) s.current.lastCaretPos = { line: caretLineIndex, pos: sel[caretLineIndex]?.start ?? -1, lineLength: getHTMLLineText(caretLineIndex).length }
    }

    function setCaretDelayed(line: number, pos: number) {
        setTimeout(() => {
            setCaret(textElemRef.current, { line, pos })
        }, 10)
    }

    async function refreshStyleAndRestoreCaret(caret: { line: number; pos: number }) {
        getStyle()
        await Promise.resolve() // tick-like microtask; caret restored after DOM update via timeout below
        setTimeout(() => setCaret(textElemRef.current, caret), 0)
    }

    function getNewLines() {
        const textElem = textElemRef.current
        const item = latest.current.item
        if (!textElem || !item) return []

        let newLines: Line[] = []
        let pos = -1
        s.current.currentStyle = ""
        let updateHTML = false

        const attrIndex = (elem: Element | null, name: string, fallback: number) => {
            const value = Number(elem?.getAttribute(name) ?? NaN)
            return isNaN(value) ? fallback : value
        }

        new Array(...textElem.children).forEach((line: Element, i) => {
            const sourceLine = plain ? attrIndex(line, "data-line-index", i) : i
            let align: string = plain ? (typeof item.lines?.[sourceLine]?.align === "string" ? (item.lines?.[sourceLine]?.align as string) : "") : line.getAttribute("style") || ""
            align = align.replaceAll(lineStyleBg, "").replaceAll(lineStyleRadius, "") + ";"
            pos++
            s.current.currentStyle += align + lineStyleBg + lineStyleRadius

            let newLine: EditableLine = { align, text: [] }
            let lineChords: Chords[] = []

            newLines.push(newLine)

            new Array(...line.childNodes).forEach((child: Node, j) => {
                if (child.nodeName === "#text") {
                    let lastNode = newLines[pos].text.length - 1
                    let originalLineStyle = item.lines?.[sourceLine]?.text?.[0]?.style || ""
                    let lastNodeStyle = lastNode >= 0 ? newLines[pos].text[lastNode]?.style || "" : ""

                    if (lastNode < 0 || !newLines[pos].text[lastNode] || (originalLineStyle && originalLineStyle !== lastNodeStyle)) {
                        newLines[pos].text.push({ style: originalLineStyle, value: child.textContent || "" })
                    } else {
                        newLines[pos].text[lastNode].value += child.textContent || ""
                    }

                    updateHTML = true
                    return
                }
                if (child.nodeName !== "SPAN") {
                    const strayText = child.nodeType === Node.ELEMENT_NODE ? ((child as HTMLElement).innerText || "").replaceAll("\n", "") : ""
                    if (strayText) {
                        let lastNode = newLines[pos].text.length - 1
                        if (lastNode < 0) newLines[pos].text.push({ style: item.lines?.[sourceLine]?.text?.[0]?.style || "", value: strayText })
                        else newLines[pos].text[lastNode].value += strayText
                        updateHTML = true
                    }
                    return
                }

                const childEl = child as HTMLElement
                const sourceText = plain ? attrIndex(childEl, "data-text-index", j) : j
                let style = plain ? item.lines?.[sourceLine]?.text[sourceText]?.style || "" : childEl.getAttribute("style") || ""

                let lineText = childEl.innerText
                if (lineText === "\n") lineText = ""
                if (plain && !lineText && !style) {
                    style = item.lines?.[i - 1]?.text[0]?.style || ""
                    newLines[pos].align = newLines[pos - 1]?.align || ""
                }

                let customIndex = style.indexOf("--custom")
                if (customIndex > -1) style = style.slice(0, customIndex)

                let customType = childEl.getAttribute("data-customtype") || undefined
                let sourceDynamicKey = childEl.getAttribute("data-sourcedynamickey") || undefined

                const text: LineTextPart = { style, value: lineText }
                if (customType) text.customType = customType
                if (sourceDynamicKey) text.sourceDynamicKey = sourceDynamicKey

                newLines[pos].text.push(text)
                s.current.currentStyle += style

                let storedChords = childEl.getAttribute("data-chords")
                if (storedChords) {
                    try {
                        const parsed = JSON.parse(storedChords) as Chords[]
                        lineChords.push(...parsed)
                    } catch (err) {
                        return
                    }
                }
            })

            if (lineChords?.length) {
                newLines[pos].chords = lineChords
                const previousChordIds = newLines[pos - 1]?.chords?.map((a) => a.id) || []
                const shared = (a: Chords) => previousChordIds.includes(a.id)
                if (pos > 0 && newLines[pos].chords!.some(shared)) {
                    let breakPoint = newLines[pos - 1].text.reduce((textLength: number, text: LineTextPart) => (textLength += text.value.length), 0)
                    newLines[pos - 1].chords = newLines[pos - 1].chords!.filter((a) => !shared(a) || a.pos < breakPoint)
                    newLines[pos].chords = newLines[pos].chords!.filter((a) => !shared(a) || a.pos >= breakPoint).map((a) => (shared(a) && a.pos >= breakPoint ? { ...a, pos: a.pos - breakPoint } : a))
                }
            }
        })

        if (s.current.pasting) return newLines

        const keyboardLineMutation = Date.now() - s.current.recentKeyboardLineMutationAt < 250

        if (updateHTML && !keyboardLineMutation) {
            let sel = getSelectionRange() as SelRange[]
            let lineIndex = sel.findIndex((a) => a?.start !== undefined)
            if (lineIndex >= 0) {
                let caret = { line: lineIndex || 0, pos: sel[lineIndex]?.start || 0 }
                refreshStyleAndRestoreCaret(caret)
            }
        }

        let caret: { line: number; pos: number } | null = null
        let liveSel = getSelectionRange() as SelRange[]
        let liveSelLine = liveSel.findIndex((a) => a?.start !== undefined)
        const liveCaret = liveSelLine > -1 ? { line: liveSelLine, pos: liveSel[liveSelLine]?.start || 0 } : null

        let align = item.lines?.[0]?.align || ""
        let textStyle = item.lines?.[0]?.text?.[0]?.style || ""

        if (!newLines.length) {
            newLines = [{ align, text: [{ style: textStyle, value: "" }] }]
            caret = { line: 0, pos: 0 }
        } else {
            newLines.forEach((line, i) => {
                if (!line.text?.length) {
                    const ls = item.lines?.[i]?.text?.[0]?.style || textStyle
                    newLines[i].text = [{ style: ls, value: "" }]
                    caret = { line: i, pos: 0 }
                }
            })

            let sel = getSelectionRange() as SelRange[]
            let currentLine = sel.findIndex((a) => a?.start !== undefined)
            let deleteKey = currentLine === s.current.lastCaretPos.line
            if (!caret && (item.lines || []).length > newLines.length) {
                if (liveCaret) {
                    caret = liveCaret
                } else if (deleteKey) {
                    caret = s.current.lastCaretPos
                } else {
                    let newLine = s.current.lastCaretPos.line > -1 ? s.current.lastCaretPos.line - 1 : newLines.length - 1
                    let newPos = s.current.lastCaretPos.pos > -1 ? getLineText(newLines[s.current.lastCaretPos.line - 1]).length - s.current.lastCaretPos.lineLength : getLineText(newLines[newLines.length - 1]).length
                    caret = { line: newLine, pos: newPos }
                }
            }
        }

        const structureChanged = (item.lines || []).length !== newLines.length || newLines.some((line, i) => (line.text?.length || 0) !== (item.lines?.[i]?.text?.length || 0))
        if (keyboardLineMutation && liveCaret && structureChanged) caret = liveCaret

        if (caret) {
            item.lines = newLines
            if (newLines.length > 0) void refreshStyleAndRestoreCaret(caret)
            s.current.lastCaretPos = { ...caret, lineLength: getHTMLLineText(caret.line).length }
        } else {
            storeCurrentCaretPos()
            if (ref.type !== "show" && (item.lines || []).length < newLines.length) {
                setTimeout(() => setCaret(textElemRef.current, s.current.lastCaretPos), 20)
            }
        }

        return newLines
    }

    function updateLines(newLines: Line[] = []) {
        const { item, ref, index, plain, currentActiveEdit, currentActiveShow, currentActiveStage, currentRedoHistory, currentShowsCache } = latest.current
        if (s.current.composing) return

        if (!newLines?.length) newLines = getNewLines()
        if (item) item.lines = newLines

        const setNewLines = (a: Record<string, unknown>) => {
            const id = currentActiveEdit.id
            if (!id) return a
            const target = a as Record<string, { items?: Item[]; modified?: number }>
            if (!target[id]?.items?.[index]) return a
            target[id].items![index].lines = newLines
            target[id].modified = Date.now()
            return a
        }

        if (currentActiveEdit.type === "overlay") overlays.update(setNewLines as unknown as Parameters<typeof overlays.update>[0])
        else if (currentActiveEdit.type === "template") templates.update(setNewLines as unknown as Parameters<typeof templates.update>[0])
        else if (ref.type === "stage") {
            stageShows.update(((a: Record<string, unknown>) => {
                const stageId = currentActiveStage.id
                if (!stageId) return a
                const target = a as Record<string, { items?: Record<string, Item>; modified?: number }>
                if (!target[stageId]?.items?.[ref.id]) return a
                target[stageId].items![ref.id].lines = newLines
                target[stageId].modified = Date.now()
                return a
            }) as unknown as Parameters<typeof stageShows.update>[0])
        } else if (ref.id) {
            let lastRedo = currentRedoHistory[currentRedoHistory.length - 1] as unknown as { id?: string; oldData?: { previousData?: Array<{ lines?: Line[] }> } } | undefined
            if (lastRedo?.id === "SHOW_ITEMS") {
                let previousData = lastRedo.oldData?.previousData
                let historyText = previousData?.[index]?.lines?.reduce((text: string, line: Line) => (text += getLineText(line)), "") || ""
                let linesText = newLines.reduce((text: string, line: Line) => (text += getLineText(line)), "")
                if (historyText === linesText) return
            }

            let lastChangedLine = EditboxHelper.determineCaretLine(item?.lines || [], newLines)
            const keyboardLineMutation = Date.now() - s.current.recentKeyboardLineMutationAt < 250
            const domSelection = window.getSelection()
            const anchorElem = (domSelection?.anchorNode as Element)?.nodeType === Node.ELEMENT_NODE ? (domSelection?.anchorNode as Element) : domSelection?.anchorNode?.parentElement
            const editingThisTextElem = !!textElemRef.current && (document.activeElement === textElemRef.current || anchorElem?.closest(".edit") === textElemRef.current)
            if (lastChangedLine > -1 && (item?.lines || []).length !== newLines.length && !keyboardLineMutation && !editingThisTextElem) setCaretDelayed(lastChangedLine, 0)
            s.current.updates++
            if (s.current.updates >= 15) {
                s.current.HISTORY_UPDATE_KEY++
                s.current.updates = 0
            }
            let itemRef = (ref.showId || "") + ref.id + "_" + index + "_" + s.current.HISTORY_UPDATE_KEY

            if (lineStyleBg) {
                newLines.forEach((line) => {
                    line.align = (typeof line.align === "string" ? line.align : "").replace(lineStyleBg, "")
                })
            }
            if (lineStyleRadius) {
                newLines.forEach((line) => {
                    line.align = (typeof line.align === "string" ? line.align : "").replace(lineStyleRadius, "")
                })
            }

            const showId = ref.showId || currentActiveShow?.id || ""
            if (showId && currentShowsCache[showId]?.slides?.[ref.id]?.customDynamicValues) {
                showsCache.update(((a: Record<string, unknown>) => {
                    const shows = a as Record<string, { slides?: Record<string, { customDynamicValues?: Record<string, unknown[]> }> }>
                    const storage = shows[showId]?.slides?.[ref.id]?.customDynamicValues
                    if (!storage) return a

                    const collected: Record<string, { [index: number]: string }> = {}
                    let currentVerseIdx = 0
                    newLines.forEach((line) => {
                        line.text?.forEach((text) => {
                            if (!text || text.customType?.includes("disableTemplate")) return

                            let [key, idxStr] = text.sourceDynamicKey?.split(":") || []
                            let idx = idxStr !== undefined ? Number(idxStr) : currentVerseIdx
                            if (text.sourceDynamicKey?.includes("_text")) currentVerseIdx = idx
                            else key = index === 0 ? "scripture_text" : `scripture${index + 1}_text`

                            if (!collected[key]) collected[key] = {}
                            collected[key][idx] = (collected[key][idx] || "") + (text.value || "")
                        })
                    })

                    Object.keys(storage).forEach((key) => {
                        if (!Array.isArray(storage[key])) return
                        const coll = collected[key] || (key === "scripture1_text" ? collected.scripture_text : key === "scripture_text" ? collected.scripture1_text : undefined)
                        if (!coll) return

                        storage[key] = storage[key]
                            .map((item: unknown, idx: number) => {
                                if (!Array.isArray(item)) return item
                                const verseNum = item[0] || "0"
                                let textVal = (coll[idx] ?? "").trim()
                                if (verseNum !== "0" && textVal.startsWith(verseNum)) {
                                    textVal = textVal.slice(verseNum.length).trim()
                                }
                                return textVal ? [verseNum, textVal] : null
                            })
                            .filter(Boolean)
                    })

                    if (storage.scripture_text && !storage.scripture1_text) storage.scripture1_text = clone(storage.scripture_text)
                    if (storage.scripture1_text && !storage.scripture_text) storage.scripture_text = clone(storage.scripture_text)

                    return a
                }) as unknown as Parameters<typeof showsCache.update>[0])
            }

            history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([newLines]), slides: [ref.id], items: [index], showId: ref.showId }, location: { page: "none", override: itemRef } } as unknown as Parameters<typeof history>[0])

            if (plain) refreshListBoxes.set(latest.current.editIndex)
        }
    }

    function cutInTwo({ e, sel, lines, currentIndex, textPos, start }: { e: { preventDefault: () => void; target?: EventTarget | null }; sel: SelRange[]; lines: Line[]; currentIndex: number; textPos: number; start: number }) {
        const { ref, index, plain, currentActiveEdit, currentActiveShow } = latest.current
        if ((ref.type || "show") !== "show") return
        let { firstLines, secondLines } = EditboxHelper.cutLinesInTwo({ sel, lines, currentIndex, textPos, start })

        let effEditIndex = editIndexProp
        if (!plain && typeof currentActiveEdit.slide === "number") effEditIndex = currentActiveEdit.slide
        let domItemIndex = Number((e?.target as HTMLElement | null)?.closest(".editItem")?.getAttribute("data-index"))
        let editItemIndex: number = plain ? index : (currentActiveEdit.items[0] ?? (isNaN(domItemIndex) ? 0 : domItemIndex))

        let layoutRef = getLayoutRef()
        let slideRef = layoutRef[effEditIndex]
        if (!slideRef) return

        let newSlide = clone(_show().slides([ref.id]).get()[0]) || {}
        if (!newSlide.items?.[editItemIndex]) return
        newSlide.items[editItemIndex].lines = secondLines
        delete newSlide.id
        delete newSlide.globalGroup
        newSlide.group = null
        newSlide.color = null

        if (newSlide.customDynamicValues) {
            let firstItems = clone(_show().slides([ref.id]).get("items")[0]) || []
            firstItems[editItemIndex] = { ...firstItems[editItemIndex], lines: firstLines }
            const split = splitCustomDynamicValues(newSlide.customDynamicValues, firstItems, newSlide.items)
            if (split) {
                showsCache.update(((a: Record<string, unknown>) => {
                    const showId = ref.showId || currentActiveShow?.id || ""
                    const shows = a as Record<string, { slides?: Record<string, { customDynamicValues?: unknown }> }>
                    if (shows[showId]?.slides?.[ref.id]) shows[showId].slides![ref.id].customDynamicValues = split.firstDV
                    return a
                }) as unknown as Parameters<typeof showsCache.update>[0])
                newSlide.customDynamicValues = split.secondDV
            }
        }

        let id = uid()
        _show().slides([id]).add([newSlide])

        updateLines(firstLines)

        let parentId = slideRef.type === "child" ? slideRef.parent!.id : slideRef.id
        let children = _show().slides([parentId]).get("children")[0] || []
        let slideIndex = slideRef.type === "child" ? slideRef.index + 1 : 0
        children = addToPos(children, [id], slideIndex)
        _show().slides([parentId]).set({ key: "children", value: children })

        let parentIndex = slideRef.type === "child" ? slideRef.parent!.layoutIndex : slideRef.layoutIndex
        let parentsBefore = layoutRef.filter((a: { id?: string }, i: number) => i < parentIndex && a.id === parentId)?.length
        let newIndex = (currentActiveEdit.slide || 0) + (parentsBefore + 1)

        if (!(e?.target as HTMLElement | null)?.closest(".item")) {
            getStyle()
            return
        }

        activeEdit.set({ slide: newIndex, items: [0], showId: (currentActiveShow as { id?: string } | undefined)?.id } as unknown as Parameters<typeof activeEdit.set>[0])
        setTimeout(() => {
            const elem = document.querySelector(".editItem")?.querySelector(".edit") as HTMLElement | null
            if (elem) elem.focus()
            const caret = { line: (getSelectionRange() as SelRange[]).length - 1, pos: 999 }
            setCaret(elem, caret)
        })
    }

    function keydown(e: KeyboardEvent) {
        if (isComposing(e)) return

        if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault()
            return
        }

        if (e.key === "Enter" && ((e.target as HTMLElement)?.closest(".item") || (e.target as HTMLElement)?.closest(".quickEdit"))) {
            if (e.target !== textElemRef.current) return
            const qe = (e.target as HTMLElement).closest(".quickEdit")
            if (qe && Number(qe.getAttribute("data-index")) !== latest.current.editIndex) return
            if (!qe && !latest.current.currentActiveEdit.items.includes(latest.current.index)) return
            if (!e.altKey) return

            let sel = getSelectionRange()
            if (!sel?.length || (sel.length === 1 && !Object.keys(sel[0]).length)) return

            let lines: Line[] = getNewLines()
            let currentIndex = 0,
                textPos = 0
            let start = -1
            cutInTwo({ e, sel, lines: clone(lines), currentIndex, textPos, start })
        }

        storeCurrentCaretPos()
    }

    function textElemKeydown(e: ReactKeyboardEvent<HTMLDivElement>) {
        if ((e.key === "Enter" || e.key === "Backspace" || e.key === "Delete") && !isComposing(e.nativeEvent)) {
            s.current.recentKeyboardLineMutationAt = Date.now()
        }

        if (e.ctrlKey || e.metaKey) {
            if (isFormattingKey(e.nativeEvent)) e.preventDefault()
        }

        if (getNormalizedKey(e.nativeEvent).toLowerCase() === "v" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            EditboxPaste.handlePaste(
                e.nativeEvent,
                {
                    item: latest.current.item,
                    ref: latest.current.ref,
                    textElem: textElemRef.current || undefined,
                    lastCaretPos: s.current.lastCaretPos,
                    getNewLines,
                    updateLines,
                    getStyle,
                    setPasting: (p) => {
                        s.current.pasting = p
                    }
                } as unknown as Parameters<typeof EditboxPaste.handlePaste>[1],
                e.shiftKey
            )
        }

        if (e.key === "<") {
            if (latest.current.item?.lines?.some((line: Line) => line.text?.some((text) => (text as { style?: string }).style?.toLowerCase()?.includes("bamini")))) {
                e.preventDefault()
                document.execCommand("insertHTML", false, "ஈ")
                return
            }
            newToast("Note: < is treated as HTML")
        }
    }

    function paste(e: unknown, clipboardText?: string, clipboardHtml?: string) {
        EditboxPaste.paste(e as Parameters<typeof EditboxPaste.paste>[0], clipboardText, clipboardHtml, {
            item: latest.current.item,
            ref: latest.current.ref,
            textElem: textElemRef.current || undefined,
            lastCaretPos: s.current.lastCaretPos,
            getNewLines,
            updateLines,
            getStyle,
            setPasting: (p) => {
                s.current.pasting = p
            }
        } as unknown as Parameters<typeof EditboxPaste.paste>[3])
    }

    function handleCopy(e: ReactClipboardEvent<HTMLDivElement>) {
        EditboxPaste.handleCopy(e.nativeEvent, getNewLines())
    }

    function handleCut(e: ReactClipboardEvent<HTMLDivElement>) {
        EditboxPaste.handleCut(e.nativeEvent, getNewLines(), paste)
    }

    function cancelScheduledAutoSize(): void {
        if (s.current.autoSizeFrame) cancelAnimationFrame(s.current.autoSizeFrame)
        if (s.current.autosizeTimeout) clearTimeout(s.current.autosizeTimeout)
        s.current.autoSizeFrame = 0
        s.current.autosizeTimeout = null
    }

    function runAutoSize(): void {
        const { plain, item, ref, chordsMode, currentSpecial } = latest.current
        void chordsMode
        void currentSpecial
        const alignElem = alignElemRef.current
        if (plain || !s.current.loaded || !alignElem) return
        const itemIsAuto = item?.auto || (item?.textFit || "none") !== "none"
        if (!itemIsAuto) return
        if (!alignElem.clientHeight) return

        let fontSize = Number(getStyles((ref.type === "stage" ? item : Array.isArray(item?.lines?.[0]?.text) ? item.lines![0].text![0] : undefined)?.style, true)?.["font-size"] || "")

        const type = item?.textFit || "shrinkToFit"
        const signature = `${alignElem.clientWidth}x${alignElem.clientHeight}|${fontSize}|${type}|${lineGap || 0}|${html}`
        if (signature === s.current.lastSignature) return
        s.current.lastSignature = signature

        const defaultFontSize = type === "growToFit" ? 100 : fontSize
        const maxFontSize = type === "growToFit" ? fontSize : undefined

        const measureStart = performance.now()
        const next = autosizeScript(alignElem, { type, textQuery: ".edit .break span", defaultFontSize, maxFontSize })
        s.current.lastMeasureDuration = performance.now() - measureStart
        setAutoSize(next)
    }

    function scheduleAutoSize(immediate = false): void {
        const { plain, chordsMode, currentSpecial } = latest.current
        if (plain || !s.current.loaded || !isAuto || !alignElemRef.current || s.current.composing) return

        if (immediate) {
            cancelScheduledAutoSize()
            runAutoSize()
            return
        }

        if (chordsMode || s.current.lastMeasureDuration > 6 || currentSpecial.optimizedMode) {
            if (s.current.autosizeTimeout) clearTimeout(s.current.autosizeTimeout)
            s.current.autosizeTimeout = setTimeout(() => {
                s.current.autosizeTimeout = null
                runAutoSize()
            }, 150)
            return
        }

        if (s.current.autoSizeFrame) return
        s.current.autoSizeFrame = requestAnimationFrame(() => {
            s.current.autoSizeFrame = 0
            runAutoSize()
        })
    }

    // Mount / unmount
    useEffect(() => {
        getStyle()
        const t = setTimeout(() => {
            s.current.loaded = true
            setAutoSize(latest.current.item?.autoFontSize || 0)
            scheduleAutoSize(true)
            document.fonts?.ready?.then(() => scheduleAutoSize(true))
        }, 50)

        return () => {
            clearTimeout(t)
            cancelScheduledAutoSize()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Slide change
    useEffect(() => {
        const slide = currentActiveEdit.slide
        if (slide !== null && slide !== undefined && slide !== s.current.currentSlide && !s.current.composing) {
            s.current.currentSlide = slide
            const t = setTimeout(getStyle, 10)
            return () => clearTimeout(t)
        }
        return undefined
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentActiveEdit.slide])

    // Style hash / chords hash triggers getStyle
    useEffect(() => {
        let hash = ""
        clone(item?.lines)?.forEach((line: Line) => {
            let align = (typeof line.align === "string" ? line.align : "").replaceAll(lineStyleBg, "").replaceAll(lineStyleRadius, "") + ";"
            hash += align + lineStyleBg + lineStyleRadius
            if (!line?.text) return
            if (!Array.isArray(line.text)) (line as unknown as { text: Line["text"] }).text = []
            line.text.forEach((a) => {
                hash += EditboxHelper.getTextStyle(a)
            })
        })
        if (s.current.currentStyle.replaceAll(";", "") !== hash.replaceAll(";", "") && !s.current.composing) getStyle()

        let newChords = JSON.stringify(item?.lines?.map((a: Line) => a.chords?.map((c) => c.key)))
        if (s.current.previousChords !== newChords) {
            s.current.previousChords = newChords
            getStyle()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item?.lines, lineStyleBg, lineStyleRadius, plain, currentActiveEdit.slide])

    // html changed externally -> trigger updateLines (same as Svelte reactive statement)
    useEffect(() => {
        if (textElemRef.current && html !== s.current.previousHTML && !s.current.composing) {
            s.current.previousHTML = html
            const t = setTimeout(() => updateLines(), 10)
            return () => clearTimeout(t)
        }
        return undefined
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [html])

    // shape offset
    useEffect(() => {
        if (shapeOutside && textElemRef.current && (html || item?.align)) {
            const t = setTimeout(() => setShapeOffsetTop(calculateShapeVerticalOffset(textElemRef.current, item?.align)))
            return () => clearTimeout(t)
        }
        return undefined
    }, [shapeOutside, html, item?.align])

    // autosize triggers
    useEffect(() => {
        scheduleAutoSize()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [html, item?.style, isAuto, itemFontSize, lineGap, chordsMode, plain])

    // window keydown for split/shortcuts (Svelte used <svelte:window on:keydown={keydown} />)
    useEffect(() => {
        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!item?.lines) return null

    const itemAlign = (item.align as string) || ""
    const alignStyle = plain ? undefined : itemAlign || undefined
    const justifyAlign = plain ? undefined : itemAlign.replace("align-items", "justify-content")

    const editClass = ["edit", "context", plain ? "#editbox_text" : "#edit_box__editbox_text", styles.edit, chordsMode ? `hidden ${styles.hidden}` : "", shapeOutside ? `hasShapeOutside ${styles.hasShapeOutside}` : "", isAuto && autoSize && !plain ? `autoSize ${styles.autoSize}` : "", item.lines?.length < 2 && !item.lines?.[0]?.text?.[0]?.value?.length ? `height ${styles.height}` : "", chordsMode ? `tallLines ${styles.tallLines}` : ""].filter(Boolean).join(" ")

    const editInlineStyle: React.CSSProperties = {
        ...(shapeOutside ? ({ ["--shape-outside" as string]: shapeOutside, ["--shape-float" as string]: shapeFloatSide, ["--shape-offset-top" as string]: `${shapeOffsetTop}px` } as React.CSSProperties) : {}),
        ...(isAuto && autoSize && !plain ? ({ ["--auto-size" as string]: `${autoSize}px` } as React.CSSProperties) : {}),
        ...(!plain && lineStyleBox ? { gap: `${lineGap}px` } : {}),
        ...(plain ? {} : justifyAlign ? { justifyContent: justifyAlign.includes("justify-content") ? undefined : undefined } : {})
    }
    // preserve raw align style string behavior like Svelte did (it set style attribute string directly)
    const editStyleString = `${shapeOutside ? `--shape-outside: ${shapeOutside};--shape-float: ${shapeFloatSide};--shape-offset-top: ${shapeOffsetTop}px;` : ""}${isAuto && autoSize && !plain ? `--auto-size: ${autoSize}px;` : ""}${!plain ? lineStyleBox : ""}${plain ? "" : justifyAlign || ""}`

    return (
        <div
            ref={alignElemRef}
            className={`align ${chordsMode ? `chords ${styles.alignChords}` : ""} ${plain ? `plain ${styles.plain}` : ""} ${styles.align}`}
            style={
                alignStyle
                    ? ({
                          ...Object.fromEntries(
                              alignStyle
                                  .split(";")
                                  .filter(Boolean)
                                  .map((p) => {
                                      const [k, v] = p.split(":")
                                      return [k?.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v?.trim()]
                                  })
                          )
                      } as React.CSSProperties)
                    : undefined
            }
        >
            {item.lines?.length < 2 && !getItemText(item).length ? (
                <span className={`placeholder ${styles.placeholder}`}>
                    <p>{chordsMode ? <T id="edit.chords" /> : <T id="empty.text" />}</p>
                </span>
            ) : null}
            {isLocked ? (
                <div className={`edit ${shapeOutside ? `hasShapeOutside ${styles.hasShapeOutside}` : ""} ${styles.edit}`} style={shapeOutside || !plain ? ({ ...editInlineStyle } as React.CSSProperties) : undefined} dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
                <>
                    {chordsMode && textElemRef.current ? <EditboxChords item={item} autoSize={autoSize} index={index} ref={ref as unknown as { type?: "show" | "overlay" | "template" | "stage"; showId?: string; id: string }} chordsMode={chordsMode} chordsAction={chordsAction} /> : null}
                    <div
                        ref={textElemRef}
                        onMouseUp={() => storeCurrentCaretPos()}
                        className={editClass}
                        contentEditable
                        suppressContentEditableWarning
                        onKeyDown={textElemKeydown}
                        onInput={() => scheduleAutoSize()}
                        onCompositionStart={() => {
                            s.current.composing = true
                        }}
                        onCompositionEnd={() => {
                            s.current.composing = false
                            scheduleAutoSize(true)
                        }}
                        onBlur={() => {
                            s.current.composing = false
                        }}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        dangerouslySetInnerHTML={{ __html: html }}
                        style={
                            {
                                ...(editStyleString
                                    ? Object.fromEntries(
                                          editStyleString
                                              .split(";")
                                              .filter(Boolean)
                                              .map((p) => {
                                                  const idx = p.indexOf(":")
                                                  if (idx < 0) return [p.trim(), ""]
                                                  const k = p.slice(0, idx).trim()
                                                  const v = p.slice(idx + 1).trim()
                                                  return [k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]
                                              })
                                      )
                                    : {})
                            } as React.CSSProperties
                        }
                    />
                </>
            )}
        </div>
    )
}

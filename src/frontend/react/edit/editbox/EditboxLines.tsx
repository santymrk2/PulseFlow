import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { uid } from "uid"
import type { Item, Line } from "../../../../types/Show"
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
import autosize from "../../../components/edit/scripts/autosize"
import { getItemText, getLineText, getSelectionRange, setCaret } from "../../../components/edit/scripts/textStyle"
import { EditboxHelper } from "../../../components/edit/editbox/EditboxHelper"
import { EditboxPaste } from "../../../components/edit/editbox/EditboxPaste"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import { useStore } from "../../hooks/useStore"
import { T } from "../../helpers/T"
import { EditboxChords } from "./EditboxChords"
import styles from "./EditboxLines.module.css"

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
export function EditboxLines({ item, ref, index, editIndex = -1, plain = false, chordsMode = false, chordsAction = "", isLocked = false }: EditboxLinesProps) {
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

    const previousHTML = useRef("")
    const currentStyle = useRef("")
    const composing = useRef(false)
    const loaded = useRef(false)
    const pasting = useRef(false)
    const historyUpdateKey = useRef(0)
    const updates = useRef(0)
    const recentKeyboardLineMutationAt = useRef(0)
    const lastCaretPos = useRef<{ line: number; pos: number; lineLength: number }>({ line: -1, pos: -1, lineLength: 0 })
    const currentSlide = useRef(-1)
    const previousChords = useRef("")

    const autoSizeFrame = useRef(0)
    const autosizeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastMeasureDuration = useRef(0)
    const lastSignature = useRef("")
    const updateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    const latest = useRef({ item, ref, index, editIndex, plain, chordsMode, chordsAction, isLocked, currentActiveEdit, currentActiveShow, currentActiveStage, currentOverlays, currentRedoHistory, currentShowsCache, currentSpecial, currentStageShows, currentTemplates, html, autoSize })
    latest.current = { item, ref, index, editIndex, plain, chordsMode, chordsAction, isLocked, currentActiveEdit, currentActiveShow, currentActiveStage, currentOverlays, currentRedoHistory, currentShowsCache, currentSpecial, currentStageShows, currentTemplates, html, autoSize }

    const lineGap = item?.specialStyle?.lineGap
    const lineRadius = item?.specialStyle?.lineRadius || 0
    const lineBg = item?.specialStyle?.lineBg
    const lineStyleBox = lineGap ? `gap: ${lineGap}px;` : ""
    const lineStyleRadius = lineRadius ? `border-radius: ${lineRadius}px;` : ""
    const lineStyleBg = lineBg ? `background: ${lineBg};` : ""

    const shapeOutside = getStyles(item?.style)["shape-outside"]
    const shapeFloatSide = getShapeFloatSide(shapeOutside)

    const isAuto = item?.auto || (item?.textFit || "none") !== "none"
    const textArray = Array.isArray(item?.lines?.[0]?.text) ? item.lines[0].text : []
    const itemText = textArray.filter((a) => !a.customType?.includes("disableTemplate")) || []
    const itemFontSize = Number(getStyles((ref.type === "stage" ? item : itemText[0])?.style, true)?.["font-size"] || "")
    const itemStyle = item?.style

    function getStyle() {
        if (composing.current) return
        if (!plain && currentActiveEdit.slide === null) return

        const result = EditboxHelper.getStyleHtml(item, plain, currentStyle.current, ref.origin === "powerpoint")
        setHtml(result.html)
        currentStyle.current = result.currentStyle
        previousHTML.current = result.html
    }

    // keep DOM in sync when html changes programmatically
    useEffect(() => {
        const el = textElemRef.current
        if (!el) return
        if (el.innerHTML !== html) {
            el.innerHTML = html
        }
        previousHTML.current = html
    }, [html])

    function setCaretDelayed(line: number, pos: number) {
        setTimeout(() => {
            setCaret(textElemRef.current, { line, pos })
        }, 10)
    }

    async function refreshStyleAndRestoreCaret(caret: { line: number; pos: number }) {
        getStyle()
        await Promise.resolve()
        setTimeout(() => setCaret(textElemRef.current, caret), 0)
    }

    function storeCurrentCaretPos() {
        const sel = getSelectionRange()
        const caretLineIndex = sel.findIndex((line) => line.start !== undefined)
        if (caretLineIndex > -1) lastCaretPos.current = { line: caretLineIndex, pos: sel[caretLineIndex]?.start ?? -1, lineLength: getHTMLLineText(caretLineIndex).length }
    }

    function getHTMLLineText(lineIndex: number) {
        const textElem = textElemRef.current
        if (!textElem || !item) return ""

        let text = ""
        const lineElem = textElem.children[lineIndex]
        if (!lineElem) return ""
        Array.from(lineElem.childNodes).forEach((child: any) => {
            if (child.nodeName === "#text") text += child.textContent
            else text += child.innerText
        })

        return text.trim()
    }

    function getNewLines() {
        const textElem = textElemRef.current
        const { item, plain } = latest.current
        if (!textElem || !item) return []

        let newLines: Line[] = []
        let pos = -1
        currentStyle.current = ""
        let updateHTML = false

        const attrIndex = (elem: any, name: string, fallback: number) => {
            const value = Number(elem.getAttribute?.(name) ?? NaN)
            return isNaN(value) ? fallback : value
        }

        Array.from(textElem.children).forEach((line: any, i) => {
            const sourceLine = plain ? attrIndex(line, "data-line-index", i) : i
            let align: string = plain ? (typeof item.lines?.[sourceLine]?.align === "string" ? (item.lines?.[sourceLine]?.align as string) : "") : line.getAttribute("style") || ""
            align = align.replaceAll(latest.current.item?.specialStyle?.lineBg ? `background: ${latest.current.item.specialStyle.lineBg};` : "", "").replaceAll(latest.current.item?.specialStyle?.lineRadius ? `border-radius: ${latest.current.item.specialStyle.lineRadius}px;` : "", "") + ";"
            pos++
            const bg = latest.current.item?.specialStyle?.lineBg ? `background: ${latest.current.item.specialStyle.lineBg};` : ""
            const rad = latest.current.item?.specialStyle?.lineRadius ? `border-radius: ${latest.current.item.specialStyle.lineRadius}px;` : ""
            currentStyle.current += align + bg + rad

            let newLine = { align, text: [] as any[] }
            let lineChords: any[] = []

            newLines.push(newLine)

            Array.from(line.childNodes).forEach((child: any, j) => {
                if (child.nodeName === "#text") {
                    let lastNode = newLines[pos].text.length - 1
                    let originalLineStyle = item.lines?.[sourceLine]?.text?.[0]?.style || ""
                    let lastNodeStyle = lastNode >= 0 ? newLines[pos].text[lastNode]?.style || "" : ""

                    if (lastNode < 0 || !newLines[pos].text[lastNode] || (originalLineStyle && originalLineStyle !== lastNodeStyle)) {
                        newLines[pos].text.push({ style: originalLineStyle, value: child.textContent })
                    } else {
                        newLines[pos].text[lastNode].value += child.textContent
                    }

                    updateHTML = true
                    return
                }
                if (child.nodeName !== "SPAN") {
                    const strayText = child.nodeType === Node.ELEMENT_NODE ? (child.innerText || "").replaceAll("\n", "") : ""
                    if (strayText) {
                        let lastNode = newLines[pos].text.length - 1
                        if (lastNode < 0) newLines[pos].text.push({ style: item.lines?.[sourceLine]?.text?.[0]?.style || "", value: strayText })
                        else newLines[pos].text[lastNode].value += strayText
                        updateHTML = true
                    }
                    return
                }

                const sourceText = plain ? attrIndex(child, "data-text-index", j) : j
                let style = plain ? item.lines?.[sourceLine]?.text[sourceText]?.style || "" : child.getAttribute("style") || ""

                let lineText = child.innerText
                if (lineText === "\n") lineText = ""
                if (plain && !lineText && !style) {
                    style = item.lines?.[i - 1]?.text[0]?.style || ""
                    newLines[pos].align = newLines[pos - 1]?.align || ""
                }

                let customIndex = style.indexOf("--custom")
                if (customIndex > -1) style = style.slice(0, customIndex)

                let customType = child.getAttribute("data-customtype") || undefined
                let sourceDynamicKey = child.getAttribute("data-sourcedynamickey") || undefined

                const text: any = { style, value: lineText }
                if (customType) text.customType = customType
                if (sourceDynamicKey) text.sourceDynamicKey = sourceDynamicKey

                newLines[pos].text.push(text)

                currentStyle.current += style

                let storedChords = child.getAttribute("data-chords")
                if (storedChords) {
                    try {
                        const parsed = JSON.parse(storedChords)
                        lineChords.push(...parsed)
                    } catch (_err) {
                        return
                    }
                }
            })

            if (lineChords?.length) {
                newLines[pos].chords = lineChords

                const previousChordIds = newLines[pos - 1]?.chords?.map((a) => a.id) || []
                const shared = (a: any) => previousChordIds.includes(a.id)
                if (pos > 0 && newLines[pos].chords!.some(shared)) {
                    let breakPoint = newLines[pos - 1].text.reduce((textLength, text) => (textLength += text.value.length), 0)

                    newLines[pos - 1].chords = newLines[pos - 1].chords!.filter((a) => !shared(a) || a.pos < breakPoint)
                    newLines[pos].chords = newLines[pos].chords!.filter((a) => !shared(a) || a.pos >= breakPoint).map((a) => (shared(a) && a.pos >= breakPoint ? { ...a, pos: a.pos - breakPoint } : a))
                }
            }
        })

        if (pasting.current) return newLines

        const keyboardLineMutation = Date.now() - recentKeyboardLineMutationAt.current < 250

        if (updateHTML && !keyboardLineMutation) {
            let sel = getSelectionRange()
            let lineIndex = sel.findIndex((a) => a?.start !== undefined)
            if (lineIndex >= 0) {
                let caret = { line: lineIndex || 0, pos: sel[lineIndex]?.start || 0 }
                void refreshStyleAndRestoreCaret(caret)
            }
        }

        let caret: any = null
        let liveSel = getSelectionRange()
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
                    const lineStyle = item.lines?.[i]?.text?.[0]?.style || textStyle
                    newLines[i].text = [{ style: lineStyle, value: "" }]
                    caret = { line: i, pos: 0 }
                }
            })

            let sel = getSelectionRange()
            let currentLine = sel.findIndex((a) => a?.start !== undefined)
            let deleteKey = currentLine === lastCaretPos.current.line
            if (!caret && (item.lines || []).length > newLines.length) {
                if (liveCaret) {
                    caret = liveCaret
                } else if (deleteKey) {
                    caret = lastCaretPos.current
                } else {
                    let newLine = lastCaretPos.current.line > -1 ? lastCaretPos.current.line - 1 : newLines.length - 1
                    let newPos = lastCaretPos.current.pos > -1 ? getLineText(newLines[lastCaretPos.current.line - 1]).length - lastCaretPos.current.lineLength : getLineText(newLines[newLines.length - 1]).length
                    caret = { line: newLine, pos: newPos }
                }
            }
        }

        const structureChanged = (item.lines || []).length !== newLines.length || newLines.some((line, i) => (line.text?.length || 0) !== (item.lines?.[i]?.text?.length || 0))
        if (keyboardLineMutation && liveCaret && structureChanged) caret = liveCaret

        if (caret) {
            item.lines = newLines
            if (newLines.length > 0) void refreshStyleAndRestoreCaret(caret)

            lastCaretPos.current = caret
        } else {
            storeCurrentCaretPos()

            if (ref.type !== "show" && (item.lines || []).length < newLines.length) {
                setTimeout(() => setCaret(textElemRef.current, lastCaretPos.current), 20)
            }
        }

        return newLines
    }

    function updateLines(newLines: Line[] = []) {
        const { item, ref, index, editIndex, plain, currentActiveEdit, currentActiveShow, currentActiveStage, currentRedoHistory, currentShowsCache } = latest.current
        if (composing.current) return

        if (!newLines?.length) newLines = getNewLines()
        if (item) item.lines = newLines

        if (currentActiveEdit.type === "overlay") overlays.update(setNewLines)
        else if (currentActiveEdit.type === "template") templates.update(setNewLines)
        else if (ref.type === "stage") {
            stageShows.update((a) => {
                if (!a[currentActiveStage.id!]?.items?.[ref.id]) return a
                a[currentActiveStage.id!].items[ref.id].lines = newLines
                a[currentActiveStage.id!].modified = Date.now()
                return a
            })
        } else if (ref.id) {
            let lastRedo = currentRedoHistory[currentRedoHistory.length - 1] as { id?: string; oldData?: { previousData?: Array<{ lines?: Line[] }> } } | undefined
            if (lastRedo?.id === "SHOW_ITEMS") {
                let previousData = lastRedo.oldData?.previousData

                let historyText = previousData?.[index]?.lines?.reduce((text: string, line: Line) => (text += getLineText(line)), "") || ""
                let linesText = newLines.reduce((text, line) => (text += getLineText(line)), "")

                if (historyText === linesText) return
            }

            let lastChangedLine = EditboxHelper.determineCaretLine(item?.lines || [], newLines)
            const keyboardLineMutation = Date.now() - recentKeyboardLineMutationAt.current < 250
            const domSelection = window.getSelection()
            const anchorElem = (domSelection?.anchorNode as Element)?.nodeType === Node.ELEMENT_NODE ? (domSelection?.anchorNode as Element) : domSelection?.anchorNode?.parentElement
            const editingThisTextElem = !!textElemRef.current && (document.activeElement === textElemRef.current || anchorElem?.closest(".edit") === textElemRef.current)
            if (lastChangedLine > -1 && (item?.lines || []).length !== newLines.length && !keyboardLineMutation && !editingThisTextElem) setCaretDelayed(lastChangedLine, 0)
            updates.current++
            if (updates.current >= 15) {
                historyUpdateKey.current++
                updates.current = 0
            }
            let itemRef = (ref.showId || "") + ref.id + "_" + index + "_" + historyUpdateKey.current

            const lineStyleBg = latest.current.item?.specialStyle?.lineBg ? `background: ${latest.current.item.specialStyle.lineBg};` : ""
            const lineStyleRadius = latest.current.item?.specialStyle?.lineRadius ? `border-radius: ${latest.current.item.specialStyle.lineRadius}px;` : ""
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
                showsCache.update((a) => {
                    const storage = a[showId]?.slides?.[ref.id]?.customDynamicValues
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
                            .map((item: any, idx: number) => {
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
                })
            }

            history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([newLines]), slides: [ref.id], items: [index], showId: ref.showId }, location: { page: "none", override: itemRef } })

            if (plain) refreshListBoxes.set(editIndex)
        }

        function setNewLines(a: any) {
            if (!a[currentActiveEdit.id!]?.items?.[index]) return a

            a[currentActiveEdit.id!].items[index].lines = newLines

            a[currentActiveEdit.id!].modified = Date.now()
            return a
        }
    }

    function cancelScheduledAutoSize() {
        if (autoSizeFrame.current) cancelAnimationFrame(autoSizeFrame.current)
        if (autosizeTimeout.current) clearTimeout(autosizeTimeout.current)
        autoSizeFrame.current = 0
        autosizeTimeout.current = null
    }

    function runAutoSize() {
        const { plain, ref, item } = latest.current
        const alignElem = alignElemRef.current
        if (plain || !loaded.current || !alignElem || !(item?.auto || (item?.textFit || "none") !== "none")) return
        if (!alignElem.clientHeight) return

        let currentItemFontSize = Number(getStyles((ref.type === "stage" ? item : itemText[0])?.style, true)?.["font-size"] || "")

        const type = item?.textFit || "shrinkToFit"

        const signature = `${alignElem.clientWidth}x${alignElem.clientHeight}|${currentItemFontSize}|${type}|${item?.specialStyle?.lineGap || 0}|${previousHTML.current}`
        if (signature === lastSignature.current) return
        lastSignature.current = signature

        const defaultFontSize = type === "growToFit" ? 100 : currentItemFontSize
        const maxFontSize = type === "growToFit" ? currentItemFontSize : undefined

        const measureStart = performance.now()
        setAutoSize(autosize(alignElem, { type, textQuery: ".edit .break span", defaultFontSize, maxFontSize }))
        lastMeasureDuration.current = performance.now() - measureStart
    }

    function scheduleAutoSize(immediate = false) {
        const { plain, chordsMode, item, currentSpecial } = latest.current
        const isAuto = item?.auto || (item?.textFit || "none") !== "none"
        if (plain || !loaded.current || !isAuto || !alignElemRef.current || composing.current) return

        if (immediate) {
            cancelScheduledAutoSize()
            runAutoSize()
            return
        }

        const SLOW_MEASURE_MS = 6
        const DEBOUNCE_MS = 150

        if (chordsMode || lastMeasureDuration.current > SLOW_MEASURE_MS || currentSpecial.optimizedMode) {
            if (autosizeTimeout.current) clearTimeout(autosizeTimeout.current)
            autosizeTimeout.current = setTimeout(() => {
                autosizeTimeout.current = null
                runAutoSize()
            }, DEBOUNCE_MS)
            return
        }

        if (autoSizeFrame.current) return
        autoSizeFrame.current = requestAnimationFrame(() => {
            autoSizeFrame.current = 0
            runAutoSize()
        })
    }

    function cutInTwo({ e, sel, lines, currentIndex, textPos, start }: any) {
        const { ref, index, plain, currentActiveEdit } = latest.current
        if ((ref.type || "show") !== "show") return
        let { firstLines, secondLines } = EditboxHelper.cutLinesInTwo({ sel, lines, currentIndex, textPos, start })

        let localEditIndex = editIndex
        if (!plain && typeof currentActiveEdit.slide === "number") localEditIndex = currentActiveEdit.slide
        let domItemIndex = Number(e?.target?.closest(".editItem")?.getAttribute("data-index"))
        let editItemIndex: number = plain ? index : (currentActiveEdit.items[0] ?? (isNaN(domItemIndex) ? 0 : domItemIndex))

        let layoutRef = getLayoutRef()
        let slideRef = layoutRef[localEditIndex]
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
                showsCache.update((a) => {
                    const showId = ref.showId || currentActiveShow?.id || ""
                    if (a[showId]?.slides?.[ref.id]) a[showId].slides[ref.id].customDynamicValues = split.firstDV
                    return a
                })
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
        let parentsBefore = layoutRef.filter((a, i) => i < parentIndex && a.id === parentId)?.length
        let newIndex = (currentActiveEdit.slide ?? 0) + (parentsBefore + 1)

        if (!e?.target?.closest(".item")) {
            getStyle()
            return
        }

        activeEdit.set({ slide: newIndex, items: [0], showId: currentActiveShow?.id })
        setTimeout(() => {
            const elem = document.querySelector(".editItem")?.querySelector(".edit")
            if (elem) (elem as HTMLElement).focus()

            let selRange = getSelectionRange()
            const caret = { line: selRange.length - 1, pos: 999 }
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
            if ((e.target as HTMLElement).closest(".quickEdit") && Number((e.target as HTMLElement).closest(".quickEdit")?.getAttribute("data-index")) !== latest.current.editIndex) return
            if (!(e.target as HTMLElement).closest(".quickEdit") && !latest.current.currentActiveEdit.items.includes(latest.current.index)) return

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
            recentKeyboardLineMutationAt.current = Date.now()
        }

        if (e.ctrlKey || e.metaKey) {
            if (isFormattingKey(e.nativeEvent)) e.preventDefault()
        }

        if (getNormalizedKey(e.nativeEvent).toLowerCase() === "v" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            EditboxPaste.handlePaste(
                e.nativeEvent,
                {
                    item,
                    ref,
                    textElem: textElemRef.current || undefined,
                    lastCaretPos: lastCaretPos.current,
                    getNewLines,
                    updateLines,
                    getStyle,
                    setPasting: (p) => {
                        pasting.current = p
                    }
                },
                e.shiftKey
            )
        }

        if (e.key === "<") {
            if (item?.lines?.some((line) => line.text?.some((text) => text.style?.toLowerCase()?.includes("bamini")))) {
                e.preventDefault()
                document.execCommand("insertHTML", false, "ஈ")
                return
            }

            newToast("Note: < is treated as HTML")
        }
    }

    function handleCopy(e: React.ClipboardEvent<HTMLDivElement>) {
        EditboxPaste.handleCopy(e.nativeEvent, getNewLines())
    }

    function handleCut(e: React.ClipboardEvent<HTMLDivElement>) {
        EditboxPaste.handleCut(e.nativeEvent, getNewLines(), paste)
    }

    function paste(e: any, clipboardText?: string, clipboardHtml?: string) {
        EditboxPaste.paste(e, clipboardText, clipboardHtml, {
            item,
            ref,
            textElem: textElemRef.current || undefined,
            lastCaretPos: lastCaretPos.current,
            getNewLines,
            updateLines,
            getStyle,
            setPasting: (p) => {
                pasting.current = p
            }
        })
    }

    // mount
    useEffect(() => {
        getStyle()

        const timeout = setTimeout(() => {
            loaded.current = true
            setAutoSize(item?.autoFontSize || 0)

            scheduleAutoSize(true)

            document.fonts?.ready?.then(() => scheduleAutoSize(true))
        }, 50)

        window.addEventListener("keydown", keydown)
        return () => {
            clearTimeout(timeout)
            window.removeEventListener("keydown", keydown)
            cancelScheduledAutoSize()
            if (updateTimeout.current) clearTimeout(updateTimeout.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // slide change
    useEffect(() => {
        if (currentActiveEdit.slide !== null && currentActiveEdit.slide !== undefined && currentActiveEdit.slide !== currentSlide.current && !composing.current) {
            currentSlide.current = currentActiveEdit.slide
            setTimeout(getStyle, 10)
        }
    }, [currentActiveEdit.slide])

    // style hash change
    useEffect(() => {
        let s = ""
        clone(item?.lines)?.forEach((line: Line) => {
            let align = (typeof line.align === "string" ? line.align : "").replaceAll(lineStyleBg, "").replaceAll(lineStyleRadius, "") + ";"
            s += align + lineStyleBg + lineStyleRadius
            if (!line?.text) return
            if (!Array.isArray(line.text)) line.text = []
            line.text.forEach((a) => {
                s += EditboxHelper.getTextStyle(a)
            })
        })

        if (currentStyle.current.replaceAll(";", "") !== s.replaceAll(";", "") && !composing.current) getStyle()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item?.lines, lineStyleBg, lineStyleRadius])

    // chords updated
    useEffect(() => {
        const newChords = JSON.stringify(item?.lines?.map((a) => a.chords?.map((c) => c.key)))
        if (previousChords.current !== newChords) {
            previousChords.current = newChords
            getStyle()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item?.lines])

    // detect external html changes (not from composition)
    useEffect(() => {
        if (textElemRef.current && html !== previousHTML.current && !composing.current) {
            previousHTML.current = html
            setTimeout(() => updateLines(), 10)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [html])

    // shape offset
    useEffect(() => {
        if (shapeOutside && textElemRef.current && (html || item?.align)) {
            setTimeout(() => setShapeOffsetTop(calculateShapeVerticalOffset(textElemRef.current, item?.align as string | undefined)))
        }
    }, [shapeOutside, html, item?.align])

    // autosize triggers
    useEffect(() => {
        if (html || itemStyle || isAuto || itemFontSize || lineGap) scheduleAutoSize()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [html, itemStyle, isAuto, itemFontSize, lineGap, chordsMode])

    if (!item?.lines) return null

    const alignStyle = plain ? undefined : (item.align as string | undefined) || undefined
    const shapeStyle = shapeOutside ? `--shape-outside: ${shapeOutside};--shape-float: ${shapeFloatSide};--shape-offset-top: ${shapeOffsetTop}px;` : ""
    const justifyStyle = plain ? "" : typeof item.align === "string" ? item.align.replace("align-items", "justify-content") : ""
    const editStyle = `${shapeStyle}${isAuto && autoSize && !plain ? `--auto-size: ${autoSize}px;` : ""}${!plain ? lineStyleBox : ""}${justifyStyle}`

    return (
        <div ref={alignElemRef} className={`align ${styles.align} ${chordsMode ? `chords ${styles.chords}` : ""} ${plain ? `plain ${styles.plain}` : ""}`} style={plain ? undefined : cssTextToStyle(alignStyle || "")}>
            {item.lines?.length < 2 && !getItemText(item).length ? (
                <span className={`placeholder ${styles.placeholder}`}>
                    <p>{chordsMode ? <T id="edit.chords" /> : <T id="empty.text" />}</p>
                </span>
            ) : null}
            {isLocked ? (
                <div className={`edit ${styles.edit} ${shapeOutside ? `hasShapeOutside ${styles.hasShapeOutside}` : ""}`} style={cssTextToStyle(`${shapeStyle}${justifyStyle}`)} dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
                <>
                    {chordsMode ? <EditboxChords item={item} autoSize={autoSize} index={index} ref={ref} chordsMode={chordsMode} chordsAction={chordsAction} /> : null}
                    <div
                        ref={textElemRef}
                        onMouseUp={() => storeCurrentCaretPos()}
                        className={`edit context ${plain ? "#editbox_text" : "#edit_box__editbox_text"} ${styles.edit} ${chordsMode ? `hidden ${styles.hidden}` : ""} ${shapeOutside ? `hasShapeOutside ${styles.hasShapeOutside}` : ""} ${isAuto && autoSize && !plain ? `autoSize ${styles.autoSize}` : ""} ${item.lines?.length < 2 && !item.lines?.[0]?.text[0]?.value.length ? `height ${styles.height}` : ""} ${chordsMode ? `tallLines ${styles.tallLines}` : ""}`}
                        contentEditable
                        suppressContentEditableWarning
                        onKeyDown={textElemKeydown}
                        onInput={() => scheduleAutoSize()}
                        onCompositionStart={() => {
                            composing.current = true
                        }}
                        onCompositionEnd={() => {
                            composing.current = false
                            scheduleAutoSize(true)
                        }}
                        onBlur={() => {
                            composing.current = false
                        }}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        style={cssTextToStyle(editStyle)}
                    />
                </>
            )}
        </div>
    )
}

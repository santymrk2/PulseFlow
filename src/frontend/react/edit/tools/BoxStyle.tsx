// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react"
import type { CustomFont, Item, ItemType, Slide } from "../../../../types/Show"
import { activeEdit, activePopup, activeShow, alertMessage, categories, styles as outputStyles, overlays, selected, shownTips, showsCache, special, templates, theme, themes, timers } from "../../../stores"
import { getNormalizedKey, isFormattingKey } from "../../../utils/shortcuts"
import { newToast } from "../../../utils/common"
import { clone } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { getExtension, getMediaType } from "../../../components/helpers/media"
import { getAllEnabledOutputs } from "../../../components/helpers/output"
import { getCustomMetadata, getLayoutRef, initializeMetadata } from "../../../components/helpers/show"
import { _show } from "../../../components/helpers/shows"
import { getStyles } from "../../../components/helpers/style"
import { MAX_FONT_SIZE } from "../../../components/edit/scripts/autosize"
import { addFilterString, addStyle, addStyleString, getItemStyleAtPos, getItemText, getLastLineAlign, getLineText, getSelectionRange } from "../../../components/edit/scripts/textStyle"
import { itemBoxes, setBoxInputValue } from "../../../components/edit/values/boxes"
import { useStore } from "../../hooks/useStore"
import { EditValues } from "./EditValues"

export interface BoxStyleProps {
    id: ItemType
    allSlideItems?: Item[]
    item?: Item | null
    customLocalFonts?: CustomFont[]
}

const formatting: Record<string, () => { id: string; key: string; value: string }> = {
    b: () => ({ id: "style", key: "font-weight", value: "bold" }),
    i: () => ({ id: "style", key: "font-style", value: "italic" }),
    u: () => ({ id: "style", key: "text-decoration", value: "underline" })
}

const setItemStyleTypes = ["timer", "clock", "icon", "events", "camera", "variable", "web", "slide_tracker", "table"]

export function BoxStyle({ id, allSlideItems = [], item = null, customLocalFonts = [] }: BoxStyleProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentActivePopup = useStore(activePopup)
    const currentActiveShow = useStore(activeShow)
    const currentAlertMessage = useStore(alertMessage)
    const currentCategories = useStore(categories)
    const currentOutputStyles = useStore(outputStyles)
    const currentOverlays = useStore(overlays)
    const currentSelected = useStore(selected)
    const currentShownTips = useStore(shownTips)
    const currentShowsCache = useStore(showsCache)
    const currentSpecial = useStore(special)
    const currentTemplates = useStore(templates)
    const currentTheme = useStore(theme)
    const currentThemes = useStore(themes)
    const currentTimers = useStore(timers)

    void currentActivePopup
    void currentAlertMessage
    void currentOutputStyles
    void currentShownTips
    void currentSpecial
    void currentTheme
    void currentTimers

    const [selection, setSelection] = useState<null | { start: number; end: number }[]>(null)
    const [activeRowIdx, setActiveRowIdx] = useState(-1)
    const [activeColIdx, setActiveColIdx] = useState(-1)
    const [loaded, setLoaded] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [shownTemplateTip, setShownTemplateTip] = useState(false)
    const changesRef = useRef<{ [key: string]: { [key: string]: string } }>({})
    const [changesTick, setChangesTick] = useState(0)

    const allSlideItemsLatest = useRef(allSlideItems)
    allSlideItemsLatest.current = allSlideItems
    const itemLatest = useRef(item)
    itemLatest.current = item
    const selectionLatest = useRef(selection)
    selectionLatest.current = selection
    const activeEditLatest = useRef(currentActiveEdit)
    activeEditLatest.current = currentActiveEdit

    const setBox = () => clone(itemBoxes[id])!
    const [box, setBoxState] = useState<ReturnType<typeof setBox>>(() => setBox())

    useEffect(() => {
        if (!currentActiveEdit.items.length) {
            setSelection(null)
        }
    }, [currentActiveEdit.items.length])

    function getTextSelection(e: Event | null = null) {
        if (e) {
            const t = e.target as HTMLElement | null
            if (t?.closest(".menus") || t?.closest(".popup") || t?.closest(".drawer") || t?.closest(".chords") || t?.closest(".contextMenu") || t?.closest(".editTools")) return
        }

        const activeEl = document.activeElement as HTMLElement | null
        if (activeEl?.closest(".tools") || activeEl?.closest(".menus") || activeEl?.closest(".popup") || activeEl?.closest(".drawer") || activeEl?.closest(".chords") || activeEl?.closest(".contextMenu") || activeEl?.closest(".editTools") || document.querySelector(".editTools:hover")) return

        const sel = window.getSelection()

        if (sel?.type === "None") {
            if (activeEl === document.body) return
            setSelection(null)
            setActiveRowIdx(-1)
            setActiveColIdx(-1)
            return
        }

        const anchorElem = (sel?.anchorNode as Element)?.nodeType === Node.ELEMENT_NODE ? (sel?.anchorNode as Element) : sel?.anchorNode?.parentElement
        if (!anchorElem?.closest?.(".edit")) {
            setActiveRowIdx(-1)
            setActiveColIdx(-1)
            return
        }

        const cellEditElem = anchorElem?.closest(".cell-content.edit")
        const td = cellEditElem?.closest("td")
        setActiveRowIdx(td ? parseInt(td.getAttribute("data-row") || "", 10) : -1)
        setActiveColIdx(td ? parseInt(td.getAttribute("data-col") || "", 10) : -1)

        setSelection(getSelectionRange() as { start: number; end: number }[] | null)
    }

    useEffect(() => {
        getTextSelection()

        const selectionChangeListener = () => getTextSelection()
        document.addEventListener("selectionchange", selectionChangeListener)

        if (allSlideItems.length === 1 && item && !getItemText(item).length && !currentActiveEdit.items.length) {
            activeEdit.update((a) => ({ ...(a || {}), items: [0] }))
            const elem = document.querySelector(".editItem")?.querySelector(".edit")
            if (elem) (elem as HTMLElement).focus()
        }

        return () => {
            document.removeEventListener("selectionchange", selectionChangeListener)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function mousedown(e: MouseEvent) {
        if (e.target.closest(".tools") || e.target.closest(".menus") || e.target.closest(".popup") || e.target.closest(".drawer") || e.target.closest(".chords") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) getTextSelection(e)
    }

    function keyup(e: KeyboardEvent) {
        if (e.key.includes("Arrow") || e.key === "Home" || e.key === "End" || getNormalizedKey(e).toUpperCase() === "A") getTextSelection(e)
    }

    function getFormattingShortcut(e: KeyboardEvent) {
        if (!isFormattingKey(e)) return null
        return formatting[getNormalizedKey(e).toLowerCase()] || null
    }

    function getSelectionPoint(editElem: Element, line: number, pos: number) {
        const lineElem = editElem.childNodes[line]
        if (!lineElem) return null

        let count = 0
        const lineChildren = Array.from(lineElem.childNodes)
        for (const [childIndex, child] of lineChildren.entries()) {
            const textLength = (child as HTMLElement).innerText?.replaceAll("\n", "")?.length ?? child.textContent?.length ?? 0
            const isLastChild = childIndex === lineChildren.length - 1
            if (pos <= count + textLength || isLastChild) {
                const localOffset = Math.max(0, pos - count)

                if (child.nodeType === Node.TEXT_NODE) {
                    const nodeLength = child.textContent?.length ?? 0
                    return { node: child, offset: Math.min(nodeLength, localOffset) }
                }

                const textNode = child.childNodes?.[0]
                if (!textNode || textNode.nodeName === "BR") return { node: child, offset: 0 }

                if (textNode.nodeType === Node.TEXT_NODE) {
                    const nodeLength = textNode.textContent?.length ?? 0
                    return { node: textNode, offset: Math.min(nodeLength, localOffset) }
                }

                const nodeLength = textNode.textContent?.length ?? 0
                return { node: textNode, offset: Math.min(nodeLength, localOffset) }
            }

            count += textLength
        }

        return null
    }

    function isSelectionBackward(sel: Selection) {
        if (!sel.anchorNode || !sel.focusNode) return false
        if (sel.anchorNode === sel.focusNode) return sel.anchorOffset > sel.focusOffset

        const position = sel.anchorNode.compareDocumentPosition(sel.focusNode)
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return true
        return false
    }

    function restoreTextSelection(editElem: Element, savedSelection: { start: number; end: number }[], keepBackwardSelection = false) {
        const selectedLines = savedSelection.map((line, i) => ({ ...line, line: i })).filter((line) => line.start !== undefined && line.end !== undefined)

        if (!selectedLines.length) return false

        const first = selectedLines[0]
        const last = selectedLines[selectedLines.length - 1]
        const startPoint = getSelectionPoint(editElem, first.line, first.start)
        const endPoint = getSelectionPoint(editElem, last.line, last.end)
        if (!startPoint || !endPoint) return false

        const range = document.createRange()
        try {
            range.setStart(startPoint.node, startPoint.offset)
            range.setEnd(endPoint.node, endPoint.offset)
        } catch {
            return false
        }

        const sel = window.getSelection()
        if (!sel) return false

        const selExt = sel as Selection & { setBaseAndExtent?: (anchorNode: Node, anchorOffset: number, focusNode: Node, focusOffset: number) => void }
        if (selExt.setBaseAndExtent) {
            if (keepBackwardSelection) selExt.setBaseAndExtent!(endPoint.node, endPoint.offset, startPoint.node, startPoint.offset)
            else selExt.setBaseAndExtent!(startPoint.node, startPoint.offset, endPoint.node, endPoint.offset)
        } else {
            sel.removeAllRanges()
            sel.addRange(range)
        }

        return true
    }

    function keydown(e: KeyboardEvent) {
        const shortcut = getFormattingShortcut(e)
        if ((!e.ctrlKey && !e.metaKey) || !shortcut) return

        const liveSelection = getSelectionRange()
        const hasSelectionRange = !!liveSelection?.some((line: { start?: number; end?: number }) => line.start !== undefined && line.end !== undefined && line.start !== line.end)
        if (!hasSelectionRange) return

        e.preventDefault()

        const selectionSnapshot = liveSelection.map((line: { start?: number; end?: number }) => ({ ...line }))
        setSelection(selectionSnapshot.map((line) => ({ ...line })) as { start: number; end: number }[])
        const currentDomSelection = window.getSelection()
        const backwardSelection = currentDomSelection ? isSelectionBackward(currentDomSelection) : false

        const value = shortcut()

        if (value.key === "text-decoration") {
            const currentVal = currentStyles[value.key] || ""
            let parts = currentVal.split(" ").filter((p: string) => p)
            if (parts.includes(value.value)) parts = parts.filter((p: string) => p !== value.value)
            else parts.push(value.value)
            value.value = parts.join(" ")
        } else if ((currentStyles[value.key] || "").includes(value.value)) {
            value.value = ""
        }

        updateValue({ detail: value })

        requestAnimationFrame(() => {
            const editElem = document.querySelector(".editArea")?.querySelectorAll(".editItem")?.[currentActiveEdit.items[0]]?.querySelector(".edit")
            if (!editElem) return

            restoreTextSelection(editElem, selectionSnapshot, backwardSelection)

            setSelection(selectionSnapshot.map((line) => ({ ...line })) as { start: number; end: number }[])
        })
    }

    useEffect(() => {
        window.addEventListener("keyup", keyup)
        window.addEventListener("keydown", keydown)
        window.addEventListener("mouseup", getTextSelection)
        window.addEventListener("mousedown", mousedown)
        return () => {
            window.removeEventListener("keyup", keyup)
            window.removeEventListener("keydown", keydown)
            window.removeEventListener("mouseup", getTextSelection)
            window.removeEventListener("mousedown", mousedown)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [box, id, item, allSlideItems, currentActiveEdit, currentActiveShow, currentSelected, currentShowsCache, currentCategories, currentOutputStyles, currentOverlays, currentTemplates, currentThemes, currentTheme, currentTimers, currentShownTips])

    useEffect(() => {
        setBoxState(setBox())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentActiveEdit.id, currentActiveShow?.id, currentActiveEdit.slide, id])

    // selection
    const style = item?.lines ? getItemStyleAtPos(item.lines, selection as never) : item?.type === "table" && activeRowIdx >= 0 && activeColIdx >= 0 && item.table?.rows?.[activeRowIdx]?.cells?.[activeColIdx] ? item.table.rows[activeRowIdx].cells[activeColIdx].style || "" : item?.style || ""
    const currentStyles = useMemo(() => getStyles(style, true) as Record<string, string>, [style])

    const lineAlignStyle = item?.lines ? getStyles(getLastLineAlign(item, selection as never)) : getStyles(item?.align)
    const alignStyle = item?.align ? getStyles(item.align) : {}

    const customValues = {
        "text-align": lineAlignStyle["text-align"] || "center",
        "align-items": alignStyle["align-items"] || "center"
    }

    const computedBox = useMemo(() => {
        const b = clone(box)
        if (currentActiveEdit.type === "overlay" && b?.sections?.chords) {
            delete b.sections.chords
        }

        if (b?.sections?.CSS && id !== "captions") {
            setBoxInputValue(b, "CSS", "CSS_text", "value", style)
        }

        if (b?.sections?.font) {
            setBoxInputValue(b, "font", "font-size", "disabled", item?.textFit !== "none")
            setBoxInputValue(b, "font", "textFit", "value", item?.textFit || (id === "table" ? "none" : "growToFit"))
        }

        if (id === "text") {
            setBoxInputValue(b, "default", "font-family", "styleValue", getStyles(style)["font"] || "")
            setBoxInputValue(b, "lines", "specialStyle.lineRadius", "hidden", !item?.specialStyle?.lineRadius && !item?.specialStyle?.lineBg)
            setBoxInputValue(b, "default", "textFit", "value", item?.auto ? "shrinkToFit" : "none")
        }

        if (id === "media" && item) {
            const extension = getExtension(item.src || "")
            const isVideo = getMediaType(extension) === "video"
            setBoxInputValue(b, "default", "muted", "hidden", !isVideo)
            setBoxInputValue(b, "default", "loop", "hidden", !isVideo)
            setBoxInputValue(b, "default", "speed", "hidden", !isVideo)
        }

        if (id === "camera" && item) {
            if (item.device) {
                setBoxInputValue(b, "default", "device", "value", item.device)
                setBoxInputValue(b, "default", "device", "values", { name: item.device.name || item.device.id || "live.cameras" })
            }
            if (item.device?.name) setBoxInputValue(b, "default", "device", "name", item.device.name)
            if (item.device?.type) setBoxInputValue(b, "default", "device", "icon", item.device.type === "ndi" ? "ndi" : item.device.type === "omt" ? "omt" : item.device.type === "screen" ? "screen" : item.device.type === "blackmagic" ? "blackmagic" : "camera")
        }

        if (id === "timer" && item) {
            setBoxInputValue(b, "default", "timer.circleMask", "hidden", item.timer?.viewType !== "circle")
            const timer = currentTimers[item.timer?.id || ""]
            const timerLength = Math.abs((timer?.start || 0) - (timer?.end || 0))
            setBoxInputValue(b, "default", "timer.showHours", "value", item.timer?.showHours !== false)
            setBoxInputValue(b, "default", "timer.showHours", "hidden", (item.timer?.viewType || "time") !== "time" || timerLength < 3600)
            setBoxInputValue(b, "default", "timer.padding", "value", item.timer?.padding !== false)
            setBoxInputValue(b, "default", "timer.padding", "hidden", (item.timer?.viewType || "time") !== "time")
        }

        if (id === "clock" && item) {
            const clockType = item.clock?.type || "digital"
            const dateFormat = item.clock?.dateFormat || "none"
            const customFormat = item.clock?.customFormat || ""
            const showOffsetDays = clockType === "custom" && /[MDY]/.test(customFormat)

            setBoxInputValue(b, "default", "clock.dateFormat", "hidden", clockType !== "digital")
            setBoxInputValue(b, "default", "clock.showTime", "hidden", clockType !== "digital" || dateFormat === "none")
            setBoxInputValue(b, "default", "clock.seconds", "hidden", clockType === "custom" || (clockType === "digital" && item.clock?.showTime === false && dateFormat !== "none"))
            setBoxInputValue(b, "default", "clock.customFormat", "hidden", clockType !== "custom")
            setBoxInputValue(b, "default", "clock.offsetDays", "hidden", !showOffsetDays)
            setBoxInputValue(b, "default", "tip", "hidden", clockType !== "custom")
        }

        if (id === "slide_tracker" && item) {
            setBoxInputValue(b, "default", "tracker.accent", "value", item.tracker?.accent || currentThemes[currentTheme]?.colors?.secondary || "#F0008C")

            const defaultMetadataKeys = Object.keys(initializeMetadata({}))
            const metadataOptions = [{ value: "name", label: "show.name" }, ...Object.keys(getCustomMetadata()).map((key) => ({ value: key, label: defaultMetadataKeys.includes(key) ? `meta.${key}` : key }))]
            setBoxInputValue(b, "default", "tracker.projectMetadata", "options", metadataOptions)

            setBoxInputValue(b, "default", "tracker.childProgress", "hidden", item.tracker?.type !== "group")
            setBoxInputValue(b, "default", "tracker.oneLetter", "hidden", item.tracker?.type !== "group")
            setBoxInputValue(b, "default", "tracker.projectMetadata", "hidden", item.tracker?.type !== "project")
        }

        if (id === "events" && item) {
            setBoxInputValue(b, "default", "events.startDaysFromToday", "disabled", !!item.events?.enableStartDate)
            setBoxInputValue(b, "default", "events.startDate", "hidden", !item.events?.enableStartDate)
            setBoxInputValue(b, "default", "events.startTime", "hidden", !item.events?.enableStartDate)
            setBoxInputValue(b, "default", "events.fromTime", "hidden", !item.events?.justOneDay)
            setBoxInputValue(b, "default", "events.toTime", "hidden", !item.events?.justOneDay)
        }

        if (id === "chart" && item) {
            setBoxInputValue(b, "default", "chart.holeSize", "hidden", item.chart?.type !== "pie")
            setBoxInputValue(b, "default", "chart.holeSize", "value", item.chart?.holeSize ?? 0)
        }

        return b
    }, [box, id, item, style, currentActiveEdit.type, currentThemes, currentTheme, currentTimers])

    const boxSections = computedBox?.sections || {}

    function getSelectedItem() {
        if (currentActiveEdit.id) {
            if (currentActiveEdit.type === "overlay") {
                return clone(currentOverlays[currentActiveEdit.id]?.items?.[currentActiveEdit.items[0]])
            }
            if (currentActiveEdit.type === "template") {
                return clone(currentTemplates[currentActiveEdit.id]?.items?.[currentActiveEdit.items[0]])
            }
        }

        const slideId = getLayoutRef()?.[currentActiveEdit.slide!]?.id
        const slide = clone(_show().slides([slideId]).get()[0]) as Slide

        return slide?.items?.[currentActiveEdit.items[0]]
    }

    function setValue(input: { id: string; key?: string; value: unknown }, allItems: number[]) {
        let value: unknown = input.value
        if (input.id === "filter") value = addFilterString(item?.filter || "", [input.key, value])
        else if (input.id === "align" && item?.type === "table") value = addStyleString(item?.align || "", [input.key, value])
        else if (input.key === "text-align") value = `text-align: ${value};`
        else if (input.key) value = { ...(((item as Record<string, unknown>)?.[input.key] as Record<string, unknown>) || {}), [input.key]: value }

        let targetId = input.id
        if (input.id.includes(".")) {
            const splitted = input.id.split(".")
            const selectedItem = getSelectedItem()
            if (!selectedItem) return

            targetId = splitted[0]

            let newValue = selectedItem[splitted[0]]
            if (typeof newValue !== "object" || newValue === null) newValue = {}
            else newValue = clone(newValue)

            newValue[splitted[1]] = input.value
            value = newValue
        }

        if (id === "text") {
            let newFontSize = 0
            if (input.id === "textFit") {
                if (input.value !== "growToFit" && Number(currentStyles["font-size"]) < 200) {
                    newFontSize = 0
                } else {
                    newFontSize = input.value !== "growToFit" ? 100 : MAX_FONT_SIZE
                }
            } else if (input.id === "auto" && item?.textFit === "growToFit") {
                if (input.value && Number(currentStyles["font-size"]) < MAX_FONT_SIZE) newFontSize = MAX_FONT_SIZE
                else if (!input.value && Number(currentStyles["font-size"]) === MAX_FONT_SIZE) newFontSize = 100
            }
            if (newFontSize) updateValue({ detail: { name: "font_size", id: "style", key: "font-size", value: newFontSize + "px" } })
        }

        if (currentActiveEdit.id) {
            if (currentActiveEdit.type === "overlay") overlays.update(updateItemValues)
            else if (currentActiveEdit.type === "template") templates.update(updateItemValues)

            return
        }

        history({
            id: "setItems",
            newData: { style: { key: targetId, values: [value] } },
            location: { page: "edit", show: currentActiveShow!, slide: getLayoutRef()[currentActiveEdit.slide!]?.id, items: allItems }
        })

        return

        function updateItemValues(a: Record<string, { items?: Item[]; modified?: number }>) {
            if (!a[currentActiveEdit.id!]?.items) return a

            allItems.forEach((i: number) => {
                if (!a[currentActiveEdit.id!].items[i]) return

                if (!targetId.includes(".")) {
                    a[currentActiveEdit.id!].items[i][targetId] = value
                    return
                }

                const splitted = targetId.split(".")
                const nested = a[currentActiveEdit.id!].items[i][splitted[0]]
                if (typeof nested !== "object" || nested === null) {
                    a[currentActiveEdit.id!].items[i][splitted[0]] = {}
                }
                a[currentActiveEdit.id!].items[i][splitted[0]][splitted[1]] = value
            })

            a[currentActiveEdit.id!].modified = Date.now()
            return a
        }
    }

    function isPartialTextSelection() {
        const sel = selectionLatest.current
        if (!sel?.length || !sel.some((a) => a?.start !== undefined && a.start !== a.end)) return false
        const currentItem = itemLatest.current
        if (!currentItem?.lines?.length) return false
        return !currentItem.lines.every((line, i) => sel[i]?.start === 0 && sel[i]?.end === getLineText(line).length)
    }

    function disableAutoSize(items: number[]) {
        if (currentActiveEdit.id) {
            if (currentActiveEdit.type === "overlay") overlays.update(updateAutoSize)
            else if (currentActiveEdit.type === "template") templates.update(updateAutoSize)
            return
        }

        const location = { page: "edit" as const, show: currentActiveShow!, slide: getLayoutRef()[currentActiveEdit.slide!]?.id, items }
        history({ id: "setItems", newData: { style: { key: "textFit", values: ["none"] } }, location: { ...location, id: "textFit" } })
        history({ id: "setItems", newData: { style: { key: "auto", values: [false] } }, location: { ...location, id: "auto" } })

        function updateAutoSize(a: Record<string, { items?: Item[]; modified?: number }>) {
            if (!a[currentActiveEdit.id!]?.items) return a
            items.forEach((i) => {
                if (!a[currentActiveEdit.id!].items[i]) return
                a[currentActiveEdit.id!].items[i].textFit = "none"
                a[currentActiveEdit.id!].items[i].auto = false
            })
            a[currentActiveEdit.id!].modified = Date.now()
            return a
        }
    }

    function updateValue(e: unknown) {
        const input = e?.detail ?? e
        const currentItem = itemLatest.current
        const currentAllSlideItems = allSlideItemsLatest.current

        const sel = window.getSelection()
        const anchorNode = sel?.anchorNode
        const cellEditElem = anchorNode && (anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement)?.closest(".cell-content.edit")
        const td = cellEditElem?.closest("td")
        const rowIdx = td ? parseInt(td.getAttribute("data-row") || "", 10) : -1
        const colIdx = td ? parseInt(td.getAttribute("data-col") || "", 10) : -1

        if (currentItem?.type === "table" && rowIdx >= 0 && colIdx >= 0 && input.key && currentItem.table?.rows?.[rowIdx]?.cells?.[colIdx]) {
            let allItems: number[] = [...currentActiveEdit.items]
            if (!allItems.length) currentAllSlideItems.forEach((_item, i) => allItems.push(i))
            let cellStyle = currentItem.table.rows[rowIdx].cells[colIdx].style || ""
            cellStyle = addStyleString(cellStyle, [input.key, input.value])
            currentItem.table.rows[rowIdx].cells[colIdx].style = cellStyle
            setValue({ id: "table", value: currentItem.table }, allItems)
            return
        }

        let allItems: number[] = [...currentActiveEdit.items]
        if (!allItems.length) currentAllSlideItems.forEach((_item, i) => allItems.push(i))
        const clonedSlideItems = clone(currentAllSlideItems)

        if ((currentActiveEdit.type || "show") === "show") allItems = allItems.reverse()

        const currentType = id || clonedSlideItems[allItems[0]]?.type || "text"
        allItems = allItems.filter((index) => (clonedSlideItems[index]?.type || "text") === currentType)

        const hasScriptureNumber = currentItem?.lines?.some((line) => line.text?.some((t) => /scripture(?:\d+)?_number/.test(t.value || "")))
        if (id === "text" && input.id === "style" && input.key === "font-size" && input.name !== "font_size" && (currentItem?.auto || (currentItem?.textFit || "none") !== "none") && isPartialTextSelection() && !hasScriptureNumber) {
            disableAutoSize(allItems)
            newToast("toast.autosize_disabled")
        }

        const normalizedInput = { ...input }
        if (normalizedInput.id === "nowrap") {
            normalizedInput.id = "style"
            normalizedInput.key = "white-space"
            normalizedInput.value = normalizedInput.value ? "nowrap" : undefined
        }

        if (normalizedInput.id !== "style" && !normalizedInput.id.includes("CSS")) {
            setValue(normalizedInput, allItems)
            return
        }

        const aligns = normalizedInput.key === "align-items" || normalizedInput.key === "text-align"

        if (normalizedInput.id.includes("CSS")) allItems = [allItems[0]]

        const ref = getLayoutRef()
        const slides: string[] = [ref[currentActiveEdit.slide ?? ""]?.id || "other"]
        const slideItems: number[][] = [allItems]
        const showSlides = currentShowsCache[currentActiveShow?.id || ""]?.slides || {}

        if (slides[0] && currentSelected.id === "slide" && Array.isArray(currentSelected.data)) {
            const selectedSlides = currentSelected.data.filter(({ index }: { index: number }) => index !== currentActiveEdit.slide!)
            slides.push(...selectedSlides.map(({ index }: { index: number }) => ref[index]?.id))

            slides.forEach((sid, i) => {
                if (!sid || i === 0) return
                if (!showSlides[sid]) {
                    slideItems.push([])
                    return
                }

                let currentItemIndexes = showSlides[sid].items.map((_item: unknown, idx: number) => idx)
                currentItemIndexes = currentItemIndexes.filter((index: number) => (showSlides[sid].items[index].type || "text") === currentType)
                slideItems.push(currentItemIndexes)
            })
        }

        const values: { [key: string]: unknown[] } = {}
        slides.forEach((slide, i) => {
            if (!slideItems[i]?.length) return
            values[slide] = []
            slideItems[i].forEach((itemIndex) => getNewItemValues(clone(showSlides[slide]?.items?.[itemIndex] || clonedSlideItems[itemIndex]), slide))
        })

        function getNewItemValues(currentSlideItem: Item, slideId: string) {
            if (!currentSlideItem) return

            let selectedRange = selectionLatest.current
            if (!selectedRange?.length || !selectedRange?.filter((a) => a.start !== a.end).length) {
                selectedRange = []
                currentSlideItem.lines?.forEach((line) => {
                    selectedRange!.push({ start: 0, end: getLineText(line).length })
                })
            }

            if (normalizedInput.key === "text-align") {
                const newAligns: string[] = []
                currentSlideItem.lines?.forEach((line, linePos) => {
                    if (!selectionLatest.current?.length || selectionLatest.current[linePos]?.start !== undefined) newAligns.push(`${normalizedInput.key}: ${normalizedInput.value};`)
                    else newAligns.push(line.align)
                })
                values[slideId].push(newAligns)
            } else if (currentSlideItem.lines) {
                if (normalizedInput.id.includes("CSS")) {
                    values[slideId].push(addStyle(selectedRange as never, currentSlideItem, normalizedInput.value).lines!.map((a) => a.text))
                } else {
                    values[slideId].push(aligns ? addStyleString(currentSlideItem.align || "", [normalizedInput.key, normalizedInput.value]) : addStyle(selectedRange as never, clone(currentSlideItem), [normalizedInput.key, normalizedInput.value]).lines!.map((a) => a.text))
                }
            } else {
                if (normalizedInput.id.includes("CSS")) {
                    values[slideId].push(normalizedInput.value)
                } else {
                    values[slideId].push(addStyleString(currentSlideItem.style || "", [normalizedInput.key, normalizedInput.value]))
                }
            }
        }

        if (aligns && itemLatest.current?.type && itemLatest.current.type !== "text") {
            setValue({ ...normalizedInput, id: "align" }, allItems)
            return
        }

        if (!Object.values(values).length) return

        if (currentActiveEdit.id) {
            const sourceItems = (currentActiveEdit.type === "overlay" ? currentOverlays[currentActiveEdit.id]?.items : currentTemplates[currentActiveEdit.id]?.items) || []
            let currentItems: Item[] = allItems.map((itemIndex) => clone(sourceItems[itemIndex]))
            const allValues: unknown[] = (Object.values(values)[0] || []) as unknown[]

            allItems.forEach((_itemIndex, i) => {
                if (!currentItems[i]) return

                let currentValue: unknown = allValues[i] ?? allValues[0]
                if (currentValue === undefined) return

                if (normalizedInput.key === "align-items") currentItems[i].align = currentValue
                else if (currentType !== "text" || (!currentItems[i].lines && typeof currentValue === "string")) currentItems[i].style = currentValue
                else {
                    const lines = currentItems[i].lines
                    lines?.forEach((_a, j) => {
                        if (currentItems[i].lines?.[j] && currentValue?.[j] !== undefined) {
                            ;(currentItems[i].lines![j] as never)[aligns ? "align" : "text"] = currentValue[j]
                        }
                    })
                }
            })

            const textItems = currentItems.filter((a) => a?.lines)
            if (textItems.length) {
                const textLength = textItems.reduce((length, current) => (length += getItemText(current).length), 0)
                if (!textLength) {
                    newToast("empty.text")
                    return
                }
            }

            const override = currentActiveEdit.id + "#" + allItems.join(",")
            history({
                id: "UPDATE",
                oldData: { id: currentActiveEdit.id },
                newData: { key: "items", data: currentItems, indexes: allItems },
                location: { page: "edit", id: currentActiveEdit.type + "_items", override }
            })

            return
        }

        if (setItemStyleTypes.includes(id)) {
            slides.forEach((slide, i) => {
                if (!slideItems[i].length) return

                history({
                    id: "setItems",
                    newData: { style: { key: "style", values: values[slide] } },
                    location: { page: "edit", show: currentActiveShow!, slide, items: slideItems[i], override: "slide_" + slide + "_items_" + slideItems[i].join(",") }
                })
            })

            return
        }

        const key: string = normalizedInput.key === "text-align" || aligns ? "align" : "text"
        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            history({
                id: normalizedInput.key === "text-align" ? "textAlign" : aligns ? "setItems" : "textStyle",
                newData: { style: { key, values: values[slide] } },
                location: { page: "edit", show: currentActiveShow!, slide, items: slideItems[i], override: "slide_" + slide + "_items_" + slideItems[i].join(",") }
            })
        })
    }

    function updateValue2(input: Record<string, unknown>) {
        const next = { ...input }
        next.value = next.values?.value
        next.input = next.type

        if (next.id === "textFit") updateValue({ detail: { id: "auto", value: next.value !== "none" } })
        if (next.key === "text-shadow" && String(next.value).includes("rgb(0 0 0 / 0)") && String(next.value).includes("px")) {
            next.value = String(next.value).replace("rgb(0 0 0 / 0)", "rgb(0 0 0 / 0.4)")
        }

        if (!currentActiveEdit.id) {
            const changeId = `${next.id}${next.key || ""}`
            const slideKey = String(currentActiveEdit.slide || 0)
            if (!changesRef.current[slideKey]) changesRef.current[slideKey] = {}
            changesRef.current[slideKey][changeId] = JSON.stringify(next)
            setChangesTick((v) => v + 1)
        }

        updateValue({ detail: next })
    }

    useEffect(() => {
        setLoaded(true)
        const timeout = setTimeout(() => setHasLoaded(true), 100)
        return () => clearTimeout(timeout)
    }, [])

    useEffect(() => {
        if (!hasLoaded) return
        const changes = changesRef.current

        if (!shownTemplateTip && (currentActiveEdit.type || "show") === "show") {
            const categoryId = currentShowsCache[currentActiveShow?.id || ""]?.category || ""
            const categoryTemplate = currentCategories[categoryId]?.template || ""
            if (categoryTemplate) {
                alertMessage.set("tips.category_template")
                activePopup.set("alert")
                setShownTemplateTip(true)
                return
            }
        }

        if (!shownTemplateTip && currentSpecial.styleTemplatePreview !== false) {
            const outputsHasStyleTemplate = getAllEnabledOutputs().every((output) => {
                return !!currentOutputStyles[output?.style || ""]?.template
            })
            if (outputsHasStyleTemplate) {
                alertMessage.set("tips.style_template_active")
                activePopup.set("alert")
                setShownTemplateTip(true)
                return
            }
        }

        if (currentShownTips.includes("consider_templates")) return

        const SLIDES = 3
        const allValues: string[] = Object.values(changes).flatMap((slide) => Object.values(slide))
        const valueCounts = new Map<string, number>()

        allValues.forEach((value) => {
            valueCounts.set(value, (valueCounts.get(value) || 0) + 1)
        })

        const duplicates = Array.from(valueCounts.entries()).filter(([_value, count]) => count > SLIDES)
        if (duplicates.length > 0) {
            alertMessage.set("tips.consider_templates")
            activePopup.set("alert")
            shownTips.set([...currentShownTips, "consider_templates"])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [changesTick, hasLoaded])

    if (!loaded) return null

    return <EditValues sections={boxSections} item={item} styles={currentStyles} customValues={customValues} customLocalFonts={customLocalFonts} type="text" onChange={updateValue2} />
}

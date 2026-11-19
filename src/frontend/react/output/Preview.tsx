import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { Output } from "../../../types/Output"
import type { LayoutRef, OutSlide } from "../../../types/Show"
import { actions, activePage, activePopup, activeShow, activeTimers, contextActive, groups, guideActive, openToolsTab, outLocked, outputs, overlayTimers, playingAudio, playingMetronome, slideTimers, special } from "../../shared/core/stores"
import { formatSearch } from "../../shared/utils/search"
import { getNormalizedKey, previewCtrlShortcuts, previewShortcuts } from "../../app/wiring/shortcuts"
import { runAction } from "../../components/actions/actions"
import { getSlideText } from "../../components/edit/scripts/textStyle"
import { getActiveOutputs, getFirstOutputIdWithBackground, isOutCleared, outputSlideHasContent, setOutput } from "../../shared/utils/helpers/output"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { getFewestOutputLines, getItemWithMostLines, playNextGroup, playPreviousGroup, updateOut } from "../../shared/utils/helpers/showActions"
import { _show } from "../../shared/utils/helpers/shows"
import { newSlideTimer } from "../../shared/utils/helpers/tick"
import { AudioMeter } from "../drawer/audio/AudioMeter"
import { useStore } from "../hooks/useStore"
import { ClearButtons } from "./ClearButtons"
import { MediaControls } from "./MediaControls"
import { MultiOutputs } from "./MultiOutputs"
import { Show } from "./Show"
import { ShowActions } from "./ShowActions"
import { SpotifyController } from "./SpotifyController"
import styles from "./Preview.module.css"

interface TempRef {
    temp: boolean
    items: unknown[]
    id: string
}

type PreviewRef = LayoutRef | TempRef

const ctrlShortcuts: Record<string, () => void> = previewCtrlShortcuts
const shortcuts: Record<string, (event: KeyboardEvent) => boolean | void> = previewShortcuts

function getActiveClear(slideTimer: boolean, audio: boolean, overlays: boolean, slide: boolean, background: boolean): string | null {
    if (slideTimer) return "nextTimer"
    if (audio) return "audio"
    if (overlays) return "overlays"
    if (slide) return "slide"
    if (background) return "background"
    return null
}

// Port de components/output/preview/PreviewImpl.svelte (F24.24b).
export function Preview() {
    const currentOutputs = useStore(outputs)
    const currentActivePage = useStore(activePage)

    const [autoChange, setAutoChange] = useState(true)
    const [activeClear, setActiveClear] = useState<string | null>(null)
    const [updatedActiveClear, setUpdatedActiveClear] = useState<string | null>(null)

    const allActiveOutputs = getActiveOutputs(currentOutputs, true, true, true)
    const outputId = allActiveOutputs[0]
    const currentOutput = (outputId ? currentOutputs[outputId] : null) || ({} as Output)

    const allOutputsWithBackground = allActiveOutputs.filter((id) => currentOutputs[id]?.out?.background)
    const backgroundOutputId = getFirstOutputIdWithBackground(allOutputsWithBackground) || allOutputsWithBackground[0] || outputId
    const currentBgOutput = backgroundOutputId ? currentOutputs[backgroundOutputId] || null : null

    const outSlide = (currentOutput.out?.slide as OutSlide | null | undefined) || null
    const slideRef: PreviewRef[] = outSlide
        ? outSlide.id === "temp"
            ? [{ temp: true, items: outSlide.tempItems || [], id: "" }]
            : _show(outSlide.id)
                  .layouts([outSlide.layout || ""])
                  .ref()[0] || []
        : []

    const amountOfLinesToShow = getFewestOutputLines(currentOutputs)
    const showSlide =
        outSlide?.index !== undefined && slideRef
            ? _show(outSlide.id)
                  .slides([slideRef[outSlide.index]?.id || ""])
                  .get()?.[0]
            : null
    const slideLines = showSlide ? getItemWithMostLines(showSlide) : null
    const maxLines = slideLines && amountOfLinesToShow && amountOfLinesToShow < slideLines ? Math.ceil(slideLines / amountOfLinesToShow) : null
    const outputLine = amountOfLinesToShow && outSlide ? outSlide.line || 0 : null
    const linesPercentage = slideLines && outputLine !== null ? outputLine / slideLines : 0
    const linesIndex = maxLines !== null ? Math.floor(maxLines * linesPercentage) : 0

    const bgOut = currentBgOutput?.out?.background
    const videoPlaying = !!bgOut && (bgOut.type === "video" || bgOut.type === "player")

    // El handler de window se registra una sola vez: los stores se leen con get() y los derivados del render, por ref.
    const keydownContext = useRef({ outSlide, slideRef })
    keydownContext.current = { outSlide, slideRef }
    const numberKeyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const previousNumberKey = useRef("")

    useEffect(() => {
        return () => {
            if (numberKeyTimeout.current) clearTimeout(numberKeyTimeout.current)
        }
    }, [])

    function playSlideAtIndex(index: number) {
        const layoutRef = getLayoutRef()
        if (index === -1) index = layoutRef.length - 1
        if (!layoutRef[index]) return

        updateOut("active", index, layoutRef)
        setOutput("slide", { id: get(activeShow)?.id, layout: _show().get("settings.activeLayout"), index, line: 0 })
    }

    function actionKeyActivate(key: string) {
        let actionTriggered = false

        Object.values(get(actions)).forEach((action) => {
            // can become [object Object] in some rare cases
            const keypressActivate: unknown = action?.keypressActivate
            if (typeof keypressActivate !== "string") return
            if (keypressActivate.toUpperCase() === key) {
                runAction(action, { source: "keypress" })
                actionTriggered = true
            }
        })

        return actionTriggered
    }

    function checkGroupShortcuts(e: KeyboardEvent): boolean {
        const { outSlide: currentSlide } = keydownContext.current
        const activeShowValue = get(activeShow)
        const currentShowId = currentSlide?.id || (activeShowValue !== null ? (activeShowValue.type === undefined || activeShowValue.type === "show" ? activeShowValue.id : null) : null)
        if (!currentShowId) return false

        const showRef = getLayoutRef(currentShowId)
        const groupIds = showRef.map((a) => a.id)
        const showGroups = groupIds.length ? _show(currentShowId).slides(groupIds).get() : []
        if (!showGroups.length) return false

        // Get both the actual key and normalized key to support all keyboard layouts
        const actualKey = e.key
        const normalizedKey = getNormalizedKey(e)

        const globalGroupIds: string[] = []
        Object.entries(get(groups)).forEach(([groupId, group]) => {
            if (typeof group.shortcut !== "string") return

            // Check both actual key (for native shortcuts) and normalized key (for Latin shortcuts on non-Latin keyboards)
            const shortcutLower = group.shortcut.toLowerCase()
            if (shortcutLower !== actualKey.toLowerCase() && shortcutLower !== normalizedKey.toLowerCase()) return

            showGroups.forEach((slide) => {
                if (slide.globalGroup === groupId) globalGroupIds.push(slide.id)
            })
        })

        if (e.shiftKey) return Boolean(playPreviousGroup(globalGroupIds, { showRef, outSlide: currentSlide, currentShowId }, !e.altKey))
        return Boolean(playNextGroup(globalGroupIds, { showRef, outSlide: currentSlide, currentShowId }, !e.altKey))
    }

    useEffect(() => {
        function keydown(e: KeyboardEvent) {
            if (get(contextActive)) return
            if (get(guideActive) || get(activePopup) === "assign_shortcut") return

            const ctrlShortcut = e.ctrlKey || e.metaKey ? ctrlShortcuts[getNormalizedKey(e)] : null
            if (ctrlShortcut) {
                e.preventDefault()
                ctrlShortcut()
            }

            const functionKey = /^F(?:[1-9]|1[0-9]|2[0-4])$/
            if (e.target instanceof Element && (e.target.closest("input") || e.target.closest(".edit")) && !functionKey.test(e.key)) return

            // start action with custom shortcut key
            if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && actionKeyActivate(e.key.toUpperCase())) {
                e.preventDefault()
                return
            }

            const { outSlide: currentSlide } = keydownContext.current

            // group shortcuts
            if ((currentSlide?.id || get(activeShow)) && !e.ctrlKey && !e.metaKey && !get(outLocked)) {
                // play slide with custom shortcut key
                const layoutRef = getLayoutRef(currentSlide?.id || "active")
                const slideShortcutMatch = layoutRef.findIndex((refItem) => ("data" in refItem ? refItem.data?.actions?.slide_shortcut?.key : undefined) === e.key)
                if (slideShortcutMatch > -1 && !e.altKey && !e.shiftKey) {
                    playSlideAtIndex(slideShortcutMatch)
                    e.preventDefault()
                    return
                }

                // play group with custom shortcut keys
                if (checkGroupShortcuts(e)) {
                    e.preventDefault()
                    return
                }

                // play slide with number keys
                if (get(special).numberKeys && e.key !== " " && !Number.isNaN(Number(e.key))) {
                    previousNumberKey.current += e.key

                    if (numberKeyTimeout.current) clearTimeout(numberKeyTimeout.current)
                    numberKeyTimeout.current = setTimeout(() => {
                        const slideIndex = Number(previousNumberKey.current) - 1
                        playSlideAtIndex(slideIndex)

                        numberKeyTimeout.current = null
                        previousNumberKey.current = ""
                    }, 300)

                    return
                }

                // play slide based on first text letter
                if (get(special).autoLetterShortcut) {
                    const isSpecial = [".", ",", "-", "+", "/", "*", "<", ">", "|", "\\", "¨", "'"].includes(e.key)
                    if (e.key.trim().length === 1 && Number.isNaN(Number(e.key)) && !isSpecial) {
                        const firstLetterMatch = layoutRef.findIndex((refItem) => {
                            const slide = _show().get("slides")?.[refItem.id]
                            if (!slide) return false
                            const slideText = formatSearch(getSlideText(slide)).replace(/\d+/g, "").trim()
                            return slideText[0]?.toLowerCase() === e.key.toLowerCase()
                        })

                        if (firstLetterMatch > -1 && !e.altKey && !e.shiftKey) {
                            playSlideAtIndex(firstLetterMatch)
                            e.preventDefault()
                            return
                        }
                    }
                }
            }

            const shortcut = shortcuts[e.key]
            if (shortcut) {
                if (shortcut(e)) e.preventDefault()
                return
            }
        }

        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // active menu
    useEffect(() => {
        if (outputId) setAutoChange(true)
    }, [outputId])

    useEffect(() => {
        if (!autoChange) return

        const active = getActiveClear(!isOutCleared("transition"), !!(Object.keys(get(playingAudio)).length || get(playingMetronome)), !isOutCleared("overlays") || !isOutCleared("effects"), !isOutCleared("slide") && (outputSlideHasContent(currentOutput) || isOutCleared("background")), !isOutCleared("background"))
        if (active !== activeClear) setActiveClear(active)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoChange, currentOutputs, overlayTimers, activeTimers, playingMetronome, playingAudio, currentOutput])

    // enable autochange again if active has no value
    useEffect(() => {
        if (autoChange) return

        if (activeClear === "nextTimer" && isOutCleared("transition")) setAutoChange(true)
        else if (activeClear === "audio" && !Object.keys(get(playingAudio)).length && !get(playingMetronome)) setAutoChange(true)
        else if (activeClear === "overlays" && isOutCleared("overlays") && isOutCleared("effects")) setAutoChange(true)
        else if (activeClear === "slide" && !(!isOutCleared("slide") && (outputSlideHasContent(currentOutput) || isOutCleared("background")))) setAutoChange(true)
        else if (activeClear === "background" && isOutCleared("background")) setAutoChange(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoChange, activeClear, currentOutputs, playingAudio, playingMetronome, overlayTimers, activeTimers, currentOutput])

    // don't update instantly in case it changes back quickly like slide timers
    useEffect(() => {
        const timeout = setTimeout(() => setUpdatedActiveClear(activeClear))
        return () => clearTimeout(timeout)
    }, [activeClear])

    useEffect(() => {
        Object.entries(currentOutputs).forEach(([id, output]) => {
            if ((Object.keys(currentOutputs).length > 1 && !output.enabled) || output.stageOutput) return
            if (!output.out?.transition || get(slideTimers)[id]?.timer) return

            const data = output.out.transition
            newSlideTimer(id, data.duration, data.folderPath || "")
        })
    }, [currentOutputs])

    function handleUpdate(key: string) {
        setActiveClear(key)
        if (key === "audio") openToolsTab.set("audio")
        else if (key === "overlays") openToolsTab.set("overlays")
        else if (key === "nextTimer") openToolsTab.set("timers")
    }

    return (
        <div id="previewArea" className={styles.main}>
            <div className={styles.top}>
                <MultiOutputs />
                <div className={styles.previewMeter}>
                    <AudioMeter channelId="main" preview />
                </div>
            </div>

            <div className={styles.section} style={{ marginBottom: 2 }}>
                <ShowActions currentOutput={currentOutput} refItems={slideRef} linesIndex={linesIndex} maxLines={maxLines} />
            </div>

            {videoPlaying ? (
                <div className={styles.section}>
                    <MediaControls currentOutput={currentBgOutput} outputId={backgroundOutputId} transport />
                </div>
            ) : null}

            {currentActivePage === "show" ? (
                <>
                    <div className={`${styles.section} ${styles.flat}`}>
                        <ClearButtons autoChange={autoChange} activeClear={updatedActiveClear} onAutoChangeChange={setAutoChange} onUpdate={handleUpdate} />
                        {updatedActiveClear === "slide" ? <Show currentOutput={currentOutput} ref={slideRef} linesIndex={linesIndex} maxLines={maxLines} /> : null}
                    </div>
                    <SpotifyController />
                </>
            ) : null}
        </div>
    )
}

export default Preview

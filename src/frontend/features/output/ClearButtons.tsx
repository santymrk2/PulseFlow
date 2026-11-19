import { useEffect, useRef, useState } from "react"
import { clearAudio } from "../../shared/audio/audioFading"
import { activeTimers, dictionary, isFadingOut, isTimelinePlaying, labelsDisabled, media, outLocked, outputCache, outputs, overlayTimers, playingAudio, playingMetronome, special, styles, timelineRecordingAction } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { presentationControllersKeysDisabled } from "../../app/wiring/shortcuts"
import { getMediaLayerType } from "../../shared/utils/helpers/media"
import { getActiveOutputs, getOutputContent, isOutCleared } from "../../shared/utils/helpers/output"
import { clearToLogo } from "./logic/clearToLogo"
import { clearAll, clearBackground, clearOverlays, clearScene, clearSlide, clearTimers, restoreOutput } from "./logic/clear"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import stylesCss from "./ClearButtons.module.css"

export interface ClearButtonsProps {
    autoChange: boolean
    activeClear: string | null | undefined
    onAutoChangeChange?: (value: boolean) => void
    onUpdate?: (key: string) => void
}

// Port de components/output/preview/ClearButtons.svelte (F24.20b).
export function ClearButtons({ autoChange, activeClear, onAutoChangeChange, onUpdate }: ClearButtonsProps) {
    const currentOutputs = useStore(outputs)
    const currentPlayingAudio = useStore(playingAudio)
    const currentPlayingMetronome = useStore(playingMetronome)
    const currentOutputCache = useStore(outputCache)
    const currentOutLocked = useStore(outLocked)
    const currentStyles = useStore(styles)
    const currentMedia = useStore(media)
    const currentOverlayTimers = useStore(overlayTimers)
    const currentActiveTimers = useStore(activeTimers)
    const currentIsFadingOut = useStore(isFadingOut)
    const currentIsTimelinePlaying = useStore(isTimelinePlaying)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentDictionary = useStore(dictionary)
    const hasLogo = !!useStore(special).outputLogo

    const [enableRestore, setEnableRestore] = useState(false)
    const [audioIcon, setAudioIcon] = useState("audio")
    const restoreTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const fadeStep = useRef(0)

    const audioCleared = !Object.keys(currentPlayingAudio).length && !currentPlayingMetronome
    const audioClearedWithoutMics = !Object.values(currentPlayingAudio).filter((a) => !a.isMic).length && !currentPlayingMetronome
    const allCleared = isOutCleared(null, currentOutputs) && audioClearedWithoutMics

    useEffect(() => {
        if (allCleared && !autoChange) onAutoChangeChange?.(true)
    }, [allCleared, autoChange, onAutoChangeChange])

    useEffect(() => {
        if (currentOutputCache) {
            setEnableRestore(false)
            if (restoreTimeout.current) clearTimeout(restoreTimeout.current)
            restoreTimeout.current = setTimeout(() => setEnableRestore(true), 1000)
        }
        return () => {
            if (restoreTimeout.current) clearTimeout(restoreTimeout.current)
        }
    }, [currentOutputCache])

    useEffect(() => {
        if (!allCleared) {
            setEnableRestore(false)
            if (currentOutputCache !== null) outputCache.set(null)
        }
    }, [allCleared, currentOutputCache])

    // ACTIONS
    const clearActions: Record<string, () => void> = {
        background: () => clearBackground(),
        slide: () => clearSlide(),
        overlays: () => clearOverlays(),
        audio: () => clearAudio("", { clearPlaylist: true, clearMicrophones: true, commonClear: true }),
        nextTimer: () => clearTimers(),
        scene: () => clearScene()
    }

    function clear(key: string) {
        if (currentOutLocked || !clearActions[key]) return
        onAutoChangeChange?.(true)

        clearActions[key]()

        const actionKey = key === "nextTimer" ? "next_timer" : key
        timelineRecordingAction.set({ id: `clear_${actionKey}` })
    }

    function openPreview(key: string) {
        if (activeClear === key) {
            onAutoChangeChange?.(true)
            return
        }

        onAutoChangeChange?.(false)
        onUpdate?.(key)
    }

    const canRestore = allCleared && !!currentOutputCache && currentOutputCache.slide?.type !== "ppt" && !currentOutLocked && enableRestore
    const outputContent = getOutputContent("", currentOutputs)
    const backgroundCleared = isOutCleared("background", currentOutputs)
    const outputId = getActiveOutputs(currentOutputs, true, true, true)[0] || ""
    const output = currentOutputs[outputId] || {}
    const outputStyle = currentStyles[output.style || ""] || {}
    const canDisplayStyleBG = !outputStyle.clearStyleBackgroundOnText || (!output.out?.slide && !output.out?.background)
    const styleBackground = backgroundCleared && !currentOutLocked && outputStyle.backgroundImage && canDisplayStyleBG
    const outBackground = output.out?.background || {}
    const backgroundData = currentMedia[outBackground.path || ""] || {}

    const isScripture = outputContent?.id === "temp"
    const isMetronome = currentPlayingMetronome && !Object.keys(currentPlayingAudio).length
    const isTimer = !output.out?.transition && !Object.values(currentOverlayTimers).find((a) => a.outputId === outputId) && Object.keys(currentActiveTimers).length

    const slideCleared = isOutCleared("slide", currentOutputs)
    const effectsCleared = isOutCleared("effects", currentOutputs, true)
    const overlayCleared = isOutCleared("overlays", currentOutputs, true)
    const lockedOverlay = !overlayCleared && isOutCleared("overlays", currentOutputs, false)
    const slideTimerCleared = isOutCleared("transition", currentOutputs)
    const sceneCleared = isOutCleared("scene", currentOutputs)

    // audio fade out
    useEffect(() => {
        if (!currentIsFadingOut) {
            fadeStep.current += 1
            setAudioIcon(isMetronome ? "metronome" : "audio")
            return
        }

        const runId = ++fadeStep.current
        const isCurrent = () => runId === fadeStep.current
        const startAudioIcon = () => {
            if (!isCurrent()) return
            setAudioIcon("volume")
            setTimeout(() => {
                if (!isCurrent()) return
                setAudioIcon("volume_down")

                setTimeout(() => {
                    if (!isCurrent()) return
                    setAudioIcon("volume_off")

                    setTimeout(() => {
                        if (!isCurrent()) return
                        startAudioIcon()
                    }, 1000)
                }, 400)
            }, 400)
        }
        startAudioIcon()

        return () => {
            runId === fadeStep.current && (fadeStep.current += 1)
        }
    }, [currentIsFadingOut, isMetronome])

    return (
        <div className={stylesCss.clear} data-title={translateText("guide_description.output_clear", currentDictionary)}>
            {!sceneCleared ? (
                <span className={stylesCss.group} style={{ borderBottom: "1px solid var(--primary-darker)" }}>
                    <div className={stylesCss.combinedButton}>
                        <Button style={{ padding: "0.3em 0.8em" }} disabled={currentOutLocked} title={currentOutLocked ? "" : "clear.scene"} onClick={() => clear("scene")}>
                            <Icon id="scene" size={1.1} white />
                            <T id="clear.scene" />
                        </Button>
                    </div>
                </span>
            ) : null}

            <span className={stylesCss.fixed}>
                <Button style={{ padding: "0.42em 0.8em" }} className="clearAll" disabled={currentOutLocked || allCleared} title="clear.all [esc]" onClick={() => clearAll(true)}>
                    {currentIsTimelinePlaying ? (
                        <span className={stylesCss.faded} data-title={translateText("popup.timeline")}>
                            <Icon id="timeline" white />
                        </span>
                    ) : null}
                    <Icon id="clear" size={1.2} white />
                    {!currentLabelsDisabled ? <T id="clear.all" /> : null}
                </Button>
                <Button style={{ padding: "0.42em 0.8em" }} className="clearAll" disabled={!canRestore} title="preview.restore_output" onClick={restoreOutput}>
                    <Icon id="reset" size={1.2} white />
                </Button>
                <Button style={{ padding: "0.42em 0.8em" }} className="clearAll" disabled={currentOutLocked || !hasLogo} title={hasLogo ? "clear.logo [F6]" : "clear.logo_missing"} onClick={clearToLogo}>
                    <Icon id="star" size={1.2} white />
                </Button>
            </span>

            <span className={stylesCss.group}>
                <div className={stylesCss.combinedButton}>
                    <Button style={{ padding: "0.3em 0.6em", ...(lockedOverlay ? { opacity: 0.5, cursor: "default" } : {}) }} disabled={currentOutLocked || (overlayCleared && effectsCleared)} title={lockedOverlay ? "" : "clear.overlays [F3]"} onClick={() => clear("overlays")}>
                        <Icon id="overlays" size={1.2} white />
                    </Button>
                    {!allCleared ? (
                        <Button style={{ padding: activeClear === "overlays" ? "0px" : "2px", minHeight: "15px" }} isActive={activeClear === "overlays"} disabled={overlayCleared} onClick={() => openPreview("overlays")} title="preview.overlays">
                            {activeClear === "overlays" ? <Icon style={{ opacity: 0.8 }} id="expand" size={0.7} white /> : null}
                        </Button>
                    ) : null}
                </div>

                {getMediaLayerType(outBackground.path || "", backgroundData) !== "foreground" || !slideCleared ? (
                    <div className={stylesCss.combinedButton}>
                        <Button style={{ padding: "0.3em 0.6em" }} disabled={currentOutLocked || slideCleared} title="clear.slide  [F2]" onClick={() => clear("slide")}>
                            {/* PDFs are visually the background layer as it is toggled by the style "Background" layer, but it behaves as a slide in the code */}
                            {/* display recording icon here if a slide recoring is playing */}
                            <Icon id={isScripture ? "scripture" : outputContent?.type === "pdf" ? "image" : "slide"} size={1.2} white />
                        </Button>
                        {!allCleared ? (
                            <Button style={{ padding: activeClear === "slide" ? "0px" : "2px", minHeight: "15px" }} isActive={activeClear === "slide"} disabled={slideCleared} onClick={() => openPreview("slide")} title="preview.slide">
                                {activeClear === "slide" ? <Icon style={{ opacity: 0.8 }} id="expand" size={0.7} white /> : null}
                            </Button>
                        ) : null}
                    </div>
                ) : null}

                {outputContent?.type !== "pdf" ? (
                    <div className={stylesCss.combinedButton}>
                        <Button style={{ padding: "0.3em 0.6em", ...(isTimer ? { opacity: 0.9 } : {}) }} disabled={currentOutLocked || (slideTimerCleared && activeClear !== "nextTimer")} title={`${isTimer ? "actions.stop_timers" : `clear.${Object.keys(currentOverlayTimers).length ? "timer" : "nextTimer"}`}${presentationControllersKeysDisabled() ? " [F5]" : ""}`} onClick={() => (isTimer ? activeTimers.set([]) : clear("nextTimer"))}>
                            <Icon id={isTimer ? "timer" : "clock"} size={1.2} white />
                        </Button>
                        {!allCleared ? (
                            <Button style={{ padding: "2px", minHeight: "15px", borderRight: "0" }} isActive={activeClear === "nextTimer"} disabled={slideTimerCleared && activeClear !== "nextTimer"} onClick={() => openPreview("nextTimer")} title="preview.nextTimer">
                                {activeClear === "nextTimer" ? <Icon style={{ opacity: 0.8 }} id="expand" size={0.7} white /> : null}
                            </Button>
                        ) : null}
                    </div>
                ) : null}

                {outputContent?.type !== "pdf" && outputContent?.type !== "ppt" ? (
                    <div className={stylesCss.combinedButton}>
                        <Button style={{ padding: "0.3em 0.6em", ...(styleBackground ? { opacity: 0.5, cursor: "default" } : {}) }} disabled={(currentOutLocked || backgroundCleared) && !styleBackground} title={currentOutLocked || backgroundCleared ? "" : "clear.background [F1]"} onClick={() => clear("background")}>
                            <Icon id="image" size={1.2} white />
                        </Button>
                        {!allCleared ? (
                            <Button style={{ padding: activeClear === "background" ? "0px" : "2px", minHeight: "15px", borderLeft: "0" }} isActive={activeClear === "background"} disabled={backgroundCleared} onClick={() => openPreview("background")} title="preview.background">
                                {activeClear === "background" ? <Icon style={{ opacity: 0.8 }} id="expand" size={0.7} white /> : null}
                            </Button>
                        ) : null}
                    </div>
                ) : null}

                <div className={stylesCss.combinedButton}>
                    <Button style={{ padding: "0.3em 0.6em" }} disabled={currentOutLocked || audioCleared} title="clear.audio [F4]" onClick={() => clear("audio")}>
                        <Icon id={audioIcon} size={1.2} white />
                    </Button>
                    {!allCleared ? (
                        <Button style={{ padding: activeClear === "audio" ? "0px" : "2px", minHeight: "15px" }} isActive={activeClear === "audio"} disabled={audioCleared} onClick={() => openPreview("audio")} title="preview.audio">
                            {activeClear === "audio" ? <Icon style={{ opacity: 0.8 }} id="expand" size={0.7} white /> : null}
                        </Button>
                    ) : null}
                </div>
            </span>
        </div>
    )
}

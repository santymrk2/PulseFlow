import { useEffect, useState, type DragEvent, type MouseEvent } from "react"
import type { Output } from "../../../types/Output"
import { activeRecording, activeStyle, audioChannelsData, dictionary, outputs, previewOutputId, rtmpStatus, selected, styles as outputStyles, templates, toggleOutputEnabled } from "../../stores"
import { openSettings } from "../../components/settings/openSettings"
import { translateText } from "../../utils/language"
import { stopMediaRecorder } from "../../components/drawer/live/recorder"
import { openDrawer } from "../../components/edit/scripts/edit"
import { clone, keysToID, sortByName, sortObject } from "../../components/helpers/array"
import { defaultLayers, getOutputResolution, startRtmpStreaming, startStreaming, stopRtmpStreaming, stopStreaming } from "../../components/helpers/output"
import { getUnhealthyDestinations, hasStreamableDestination } from "../../components/helpers/rtmpDestinations"
import { bindSlidesToOutput, getLayoutRef } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import PreviewOutput from "../../components/output/preview/PreviewOutput.svelte"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { AudioMeter } from "../drawer/audio/AudioMeter"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { SelectField } from "../ui/select-field/SelectField"
import styles from "./MultiOutputs.module.css"

export interface MultiOutputsProps {
    disableTransitions?: boolean
}

interface Resolution {
    width: number
    height: number
}

function toFraction(x: number, tolerance = 0) {
    if (x === 0) return "0/1"
    if (x < 0) x = -x
    if (!tolerance) tolerance = 0.0001
    let num = 1
    let den = 1

    function iterate() {
        const R = num / den
        if (Math.abs((R - x) / x) < tolerance) return

        if (R < x) num++
        else den++
        iterate()
    }

    iterate()
    return `${num}/${den}`
}

// Port de components/output/preview/MultiOutputs.svelte (F24.20b).
export function MultiOutputs({ disableTransitions = false }: MultiOutputsProps) {
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(outputStyles)
    const currentTemplates = useStore(templates)
    const currentAudioChannels = useStore(audioChannelsData)
    const currentPreviewOutputId = useStore(previewOutputId)
    const currentRtmpStatus = useStore(rtmpStatus)
    const currentSelected = useStore(selected)
    const currentActiveRecording = useStore(activeRecording)
    const currentToggleOutputEnabled = useStore(toggleOutputEnabled)
    const currentDictionary = useStore(dictionary)

    const [fullscreen, setFullscreen] = useState(false)
    const [fullscreenId, setFullscreenId] = useState("")
    const [resolution, setResolution] = useState<Resolution>({ width: 0, height: 0 })
    const [dragOverOutputId, setDragOverOutputId] = useState<string | null>(null)

    const allEnabledOuts = sortObject(sortByName(keysToID(currentOutputs).filter((a) => a.enabled)), "stageOutput") as (Output & { id: string })[]
    // una sola salida a la vez (F14.11); las ocultas de la vista previa no aparecen en el selector
    const pickable = allEnabledOuts.length > 1 ? allEnabledOuts.filter((a) => !a.hideFromPreview) : allEnabledOuts
    const shown = pickable.find((a) => a.id === currentPreviewOutputId) || pickable[0] || allEnabledOuts[0]
    const outs = shown ? [shown] : []
    const pickerOptions = pickable.map((o) => ({ value: o.id, label: o.name || o.id }))

    useEffect(() => {
        if (!currentToggleOutputEnabled) return
        const timer = setTimeout(() => {
            toggleOutputEnabled.set(false)
        }, 500)
        return () => clearTimeout(timer)
    }, [currentToggleOutputEnabled])

    function toggleFullscreen(e: MouseEvent<HTMLDivElement>) {
        const target = e.target as HTMLElement
        // open output style settings
        if (target.closest(".icons")) {
            if (target.closest(".muted")) {
                openDrawer("audio")
                return
            }

            const outputId = target.closest(".outputPreview")?.id
            if (outputId) {
                const output = currentOutputs[outputId]
                activeStyle.set(output?.style || "")
                openSettings("styles")
            }
            return
        }

        if (!target.closest(`.${styles.multipleOutputs}`) || target.closest("button")) return

        if (fullscreen) {
            setFullscreen(false)
            return
        }

        const clickedOutput = target.closest(".previewOutput")?.id
        if (!clickedOutput) return

        setFullscreen(true)
        setFullscreenId(clickedOutput)
        setResolution(getOutputResolution(clickedOutput, currentOutputs, true))
    }

    const slideId = outs[0]?.out?.slide?.id || ""
    const isScriptureOutput = slideId === "temp" || _show(slideId).get("reference")?.type === "scripture"

    // drag-and-drop: bind slide to output
    const SLIDE_DROP_IDS = new Set(["slide"])
    function isDroppable(outputId: string) {
        return !currentOutputs[outputId]?.stageOutput
    }
    function handleDragOver(e: DragEvent<HTMLDivElement>, outputId: string) {
        if (!SLIDE_DROP_IDS.has(currentSelected.id || "") || !isDroppable(outputId)) return
        e.preventDefault()
        setDragOverOutputId(outputId)
    }
    function handleDragLeave(e: DragEvent<HTMLDivElement>, outputId: string) {
        const related = e.relatedTarget as HTMLElement | null
        if (related?.closest(`#${CSS.escape(outputId)}`)) return
        setDragOverOutputId((current) => (current === outputId ? null : current))
    }
    function handleDrop(e: DragEvent<HTMLDivElement>, outputId: string) {
        setDragOverOutputId(null)
        if (!SLIDE_DROP_IDS.has(currentSelected.id || "") || !isDroppable(outputId)) return
        e.preventDefault()
        e.stopPropagation()

        const ref = getLayoutRef()
        const indexes: number[] = (currentSelected.data || []).map((item: { index?: number }) => item.index).filter((i: number | undefined): i is number => i !== undefined)
        if (!indexes.length || !ref.length) return

        bindSlidesToOutput(indexes, outputId)
    }

    return (
        <div onClick={toggleFullscreen} className={`${styles.multipleOutputs} ${fullscreen ? styles.fullscreen : ""}`} style={fullscreen ? { width: "100%", height: "100%" } : { width: "calc(100% - 4px)" }} role="none">
            {fullscreen ? (
                <>
                    <Button className="hide" style={{ zIndex: 2, opacity: 1, insetInlineEnd: "10px" }} title="actions.close" onClick={() => setFullscreen(false)}>
                        <Icon id="close" size={1.2} white />
                    </Button>

                    <span className={styles.resolution}>
                        <p>
                            <b>
                                <T id="screen.width" />:
                            </b>{" "}
                            {resolution?.width || 0} <T id="screen.pixels" />
                        </p>
                        <p>
                            <b>
                                <T id="screen.height" />:
                            </b>{" "}
                            {resolution?.height || 0} <T id="screen.pixels" />
                        </p>
                        {resolution?.width && resolution?.height ? (
                            <p>
                                <b>
                                    <T id="settings.aspect_ratio" />:
                                </b>{" "}
                                {Number((resolution.width / resolution.height).toFixed(2))} ({toFraction(resolution.width / resolution.height)})
                            </p>
                        ) : null}
                    </span>
                </>
            ) : null}

            {outs.map((output) => {
                const style = currentStyles[output.style || ""] || {}
                const layers = Array.isArray(style.layers) ? style.layers : clone(defaultLayers)
                const styleTemplate = isScriptureOutput ? style.templateScripture : style.template
                const isMuted = currentAudioChannels[`channel_${output.id}`]?.isMuted
                const isNetworkOutput = output.ndi || output.webrtc || output.rtmp

                return (
                    <div
                        key={output.id}
                        id={output.id}
                        className={`outputPreview output_button context #output_preview ${styles.outputPreview} ${!fullscreen && dragOverOutputId === output.id ? styles.dropTarget : ""}`}
                        onDragOver={(e) => handleDragOver(e, output.id)}
                        onDragLeave={(e) => handleDragLeave(e, output.id)}
                        onDrop={(e) => handleDrop(e, output.id)}
                        style={fullscreen ? (fullscreenId === output.id ? { display: "contents" } : { opacity: 0, position: "absolute" }) : { display: "contents" }}
                    >
                        {!fullscreen && allEnabledOuts.length > 1 ? (
                            <div className={styles.outputBar}>
                                <SelectField label="screen_config.output" value={output.id} options={pickerOptions} onChange={(value) => value && previewOutputId.set(value)} />
                            </div>
                        ) : null}

                        <div className={styles.previewContainer}>
                            <SvelteIsland component={PreviewOutput} props={{ outputId: output.id, disableTransitions, disabled: allEnabledOuts.length > 1 && !fullscreen && !output?.active, fullscreen }} />

                            {/* BADGES (LIVE / REC) */}
                            {!fullscreen ? (
                                <div className={styles.badges}>
                                    {(output.webrtcData?.url && output.webrtc) || (output.rtmp && hasStreamableDestination(output.rtmpData)) ? (() => {
                                        const isRtmp = !!output.rtmp
                                        const isStreaming = isRtmp ? output.rtmpData?.streaming : output.webrtcData?.streaming
                                        const unhealthy = isRtmp && isStreaming ? getUnhealthyDestinations(output.rtmpData, currentRtmpStatus[output.id]) : []
                                        return (
                                            <div className={`${styles.badge} ${styles.live}`} style={{ backgroundColor: isStreaming ? (unhealthy.length ? "#ab8000" : "#b60707") : "var(--primary-darker)" }}>
                                                <Button style={{ padding: "2px 3px", minHeight: 0 }} onClick={() => (isRtmp ? (output.rtmpData?.streaming ? stopRtmpStreaming(output.id, true) : startRtmpStreaming(output.id)) : output.webrtcData?.streaming ? stopStreaming(output.id, true) : startStreaming(output.id))} title={unhealthy.length ? `${unhealthy.join(", ")} not live` : isStreaming ? "output.stop_streaming" : "output.start_streaming"}>
                                                    {translateText(isStreaming ? "output.is_live" : "output.go_live", currentDictionary)}
                                                </Button>
                                            </div>
                                        )
                                    })() : null}

                                    {currentActiveRecording?.outputId === output.id || (currentActiveRecording?.isOutput && !currentActiveRecording.outputId && outs[0]?.id === output.id) ? (
                                        <div className={`${styles.badge} ${styles.rec}`} style={{ backgroundColor: "#b60707" }}>
                                            <Button style={{ padding: "2px 4px", minHeight: 0, gap: "4px" }} onClick={() => stopMediaRecorder()} title="actions.stop_recording">
                                                <Icon id="record" size={0.7} white />
                                                REC
                                            </Button>
                                        </div>
                                    ) : null}

                                    {output.out?.scene?.name ? (
                                        <div className={`${styles.badge} ${styles.scene}`} style={{ backgroundColor: "var(--primary-darker)" }}>
                                            <Button style={{ padding: "2px 4px", minHeight: 0, gap: "3px", maxWidth: "100%" }} onClick={() => openDrawer("scenes")} title={output.out.scene.name}>
                                                <Icon id="scene" size={0.7} white />
                                                <p>{output.out.scene.name}</p>
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            {/* icons */}
                            {!fullscreen && (layers.length < 3 || styleTemplate || isMuted) ? (
                                <div className={styles.icons}>
                                    {!layers.includes("background") ? (
                                        <div className={styles.icon} data-title={translateText("<b>output.disabled_layers:</b> preview.background")}>
                                            <Icon id="media_off" size={0.8} white />
                                        </div>
                                    ) : null}
                                    {!layers.includes("slide") ? (
                                        <div className={styles.icon} data-title={translateText("<b>output.disabled_layers:</b> preview.slide")}>
                                            <Icon id="shows_off" size={0.8} white />
                                        </div>
                                    ) : null}
                                    {!layers.includes("overlays") ? (
                                        <div className={styles.icon} data-title={translateText("<b>output.disabled_layers:</b> preview.overlays")}>
                                            <Icon id="overlays_off" size={0.8} white />
                                        </div>
                                    ) : null}

                                    {styleTemplate && currentTemplates[styleTemplate] ? (
                                        <>
                                            {layers.length < 3 ? <div className={styles.divider}></div> : null}
                                            <div className={styles.icon} data-title={`<b>${translateText(`settings.override${isScriptureOutput ? "_scripture" : ""}_with_template`)}</b>:<br>${currentTemplates[styleTemplate].name}`}>
                                                <Icon id="templates" size={0.8} white />
                                            </div>
                                        </>
                                    ) : null}

                                    {isMuted ? (
                                        <>
                                            {layers.length < 3 || styleTemplate ? <div className={styles.divider}></div> : null}
                                            <div className={`${styles.icon} muted`} data-title={translateText("actions.muted")}>
                                                <Icon id="muted" size={0.8} white />
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            ) : null}

                            {/* Network Output Audio */}
                            {isNetworkOutput ? (
                                <div className={styles.previewMeter}>
                                    <AudioMeter channelId={`network_sub_${output.id}`} preview />
                                </div>
                            ) : null}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

import { useState } from "react"
import type { Output } from "../../../types/Output"
import type { TabsObj } from "../../../types/Tabs"
import { activeShow, outputs, showsCache, slideTimers } from "../../shared/core/stores"
import { getActiveOutputs } from "../../components/helpers/output"
import { _show } from "../../components/helpers/shows"
import { translateText } from "../../utils/language"
import { useStore } from "../hooks/useStore"
import { Tabs } from "../main/Tabs"
import { Audio } from "../output/Audio"
import { NextTimer } from "../output/NextTimer"
import { TimerControls } from "../output/TimerControls"
import { ToolsOverlay } from "../output/ToolsOverlay"
import { Media } from "./tools/Media"
import { Metadata } from "./tools/Metadata"
import { SlideGroups } from "./tools/SlideGroups"
import styles from "./ShowTools.module.css"

// Port autocontenedor de components/show/ShowTools.svelte (P11c): tabs, active y checkMedia viven acá.
export function ShowTools() {
    const [active, setActive] = useState("audio")

    const currentActiveShow = useStore(activeShow)
    const currentOutputs = useStore(outputs)
    const currentShowsCache = useStore(showsCache)
    const currentSlideTimers = useStore(slideTimers)

    const showId = currentActiveShow?.id
    const currentShow = currentShowsCache[showId || ""]
    const activeOutputId = getActiveOutputs(currentOutputs, true, true, true)[0]
    const currentOutput: Output = activeOutputId ? currentOutputs[activeOutputId] || {} : ({} as Output)
    const reference = currentShow?.reference?.type
    const slideTimer: { time?: number; paused?: boolean; timer?: { pause: () => void; resume: () => void } } = currentOutput?.id ? currentSlideTimers[currentOutput.id] || {} : {}

    // checkMedia: la pestaña media se oculta si el show no tiene fondos, overlays, audio, mics ni acciones de slide
    const refs = currentShow ? _show().layouts().ref() : []
    const hasMedia = refs.some((ref) => ref.some((slide) => Boolean(slide.data.background || slide.data.overlays?.length || slide.data.audio || slide.data.mics || slide.data.actions?.slideActions?.length)))
    const tabs: TabsObj = {
        audio: { name: "tabs.audio", icon: "audio" },
        overlays: { name: "clear.overlays", icon: "overlays" },
        timers: { name: "tools.timers", icon: "clock" },
        groups: { name: "tools.groups", icon: "groups" },
        metadata: { name: "tools.metadata", icon: "info" },
        media: { name: "tools.media", icon: "media", remove: !hasMedia }
    }

    return (
        <div className={`main border ${styles.main}`}>
            {reference === "lessons" ? null : (
                <>
                    <Tabs tabs={tabs} active={active} onActiveChange={setActive} labels={false} />
                    <div className={styles.tabTitle}>{translateText(tabs[active]?.name || "")}</div>

                    {currentShow ? (
                        <>
                            {active === "audio" ? (
                                <div className={styles.content}>
                                    <Audio />
                                </div>
                            ) : active === "overlays" ? (
                                <div className={styles.content}>
                                    <ToolsOverlay currentOutput={currentOutput} />
                                </div>
                            ) : active === "timers" ? (
                                <div className={styles.content}>{slideTimer?.timer ? <NextTimer currentOutput={currentOutput} timer={{ time: slideTimer.time ?? 0, paused: slideTimer.paused ?? true, timer: slideTimer.timer }} /> : <TimerControls />}</div>
                            ) : active === "groups" ? (
                                <SlideGroups />
                            ) : active === "media" ? (
                                <div className={styles.content}>
                                    <Media />
                                </div>
                            ) : active === "metadata" ? (
                                <div className={styles.content}>
                                    <Metadata />
                                </div>
                            ) : null}
                        </>
                    ) : null}
                </>
            )}
        </div>
    )
}

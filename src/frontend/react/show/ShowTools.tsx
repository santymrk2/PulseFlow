import { useEffect, useRef } from "react"
import type { Output } from "../../../types/Output"
import type { TabsObj } from "../../../types/Tabs"
import { activeShow, labelsDisabled, outputs, showsCache, slideTimers } from "../../stores"
import { translateText } from "../../utils/language"
import { getActiveOutputs } from "../../components/helpers/output"
import Audio from "../../components/output/tools/Audio.svelte"
import Overlay from "../../components/output/tools/Overlay.svelte"
import TimerControls from "../../components/output/tools/TimerControls.svelte"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { useStore } from "../hooks/useStore"
import { NextTimer } from "../output/NextTimer"
import { Media } from "./tools/Media"
import { Metadata } from "./tools/Metadata"
import { SlideGroups } from "./tools/SlideGroups"
import styles from "./ShowTools.module.css"

export interface ShowToolsProps {
    tabs: TabsObj
    active: string
    tabsHost?: HTMLElement | null
}

// Port de components/show/ShowTools.svelte (F24.20a). Tabs sigue siendo Svelte porque usa `bind:active`.
export function ShowTools({ tabs, active, tabsHost }: ShowToolsProps) {
    const currentActiveShow = useStore(activeShow)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentOutputs = useStore(outputs)
    const currentShowsCache = useStore(showsCache)
    const currentSlideTimers = useStore(slideTimers)

    const showId = currentActiveShow?.id
    const currentShow = currentShowsCache[showId || ""]
    const activeOutputId = getActiveOutputs(currentOutputs, true, true, true)[0]
    const currentOutput: Output = activeOutputId ? currentOutputs[activeOutputId] || {} : ({} as Output)
    const reference = currentShow?.reference?.type
    const slideTimer: { time?: number; paused?: boolean; timer?: { pause: () => void; resume: () => void } } = currentOutput?.id ? currentSlideTimers[currentOutput.id] || {} : {}

    const tabsRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const container = tabsRef.current
        if (!container || !tabsHost) return
        container.appendChild(tabsHost)
        return () => {
            if (tabsHost.parentNode === container) container.removeChild(tabsHost)
        }
    }, [tabsHost])

    return (
        <div className={`main border ${styles.main} ${!currentLabelsDisabled ? styles.labels : ""}`}>
            {reference === "lessons" ? null : (
                <>
                    <div ref={tabsRef} style={{ display: "contents" }} />
                    <div className={styles.tabTitle}>{translateText(tabs[active]?.name || "")}</div>

                    {currentShow ? (
                        <>
                            {active === "audio" ? (
                                <div className={styles.content}>
                                    <SvelteIsland component={Audio} />
                                </div>
                            ) : active === "overlays" ? (
                                <div className={styles.content}>
                                    <SvelteIsland component={Overlay} props={{ currentOutput }} />
                                </div>
                            ) : active === "timers" ? (
                                <div className={styles.content}>{slideTimer?.timer ? <NextTimer currentOutput={currentOutput} timer={{ time: slideTimer.time ?? 0, paused: slideTimer.paused ?? true, timer: slideTimer.timer }} /> : <SvelteIsland component={TimerControls} />}</div>
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

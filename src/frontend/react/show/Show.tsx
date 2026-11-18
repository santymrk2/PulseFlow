import { useEffect, useRef } from "react"
import { activeProject, activeShow, autoOpenedTimeline, outLocked, projects, resized, showsCache, special, templateApplied } from "../../stores"
import { DEFAULT_WIDTH } from "../../utils/common"
import { createGlobalTimerFromLocalTimer } from "../../components/drawer/timers/timers"
import { setOutput } from "../../components/helpers/output"
import NdiStreamSvelte from "../../components/drawer/live/NDIStream.svelte"
import { Splash } from "../main/Splash"
import { Camera } from "../output/Camera"
import { Layouts } from "../slide/Layouts"
import { Timeline } from "../timeline/Timeline"
import { Resizeable } from "../system/Resizeable"
import { HoverPlay } from "../system/HoverPlay"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { useStore } from "../hooks/useStore"
import { AudioPreview } from "./AudioPreview"
import { Capture } from "../drawer/live/Capture"
import { EffectPreview } from "./effect/EffectPreview"
import { FolderShow } from "./folder/FolderShow"
import { MediaPreview } from "./media/MediaPreview"
import { OverlayPreview } from "./overlay/OverlayPreview"
import { PdfPreview } from "./pdf/PdfPreview"
import { ProjectShowPlaceholder } from "./placeholder/ProjectShowPlaceholder"
import { PowerPointPreview } from "./ppt/PowerPointPreview"
import { Section } from "./Section"
import { ShowNotes } from "./ShowNotes"
import { Slides } from "./Slides"
import styles from "./Show.module.css"

// Port (F24.20a).
export function Show() {
    const currentActiveShow = useStore(activeShow)
    const currentActiveProject = useStore(activeProject)
    const currentProjects = useStore(projects)
    const currentShowsCache = useStore(showsCache)
    const currentAutoOpenedTimeline = useStore(autoOpenedTimeline)
    const currentOutLocked = useStore(outLocked)
    const currentResized = useStore(resized)
    const currentSpecial = useStore(special)
    const currentTemplateApplied = useStore(templateApplied)

    const show = currentActiveShow
    const position = currentProjects[currentActiveProject || ""]?.shows?.findIndex((item) => item.id === show?.id)
    const currentShow = show && (show.type || "show") === "show" ? currentShowsCache[show.id] : null
    const layoutId = currentShow?.settings?.activeLayout || null
    const hasTimelineContent = ((layoutId && currentShow?.layouts?.[layoutId]?.timeline?.actions?.length) || 0) > 0

    const previousShow = useRef("")
    const previousHasContent = useRef(false)

    useEffect(() => {
        if (show?.id) createGlobalTimerFromLocalTimer(show.id)
    }, [show?.id])

    useEffect(() => {
        if (currentAutoOpenedTimeline && (currentResized.timeline || 0) > 40) autoOpenedTimeline.set(false)
    }, [currentAutoOpenedTimeline, currentResized.timeline])

    function autoOpenTimeline(open = true) {
        special.update((all) => ({ ...all, timelineActive: open }))
        autoOpenedTimeline.set(open)
        resized.update((all) => ({ ...all, timeline: open ? 40 : DEFAULT_WIDTH }))
    }

    useEffect(() => {
        const current = show ? `${show.id}_${layoutId}` : ""
        const showChanged = current !== previousShow.current
        previousShow.current = current
        if (hasTimelineContent) {
            if ((showChanged || !previousHasContent.current) && !currentSpecial.timelineActive) autoOpenTimeline()
        } else if (currentAutoOpenedTimeline && currentSpecial.timelineActive) {
            autoOpenTimeline(false)
        }
        previousHasContent.current = hasTimelineContent
    }, [show?.id, layoutId, hasTimelineContent, currentSpecial.timelineActive, currentAutoOpenedTimeline])

    return (
        <div className={styles.double}>
            <div id="showArea" className={`main ${styles.main} ${currentTemplateApplied ? styles.highlight : ""}`}>
                {show ? (
                    <>
                        {show.type === "video" || show.type === "image" || show.type === "player" ? (
                            <MediaPreview />
                        ) : show.type === "audio" ? (
                            <AudioPreview active={currentActiveShow} />
                        ) : show.type === "section" ? (
                            <div key={String(position !== undefined)}>
                                <Section section={show} />
                            </div>
                        ) : show.type === "overlay" ? (
                            <OverlayPreview show={show as never} />
                        ) : show.type === "effect" ? (
                            <EffectPreview show={show as never} />
                        ) : show.type === "pdf" ? (
                            <div key={show.id}>
                                <PdfPreview show={show} index={show.index || 0} />
                            </div>
                        ) : show.type === "ppt" ? (
                            <PowerPointPreview show={show} />
                        ) : show.type === "camera" ? (
                            <HoverPlay
                                icon="play"
                                size={10}
                                onClick={() => {
                                    if (!currentOutLocked) setOutput("background", { id: show.id, type: show.type })
                                }}
                            >
                                <Camera id={show.id} groupId={show.data?.groupId || ""} className="media" preview />
                            </HoverPlay>
                        ) : show.type === "screen" ? (
                            <HoverPlay
                                icon="play"
                                size={10}
                                onClick={() => {
                                    if (!currentOutLocked) setOutput("background", { id: show.id, type: show.type })
                                }}
                            >
                                <Capture screen={{ id: show.id, name: show.name || "" }} streams={[]} background />
                            </HoverPlay>
                        ) : show.type === "ndi" ? (
                            <HoverPlay
                                icon="play"
                                size={10}
                                onClick={() => {
                                    if (!currentOutLocked) setOutput("background", { id: show.id, type: show.type })
                                }}
                            >
                                <SvelteIsland component={NdiStreamSvelte} props={{ screen: { id: show.id, name: show.name || "" }, background: true }} />
                            </HoverPlay>
                        ) : show.type === "folder" ? (
                            <div key={show.id}>
                                <FolderShow path={show.id} index={show.index || 0} />
                            </div>
                        ) : (show.type || "show") === "show" ? (
                            <>
                                <Slides showId={currentActiveShow?.id || ""} />
                                <Layouts />
                            </>
                        ) : show.type === "show_placeholder" ? (
                            <ProjectShowPlaceholder />
                        ) : (
                            <p style={{ textAlign: "center", textTransform: "capitalize", opacity: 0.8 }}>{show.type}</p>
                        )}
                    </>
                ) : (
                    <Splash />
                )}
            </div>

            {show && (show.type || "show") === "show" ? (
                <>
                    <ShowNotes />
                    {currentSpecial.timelineActive ? (
                        <Resizeable id="timeline" side="bottom" maxWidth={DEFAULT_WIDTH} minWidth={40}>
                            <div key={`${show.id}_${layoutId}`}>
                                <Timeline type="show" isClosed={currentResized.timeline <= 40} />
                            </div>
                        </Resizeable>
                    ) : null}
                </>
            ) : null}
        </div>
    )
}

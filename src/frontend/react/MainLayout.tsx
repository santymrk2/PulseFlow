import { useEffect, useRef } from "react"
import { activeEdit, activePage, activeProfile, activeProject, activeShow, activeStage, currentWindow, editMode, focusMode, loaded, os, projectView, resized, showChangeProfileMenu, showsCache, special } from "../shared/core/stores"
import { DEFAULT_WIDTH } from "../shared/utils/common"
import { customActionActivation } from "../components/actions/actions"
import { useStore } from "../shared/ui/hooks/useStore"
import { LeftColumn } from "./show/left/LeftColumn"
import { Drawer } from "./drawer/Drawer"
import { Show } from "./show/Show"
import { FocusMode } from "./show/focus/FocusMode"
import Preview from "./output/Preview"
import { Resizeable } from "../shared/ui/system/Resizeable"
import { StageLayouts } from "./stage/StageLayouts"
import { StageLayout } from "./stage/StageLayout"
import { StageTools } from "./stage/StageTools"
import { Timeline } from "./timeline/Timeline"
import { ProfileChangerMenu } from "./main/ProfileChangerMenu"
import { Tipbar } from "./main/Tipbar"
import { Top } from "./main/Top"
import { Navigation } from "./edit/Navigation"
import { OverlayNavigation } from "./edit/OverlayNavigation"
import { ThemeNavigation } from "./edit/ThemeNavigation"
import { Editor } from "./edit/Editor"
import { EditTools } from "./edit/EditTools"
import { AudioTools } from "./edit/AudioTools"
import { EffectTools } from "./edit/EffectTools"
import { MediaTools } from "./edit/MediaTools"
import { SceneTools } from "./edit/SceneTools"
import { ShowTools } from "./show/ShowTools"
import styles from "./MainLayout.module.css"

export function MainLayout() {
    const page = useStore(activePage)
    const windowType = useStore(currentWindow)
    const osValue = useStore(os)
    const activeShowValue = useStore(activeShow)
    const focusModeValue = useStore(focusMode)
    const activeEditValue = useStore(activeEdit)
    const activeStageValue = useStore(activeStage)
    const showsCacheValue = useStore(showsCache)
    const editModeValue = useStore(editMode)
    const specialValue = useStore(special)
    const activeProjectId = useStore(activeProject)
    const projectViewValue = useStore(projectView)
    const resizedValue = useStore(resized)
    const isLoaded = useStore(loaded)
    const showProfileMenu = useStore(showChangeProfileMenu)
    const activeProfileId = useStore(activeProfile)

    const previousId = useRef("")
    const isWindows = !windowType && osValue.platform === "win32"

    useEffect(() => {
        if (activeShowValue?.id === previousId.current) return
        if (!activeShowValue?.id || activeShowValue?.type !== "show") return

        const timer = setTimeout(() => customActionActivation("show_opened"), 50)
        previousId.current = activeShowValue.id
        return () => clearTimeout(timer)
    }, [activeShowValue?.id, activeShowValue?.type])

    const showRightEditTools = page === "edit" && (activeEditValue.type === "overlay" || activeEditValue.type === "template" || !!showsCacheValue[activeShowValue?.id || ""])
    const hideGeneralEditTools = focusModeValue || ((activeEditValue.type || "show") === "show" && editModeValue !== "default")

    return (
        <div className={styles.column}>
            {!focusModeValue ? <Top isWindows={isWindows} /> : null}
            <div className={styles.row}>
                <Resizeable id="leftPanel">
                    <div className={styles.left}>
                        {page === "show" ? (
                            <div key={activeProfileId || "none"} style={{ display: "contents" }}>
                                <LeftColumn />
                            </div>
                        ) : page === "edit" ? (
                            activeEditValue.type === "template" ? (
                                <ThemeNavigation />
                            ) : activeEditValue.type === "overlay" || activeEditValue.type === "effect" ? (
                                <OverlayNavigation />
                            ) : (
                                <Navigation />
                            )
                        ) : page === "stage" ? (
                            <StageLayouts />
                        ) : null}
                    </div>
                </Resizeable>

                <div className={styles.center}>{page === "show" ? focusModeValue ? <FocusMode /> : <Show /> : page === "edit" ? <Editor /> : page === "stage" ? <StageLayout /> : null}</div>

                <Resizeable id="rightPanel" side="right">
                    {(width) => (
                        <div className={`${styles.right}${width > DEFAULT_WIDTH * 1.8 ? ` ${styles.rowRight}` : ""}`}>
                            <Preview />

                            {page === "show" ? (
                                activeShowValue && (activeShowValue.type === "show" || activeShowValue.type === undefined) && !focusModeValue ? (
                                    <ShowTools />
                                ) : null
                            ) : page === "edit" ? (
                                activeEditValue.type === "media" || activeEditValue.type === "camera" ? (
                                    <MediaTools />
                                ) : activeEditValue.type === "audio" ? (
                                    <AudioTools />
                                ) : activeEditValue.type === "effect" ? (
                                    <EffectTools />
                                ) : activeEditValue.type === "scene" ? (
                                    <SceneTools />
                                ) : showRightEditTools ? (
                                    hideGeneralEditTools ? null : (
                                        <EditTools />
                                    )
                                ) : null
                            ) : page === "stage" && activeStageValue.id ? (
                                <StageTools />
                            ) : null}
                        </div>
                    )}
                </Resizeable>
            </div>

            {page === "show" && specialValue.projectTimelineActive && activeProjectId && !projectViewValue ? (
                <Resizeable id="project_timeline" side="bottom" maxWidth={DEFAULT_WIDTH} minWidth={40}>
                    <div key={activeProjectId} style={{ display: "contents" }}>
                        <Timeline type="project" isClosed={(resizedValue.project_timeline || 0) <= 40} />
                    </div>
                </Resizeable>
            ) : null}

            {isLoaded && (page === "show" || page === "edit") ? <Drawer /> : null}

            {showProfileMenu && activeProfileId !== null ? <ProfileChangerMenu /> : null}

            <Tipbar />
        </div>
    )
}

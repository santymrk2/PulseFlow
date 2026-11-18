import { useEffect, useRef } from "react"
import { activeEdit, activePage, activeProfile, activeProject, activeShow, activeStage, currentWindow, editMode, focusMode, loaded, os, projectView, resized, showChangeProfileMenu, showsCache, special } from "../stores"
import { DEFAULT_WIDTH } from "../utils/common"
import { customActionActivation } from "../components/actions/actions"
import { useStore } from "./hooks/useStore"
import { SvelteIsland } from "./bridge/SvelteIsland"
import { LeftColumn } from "./show/left/LeftColumn"
import { Drawer } from "./drawer/Drawer"
import { Show } from "./show/Show"
import { FocusMode } from "./show/focus/FocusMode"
import Preview from "./output/Preview"
import { Resizeable } from "./system/Resizeable"
import { StageLayouts } from "./stage/StageLayouts"
import { StageLayout } from "./stage/StageLayout"
import { StageTools } from "./stage/StageTools"
import { Timeline } from "./timeline/Timeline"
import { ProfileChangerMenu } from "./main/ProfileChangerMenu"
import { Tipbar } from "./main/Tipbar"
import { Top } from "./main/Top"
import Navigation from "../components/edit/Navigation.svelte"
import OverlayNavigation from "../components/edit/OverlayNavigation.svelte"
import ThemeNavigation from "../components/edit/ThemeNavigation.svelte"
import Editor from "../components/edit/Editor.svelte"
import EditTools from "../components/edit/EditTools.svelte"
import ShowTools from "../components/show/ShowTools.svelte"
import AudioTools from "../components/edit/AudioTools.svelte"
import EffectTools from "../components/edit/EffectTools.svelte"
import MediaTools from "../components/edit/MediaTools.svelte"
import SceneTools from "../components/edit/SceneTools.svelte"
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
                                <SvelteIsland component={ThemeNavigation} />
                            ) : activeEditValue.type === "overlay" || activeEditValue.type === "effect" ? (
                                <SvelteIsland component={OverlayNavigation} />
                            ) : (
                                <SvelteIsland component={Navigation} />
                            )
                        ) : page === "stage" ? (
                            <StageLayouts />
                        ) : null}
                    </div>
                </Resizeable>

                <div className={styles.center}>
                    {page === "show" ? (
                        focusModeValue ? <FocusMode /> : <Show />
                    ) : page === "edit" ? (
                        <SvelteIsland component={Editor} />
                    ) : page === "stage" ? (
                        <StageLayout />
                    ) : null}
                </div>

                <Resizeable id="rightPanel" side="right">
                    {(width) => (
                        <div className={`${styles.right}${width > DEFAULT_WIDTH * 1.8 ? ` ${styles.rowRight}` : ""}`}>
                            <Preview />

                            {page === "show" ? (
                                activeShowValue && (activeShowValue.type === "show" || activeShowValue.type === undefined) && !focusModeValue ? <SvelteIsland component={ShowTools} /> : null
                            ) : page === "edit" ? (
                                activeEditValue.type === "media" || activeEditValue.type === "camera" ? (
                                    <SvelteIsland component={MediaTools} />
                                ) : activeEditValue.type === "audio" ? (
                                    <SvelteIsland component={AudioTools} />
                                ) : activeEditValue.type === "effect" ? (
                                    <SvelteIsland component={EffectTools} />
                                ) : activeEditValue.type === "scene" ? (
                                    <SvelteIsland component={SceneTools} />
                                ) : showRightEditTools ? (
                                    hideGeneralEditTools ? null : (
                                        <SvelteIsland component={EditTools} />
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

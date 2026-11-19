import { useState } from "react"
import { activeDrawerTab, activeEdit, activeLook, activePage, activePopup, activeProfile, activeProject, activeShow, cloudUsers, drawer, looks, outputDisplay, outputState, outputs, profiles, quickSearchActive, saved, shows } from "../../shared/core/stores"
import type { Look } from "../../../types/Settings"
import type { TopViews } from "../../../types/Tabs"
import { translateText } from "../../shared/utils/language"
import { DEFAULT_DRAWER_HEIGHT } from "../../shared/utils/common"
import { getCloudUsers } from "../../app/wiring/cloudSync"
import { openOverlayEditor, openThemeEditor } from "../../components/edit/scripts/libraryEditor"
import { getAllNormalOutputs, getAllStageOutputs, toggleOutputs } from "../../shared/utils/helpers/output"
import { applyLook } from "../../shared/utils/helpers/looks"
import { DEFAULT_DISPLAY_NAME } from "../../shared/utils/SocketHelper"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import { Button } from "../ui/button/Button"
import { Capsule } from "../ui/capsule/Capsule"
import { Menu } from "../ui/menu/Menu"
import { MenuItem } from "../ui/menu/MenuItem"
import { MenuSeparator } from "../ui/menu/MenuSeparator"
import { TopButton } from "./TopButton"
import styles from "./Top.module.css"

export interface TopProps {
    isWindows?: boolean
}

export function Top({ isWindows = false }: TopProps) {
    const showsValue = useStore(shows)
    const activeShowRef = useStore(activeShow)
    const activeEditValue = useStore(activeEdit)
    const profilesValue = useStore(profiles)
    const activeProfileId = useStore(activeProfile)
    const looksValue = useStore(looks)
    const activeLookId = useStore(activeLook)
    const cloudUsersValue = useStore(cloudUsers)
    const savedValue = useStore(saved)
    const outputsValue = useStore(outputs)
    const outputDisplayValue = useStore(outputDisplay)
    const outputStateValue = useStore(outputState)
    const drawerValue = useStore(drawer)
    const activeDrawer = useStore(activeDrawerTab)
    const activeProjectId = useStore(activeProject)
    const activePageId = useStore(activePage)

    const [moreOpen, setMoreOpen] = useState(false)
    const [lookOpen, setLookOpen] = useState(false)

    const show = showsValue[activeShowRef?.id || ""]
    const profile = profilesValue[activeProfileId || ""]
    const showProfile = (profile?.access?.shows || {}) as Record<string, string>
    const isLocked = show?.locked || showProfile.global === "read" || showProfile[show?.category || ""] === "read"
    const editDisabled = activeEditValue.id && (activeEditValue.type || "show") !== "show" ? false : activeShowRef && (activeShowRef?.type || "show") === "show" ? isLocked : activeShowRef?.type === "pdf" || !activeShowRef?.id
    const physicalOutputWindows = Object.values(outputsValue).filter((a) => a.enabled && !a.invisible)

    const lookOptions = Object.entries((looksValue || {}) as Record<string, Look>).map(([id, look]) => ({ id, label: look?.name || id, value: id }))
    const users = getCloudUsers(cloudUsersValue)

    function goToUser(user: (typeof users)[number] & { activePage?: string; activeProject?: string | null; activeShow?: { id?: string; type?: string } | null }) {
        if (user.activePage) activePage.set(user.activePage as TopViews)
        if (user.activeProject) activeProject.set(user.activeProject)
        if (user.activeShow) {
            activeShow.set(user.activeShow as typeof activeShowRef)
            if (user.activeShow.type === "image" || user.activeShow.type === "video") activeEdit.set({ id: user.activeShow.id || "", type: "media", items: [] })
            else activeEdit.set({ type: "show", slide: 0, items: [], showId: user.activeShow.id || "" })
        }
    }

    function openOutputSettings() {
        activePopup.set("screen_config")
    }

    function openScriptureDrawer() {
        activeDrawerTab.set("scripture")
        if (drawerValue.height < 300) drawer.set({ height: drawerValue.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
    }

    function toggleMediaDrawer() {
        if (activeDrawer === "media" && drawerValue.height > 40) {
            drawer.set({ height: 40, stored: drawerValue.height, autoclosed: true })
        } else {
            activeDrawerTab.set("media")
            if (drawerValue.height < 300) drawer.set({ height: drawerValue.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
        }
    }

    function toggleAudience() {
        toggleOutputs(getAllNormalOutputs().map((a) => a.id))
    }

    function toggleStage() {
        toggleOutputs(getAllStageOutputs().map((a) => a.id))
    }

    const normalOutputIds = getAllNormalOutputs().map((o) => o.id)
    const stageOutputIds = getAllStageOutputs().map((o) => o.id)
    const audienceLive = (outputStateValue || []).some((s) => s.active === true && normalOutputIds.includes(s.id))
    const stageLive = (outputStateValue || []).some((s) => s.active === true && stageOutputIds.includes(s.id))

    function runMore(fn: () => void) {
        fn()
        setMoreOpen(false)
    }

    function applyLookFromMenu(id: string) {
        applyLook(id)
        setLookOpen(false)
    }

    function editLooks() {
        setLookOpen(false)
        activePopup.set("looks")
    }

    function onScreensContextMenu(e: React.MouseEvent) {
        e.preventDefault()
        activePopup.set("screen_config")
    }

    void activeProjectId
    void activePageId

    return (
        <div className={styles.top} data-tauri-drag-region>
            <span style={{ width: "var(--navigation-width)" }} data-tauri-drag-region>
                {!isWindows ? <div className={styles.macTitleSpace} data-tauri-drag-region /> : null}
            </span>

            <Capsule>
                <Button variant="ghost" size="sm" data-title={translateText("menu.search")} onClick={() => quickSearchActive.set(true)}>
                    <Icon id="search" size={1} white />
                </Button>
            </Capsule>

            <Capsule>
                <TopButton id="show" />
                <TopButton id="edit" disabled={editDisabled} />
                <Button variant="ghost" size="sm" data-title={translateText("menu.bible")} onClick={() => openScriptureDrawer()}>
                    <Icon id="scripture" size={1} white />
                </Button>
                <div className={styles.menuAnchor}>
                    <Button variant="ghost" size="sm" data-title={translateText("menu.more")} onClick={() => setMoreOpen((v) => !v)}>
                        <Icon id="more" size={1} white />
                    </Button>
                    <Menu open={moreOpen} onClose={() => setMoreOpen(false)}>
                        <MenuItem onClick={() => runMore(() => activePage.set("stage"))}>{translateText("menu.stage_editor")}</MenuItem>
                        <MenuItem onClick={() => runMore(openThemeEditor)}>{translateText("menu.theme_editor")}</MenuItem>
                        <MenuItem onClick={() => runMore(() => openOverlayEditor())}>{translateText("menu.overlay_editor")}</MenuItem>
                    </Menu>
                </div>
            </Capsule>

            <span className={styles.spacer} data-tauri-drag-region />

            <Capsule>
                <Button variant="ghost" size="sm" data-title={translateText("menu.media")} onClick={() => toggleMediaDrawer()}>
                    <Icon id="media" size={1} white />
                </Button>
                <div className={styles.menuAnchor}>
                    <Button variant="ghost" size="sm" data-title={`${translateText("looks.looks")}: ${looksValue[activeLookId || ""]?.name || ""}`} onClick={() => setLookOpen((v) => !v)}>
                        <Icon id="looks" size={1} white />
                    </Button>
                    <Menu open={lookOpen} className={styles.lookMenu} onClose={() => setLookOpen(false)}>
                        {lookOptions.map((look) => (
                            <MenuItem key={look.id} checked={look.id === activeLookId} onClick={() => applyLookFromMenu(look.id)}>
                                {look.label}
                            </MenuItem>
                        ))}
                        {lookOptions.length ? <MenuSeparator /> : null}
                        <MenuItem onClick={editLooks}>{translateText("looks.edit_looks")}</MenuItem>
                    </Menu>
                </div>
            </Capsule>

            <Capsule>
                <Button variant="live" size="sm" aria-pressed={audienceLive} data-title={translateText("menu.audience")} onContextMenu={onScreensContextMenu} onClick={() => toggleAudience()}>
                    <Icon id="display" size={1} white />
                </Button>
                <Button variant="live" size="sm" aria-pressed={stageLive} data-title={translateText("menu.stage")} onContextMenu={onScreensContextMenu} onClick={() => toggleStage()}>
                    <Icon id="stage" size={1} white />
                </Button>
                {users.length ? (
                    <div className={styles.users} data-title={translateText("settings.connections")}>
                        {users.map((user, i) => {
                            const name = user.displayName || DEFAULT_DISPLAY_NAME
                            return (
                                <button key={user.deviceId || `${name}-${i}`} className={`${styles.user}${activeShowRef && user.activeShow?.id === activeShowRef?.id ? ` ${styles.isSameArea}` : ""}`} title={name} style={{ backgroundColor: user.color || "" }} onClick={() => goToUser(user)}>
                                    {name === DEFAULT_DISPLAY_NAME ? <Icon id="profiles" size={0.9} white /> : name.charAt(0)}
                                </button>
                            )
                        })}
                    </div>
                ) : null}
            </Capsule>

            <span style={{ width: "var(--navigation-width)", justifyContent: "flex-end" }} data-tauri-drag-region>
                <span className={`${styles.unsavedDot}${savedValue ? ` ${styles.hidden}` : ""}`} data-title={translateText("menu.unsaved")} role="none" />
                {!outputDisplayValue && !physicalOutputWindows.length ? <div data-title={translateText("No 'physical' outputs available!")} style={{ position: "absolute", top: 0, insetInlineEnd: 0, height: "100%", width: "60px" }} role="none" onClick={openOutputSettings} /> : null}
            </span>
        </div>
    )
}

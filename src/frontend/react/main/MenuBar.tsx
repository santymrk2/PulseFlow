import { useEffect, useRef, useState } from "react"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../IPC/main"
import { activeLook, activePopup, activeProfile, looks, profiles, saved, topContextActive, windowState } from "../../stores"
import type { Look } from "../../../types/Settings"
import { translateText } from "../../utils/language"
import { initializeClosing } from "../../utils/save"
import { applyLook } from "../../components/helpers/looks"
import { getAllNormalOutputs, getAllStageOutputs, toggleOutputs } from "../../components/helpers/output"
import { contextMenuItems, contextMenuLayouts } from "../../components/context/contextMenus"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { SvelteIsland } from "../bridge/SvelteIsland"
import ContextChild from "../../components/context/ContextChild.svelte"
import ContextItem from "../../components/context/ContextItem.svelte"
import styles from "./MenuBar.module.css"

const menus = ["file", "edit", "view", "help", "screens"] as const
const screensMenu = ["screens_toggle_audience", "screens_toggle_stage", "SEPARATOR", "screens_config", "screens_looks", "SEPARATOR", "screens_live"]

const screensMenuItems: Record<string, { label: string; shortcuts?: string[]; icon?: string }> = {
    screens_toggle_audience: { label: "screen_config.show_audience", shortcuts: ["Ctrl+1"], icon: "display" },
    screens_toggle_stage: { label: "screen_config.show_stage", shortcuts: ["Ctrl+2"], icon: "stage" },
    screens_config: { label: "screen_config.configure", icon: "settings" },
    screens_looks: { label: "screen_config.manage_looks", icon: "styles" },
    screens_live: { label: "menu.live", icon: "live" }
}

export function MenuBar() {
    const savedValue = useStore(saved)
    const windowStateValue = useStore(windowState)
    const topActive = useStore(topContextActive)
    const activeProfileId = useStore(activeProfile)
    const profilesValue = useStore(profiles)
    const looksValue = useStore(looks)
    const activeLookId = useStore(activeLook)

    const [activeID, setActiveID] = useState<string | null>(null)
    const [x, setX] = useState(0)
    const [activeMenu, setActiveMenu] = useState<string[]>([])
    const menuRef = useRef<HTMLDivElement>(null)
    const y = 25

    const maximized = !!windowStateValue.maximized

    function closeTopMenu() {
        topContextActive.set(false)
        setActiveID(null)
    }

    function menu(e: React.MouseEvent<HTMLElement>) {
        const target = e.target as HTMLElement
        const id = target.id || target.closest("[id]")?.id || ""
        if (!menus.includes(id as (typeof menus)[number])) return

        const next = activeID !== id
        topContextActive.set(next)
        setActiveID(next ? id : null)

        if (!next) return
        setX(target.offsetLeft || (target.closest("button") as HTMLElement | null)?.offsetLeft || 0)
        setActiveMenu(id === "screens" ? screensMenu : (contextMenuLayouts as Record<string, string[]>)[id] || [])
    }

    function move(e: React.MouseEvent<HTMLElement>) {
        if (!topActive) return
        const target = e.target as HTMLElement
        const id = target.id || target.closest("[id]")?.id || ""
        if (!id || activeID === id || !menus.includes(id as (typeof menus)[number])) return
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        topContextActive.set(true)
        setActiveID(id)
        setX(target.offsetLeft || (target.closest("button") as HTMLElement | null)?.offsetLeft || 0)
        setActiveMenu(id === "screens" ? screensMenu : (contextMenuLayouts as Record<string, string[]>)[id] || [])
    }

    function toggleScreens(type: "audience" | "stage") {
        const ids = (type === "stage" ? getAllStageOutputs() : getAllNormalOutputs()).map((a) => a.id)
        if (ids.length) toggleOutputs(ids)
        closeTopMenu()
    }

    useEffect(() => {
        function onClick(e: MouseEvent) {
            const target = e.target as HTMLElement | null
            if (target?.closest(".menu") || target?.closest(`.${styles.menus}`)) return
            topContextActive.set(false)
        }
        window.addEventListener("click", onClick)
        window.addEventListener("contextmenu", onClick)
        return () => {
            window.removeEventListener("click", onClick)
            window.removeEventListener("contextmenu", onClick)
        }
    }, [])

    useEffect(() => {
        if (topActive === false) setActiveID(null)
    }, [topActive])

    const profileIds = Object.keys(profilesValue).filter((a) => a !== "admin")

    return (
        <main className={styles.main} style={{ height: `${y}px` }}>
            {topActive && activeID && activeID !== "screens" ? (
                <div ref={menuRef} className={`${styles.contextMenu} ${styles.menu} contextMenu menu`} style={{ insetInlineStart: `${x}px`, top: `${y}px` }}>
                    {activeMenu.map((id, i) => {
                        if (id === "SEPARATOR") return <hr key={`sep-${i}`} className={styles.hr} />
                        if ((contextMenuItems as Record<string, { items?: unknown[] }>)[id]?.items) {
                            return <SvelteIsland key={`${id}-${i}`} component={ContextChild} props={{ id, topBar: true, contextElem: menuRef.current }} />
                        }
                        return <SvelteIsland key={`${id}-${i}`} component={ContextItem} props={{ id, topBar: true, contextElem: menuRef.current }} />
                    })}
                </div>
            ) : null}

            <div className={`nocontext menus ${styles.menus}`} onMouseMove={move} onClick={menu} onContextMenu={menu}>
                {menus.map((id) => (
                    <Button key={id} align="start" id={id} isActive={activeID === id} red={id === "file" && !savedValue}>
                        <T id={`titlebar.${id}`} />
                    </Button>
                ))}
            </div>

            {activeID === "screens" ? (
                <div ref={menuRef} className={`${styles.contextMenu} ${styles.menu} contextMenu menu`} style={{ insetInlineStart: `${x}px`, top: `${y}px` }}>
                    <SvelteIsland
                        component={ContextItem}
                        props={{ contextElem: menuRef.current, topBar: true, id: "screens_toggle_audience", menu: screensMenuItems.screens_toggle_audience }}
                        events={{ click: () => toggleScreens("audience") }}
                    />
                    <SvelteIsland
                        component={ContextItem}
                        props={{ contextElem: menuRef.current, topBar: true, id: "screens_toggle_stage", menu: screensMenuItems.screens_toggle_stage }}
                        events={{ click: () => toggleScreens("stage") }}
                    />
                    <hr className={styles.hr} />
                    <SvelteIsland
                        component={ContextItem}
                        props={{ contextElem: menuRef.current, topBar: true, id: "screens_config", menu: screensMenuItems.screens_config }}
                        events={{
                            click: () => {
                                activePopup.set("screen_config")
                                closeTopMenu()
                            }
                        }}
                    />
                    <SvelteIsland
                        component={ContextItem}
                        props={{ contextElem: menuRef.current, topBar: true, id: "screens_looks", menu: screensMenuItems.screens_looks }}
                        events={{
                            click: () => {
                                activePopup.set("looks")
                                closeTopMenu()
                            }
                        }}
                    />
                    <hr className={styles.hr} />
                    <div className={styles.liveGroup}>
                        <SvelteIsland component={ContextItem} props={{ contextElem: menuRef.current, topBar: true, id: "screens_live", menu: screensMenuItems.screens_live }} />
                        <div className={styles.liveItems}>
                            {Object.keys(looksValue || {}).length ? (
                                Object.entries((looksValue || {}) as Record<string, Look>).map(([lookId, look]) => (
                                    <button
                                        key={lookId}
                                        className={`${styles.liveLook}${activeLookId === lookId ? ` ${styles.active}` : ""}`}
                                        onClick={() => {
                                            applyLook(lookId)
                                            closeTopMenu()
                                        }}
                                    >
                                        <span>{look?.name || lookId}</span>
                                        {activeLookId === lookId ? <span className={styles.check}>✓</span> : null}
                                    </button>
                                ))
                            ) : (
                                <span className={styles.empty}>({translateText("looks.no_looks")})</span>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {activeProfileId && profileIds.length > 1 ? (
                <div className={styles.info}>
                    <T id="profile.profile" />: {profilesValue[activeProfileId]?.name || "—"}
                </div>
            ) : null}

            <div className={`${styles.window} window`}>
                <Button onClick={() => sendMain(Main.MINIMIZE)}>
                    <Icon id="remove" size={1.2} white />
                </Button>
                <Button onClick={() => sendMain(Main.MAXIMIZE)} style={{ transform: "rotate(180deg)" }}>
                    <Icon id={maximized ? "maximized" : "unmaximized"} size={maximized ? 0.8 : 0.9} white />
                </Button>
                <Button id="close" onClick={() => initializeClosing()}>
                    <Icon id="close" size={1.2} white />
                </Button>
            </div>
        </main>
    )
}

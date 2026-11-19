import { useEffect, useRef, useState } from "react"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { activeLook, activeProfile, looks, profiles, saved, topContextActive, windowState } from "../../shared/core/stores"
import type { Look } from "../../../types/Settings"
import { translateText } from "../../shared/utils/language"
import { initializeClosing } from "../../app/wiring/save"
import { applyLook } from "../../shared/utils/helpers/looks"
import { contextMenuItems, contextMenuLayouts } from "../../shared/ui/context/logic/contextMenus"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"
import { ContextChild } from "../../shared/ui/context/ContextChild"
import { ContextItem } from "../../shared/ui/context/ContextItem"
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
                            return <ContextChild key={`${id}-${i}`} id={id} topBar={true} contextElem={menuRef.current} />
                        }
                        return <ContextItem key={`${id}-${i}`} id={id} topBar={true} contextElem={menuRef.current} />
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
                    <ContextItem contextElem={menuRef.current} topBar={true} id="screens_toggle_audience" menu={screensMenuItems.screens_toggle_audience} />
                    <ContextItem contextElem={menuRef.current} topBar={true} id="screens_toggle_stage" menu={screensMenuItems.screens_toggle_stage} />
                    <hr className={styles.hr} />
                    <ContextItem contextElem={menuRef.current} topBar={true} id="screens_config" menu={screensMenuItems.screens_config} />
                    <ContextItem contextElem={menuRef.current} topBar={true} id="screens_looks" menu={screensMenuItems.screens_looks} />
                    <hr className={styles.hr} />
                    <div className={styles.liveGroup}>
                        <ContextItem contextElem={menuRef.current} topBar={true} id="screens_live" menu={screensMenuItems.screens_live} />
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

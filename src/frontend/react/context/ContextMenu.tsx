// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react"
import { activePage, activePopup, contextActive, contextData, currentWindow, dictionary, localeDirection, os, serverData, slideDeleteHighlight, special, spellcheck, theme, themes } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { closeContextMenu } from "../../app/wiring/shortcuts"
import { getEditItems } from "../../components/edit/scripts/itemHelpers"
import { hexToRgb } from "../../shared/utils/helpers/color"
import { contextMenuGroups, contextMenuItems, contextMenuLayouts } from "../../components/context/contextMenus"
import { contextMenuMode } from "../../components/context/nativeMenu"
import { flattenMenuItems, handleKeydown as handleSearchKeydown, searchMenuItems, type FlatMenuItem } from "../../components/context/contextMenuSearch"
import { quickLoadItems } from "../../components/context/loadItems"
import { saveTextSelectionRange } from "../../components/context/menuClick"
import { useStore } from "../hooks/useStore"
import { ContextChild } from "./ContextChild"
import { ContextItem } from "./ContextItem"
import { SpellCheckMenu } from "./SpellCheckMenu"
import styles from "./ContextMenu.module.css"

export function ContextMenu() {
    const isActive = useStore(contextActive)
    const currentPopup = useStore(activePopup)
    const dict = useStore(dictionary)
    const direction = useStore(localeDirection)
    const osStore = useStore(os) as unknown as never
    const currentWindowStore = useStore(currentWindow)
    const server = useStore(serverData) as unknown as never
    const currentTheme = useStore(theme) as string
    const themesStore = useStore(themes) as unknown as never
    const specialStore = useStore(special) as unknown as never
    const activePageStore = useStore(activePage)
    const contextDataStore = useStore(contextData) as unknown as never

    const [activeMenu, setActiveMenu] = useState<string[]>([])
    const [pos, setPos] = useState({ x: 0, y: 0, side: "right" as "right" | "left", translate: 0 })
    const [contextElem, setContextElem] = useState<HTMLDivElement | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [highlighted, setHighlighted] = useState<{ id: string | null; path: string[] }>({ id: null, path: [] })
    const [flatMenuItems, setFlatMenuItems] = useState<FlatMenuItem[]>([])
    const [top, setTop] = useState(false)
    const [update, setUpdate] = useState(0)

    const autoCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const closingMenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const requestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isRequesting = useRef(false)
    const lastTriggeredTime = useRef(0)
    const lastTriggeredElem = useRef<HTMLDivElement | null>(null)

    const startCloseTimer = useCallback(() => {
        if (!highlighted.id) return
        if (contextElem) {
            lastTriggeredTime.current = Date.now()
            lastTriggeredElem.current = contextElem
        }
        closingMenuTimeout.current = setTimeout(() => {
            closingMenuTimeout.current = null
        }, 70)
    }, [highlighted.id, contextElem])

    useEffect(() => {
        if (isActive === false) {
            startCloseTimer()
            slideDeleteHighlight.set(null)
        }
        return () => {
            slideDeleteHighlight.set(null)
        }
    }, [isActive, startCloseTimer])

    function getContextMenu(id: string | null): string[] | undefined {
        if (!id) return
        if (id.includes("__")) return combineMenus(id)
        const menu = (contextMenuLayouts as Record<string, string[]>)[id.slice(1, id.length)]
        if (id && menu) return menu
        return
    }

    function combineMenus(id: string): string[] {
        const menus = id.slice(1, id.length).split("__")
        const menu: string[] = []
        menus.forEach((c2: string, i: number) => {
            if ((contextMenuLayouts as Record<string, string[]>)[c2]) menu.push(...(contextMenuLayouts as Record<string, string[]>)[c2])
            if (i < menus.length - 1) menu.push("SEPARATOR")
        })
        return menu
    }

    const onContextMenu = useCallback(
        (e: MouseEvent) => {
            spellcheck.set(null)
            saveTextSelectionRange()

            let target: unknown = e.target
            if (!target || closingMenuTimeout.current) return

            const input = ["text", "textarea"].includes(target.type) && !target.closest?.(".numberInput")
            if (contextMenuMode(input, osStore?.platform) === "native") {
                closeContextMenu()
                return
            }
            e.preventDefault()
            if ((!input && (target.closest?.(".contextMenu") || currentPopup)) || target.closest?.(".nocontext")) {
                closeContextMenu()
                return
            }

            let x = e.clientX
            let y = e.clientY
            let side: "right" | "left" = direction === "rtl" ? "left" : "right"
            let translate = 0

            let elem = (target.closest?.(".context") || document.body) as HTMLDivElement
            let id: string | null = elem?.classList?.length ? ([...elem.classList].find((c: string) => c.includes("#")) as string | undefined) || null : null

            if (id === "#drawer_top" && input) id = null
            if (!id && input && osStore?.platform === "win32") {
                id = "#input"
                elem = target as HTMLDivElement
            }

            let menu = [...(getContextMenu(id) || (contextMenuLayouts as unknown as never).default || [])]

            if (server?.companion?.enabled && id) {
                const baseId = id.slice(1).split("_readonly")[0].split("_default")[0]
                const idCopyableMenus = ["action", "overlay_card", "drawer_show_button", "global_timer", "variable", "project_button", "template_card", "stage_slide", "style", "audio_stream", "interaction", "camera_card", "screen_card", "output_screen", "output_screen_stage"]
                if (idCopyableMenus.includes(baseId) && !menu.includes("copy_id")) {
                    menu.push("SEPARATOR", "copy_id")
                }
            }

            const contextHeight = menu.reduce((acc, mid) => acc + (mid.includes("GROUP") ? 73.6 : mid === "SEPARATOR" ? 17 : 33.6), 0) + 16
            if (x + 250 > window.innerWidth) x -= 250
            if (y + contextHeight > window.innerHeight) translate = 100
            if (x + (250 + 150) > window.innerWidth) side = "left"

            setContextElem(elem)
            setActiveMenu(menu)
            setPos({ x, y, side, translate })
            setSearchQuery("")
            setHighlighted({ id: null, path: [] })
            contextActive.set(true)

            if (!currentWindowStore) return
            if (autoCloseTimeout.current) clearTimeout(autoCloseTimeout.current)
            autoCloseTimeout.current = setTimeout(closeContextMenu, 3000)
        },
        [currentPopup, direction, osStore?.platform, server?.companion?.enabled, currentWindowStore]
    )

    const onWindowClick = useCallback((e: MouseEvent) => {
        if (!(e.target as HTMLElement | null)?.closest?.(".contextMenu")) closeContextMenu()
    }, [])

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            const result = handleSearchKeydown(e, isActive, searchQuery, highlighted.id, lastTriggeredTime.current, lastTriggeredElem.current, onContextMenu)
            if (!result) return
            setSearchQuery(result.searchQuery)
            setHighlighted({ id: result.highlightedItemId, path: result.highlightedPath })
        },
        [isActive, searchQuery, highlighted.id, onContextMenu]
    )

    useEffect(() => {
        window.addEventListener("contextmenu", onContextMenu)
        window.addEventListener("click", onWindowClick)
        window.addEventListener("keydown", onKeyDown)
        return () => {
            window.removeEventListener("contextmenu", onContextMenu)
            window.removeEventListener("click", onWindowClick)
            window.removeEventListener("keydown", onKeyDown)
            if (autoCloseTimeout.current) clearTimeout(autoCloseTimeout.current)
            if (closingMenuTimeout.current) clearTimeout(closingMenuTimeout.current)
            if (requestTimeout.current) clearTimeout(requestTimeout.current)
        }
    }, [onContextMenu, onWindowClick, onKeyDown])

    useEffect(() => {
        if (!activeMenu.length) return
        activeMenu.forEach((id) => {
            const items = (contextMenuItems as unknown as never)[id]?.items || []
            if (!items[0]?.includes?.("LOAD")) return
            const firstId = items[0].slice(5)
            quickLoadItems(firstId)
        })
    }, [activeMenu])

    useEffect(() => {
        const flat = flattenMenuItems(activeMenu, contextMenuItems as unknown as never)
        setFlatMenuItems(flat)
        if (activeMenu.length) {
            // keep as in Svelte behavior on menu change
            // searchQuery/highlighted are reset in onContextMenu; for other activeMenu changes keep consistent
        }
    }, [activeMenu])

    useEffect(() => {
        if (flatMenuItems.length === 0) return
        const result = searchMenuItems(searchQuery, flatMenuItems, translateText, dict)
        setHighlighted({ id: result.id, path: result.path })
    }, [flatMenuItems, searchQuery, dict])

    useEffect(() => {
        if (!isActive || !contextElem) return
        setTop(false)
        const t = setTimeout(() => {
            const el = document.querySelector(".contextMenu")
            if (!el) return
            setTop(el.getBoundingClientRect().top <= 0)
        })
        return () => clearTimeout(t)
    }, [isActive, contextElem, activeMenu, update])

    useEffect(() => {
        if (isRequesting.current) setUpdate((u) => u + 1)
        isRequesting.current = true
        if (requestTimeout.current) return
        requestTimeout.current = setTimeout(() => {
            requestTimeout.current = null
            const was = isRequesting.current
            isRequesting.current = false
            if (was) setUpdate((u) => u + 1)
        }, 61)
    }, [activeMenu, isActive])

    function shouldShowMenuWithItems(id: string) {
        if (id === "rearrange") return getEditItems().length > 1
        if (id === "bind_to" || id === "bind_to_effect" || id === "bind_to_scene") return contextDataStore?.outputList
        if (id === "format") return contextDataStore?.textContent || activePageStore !== "show"
        if (id === "remove_layers") return contextDataStore?.layers
        if (id === "tag_filter") return contextDataStore?.tags
        if (id === "media_tag_filter") return contextDataStore?.media_tags
        if (id === "player_tag_filter") return contextDataStore?.player_tags
        if (id === "action_tag_filter") return contextDataStore?.action_tags
        if (id === "variable_tag_filter") return contextDataStore?.variable_tags
        if (id === "timer_tag_filter") return contextDataStore?.timer_tags
        return true
    }

    function getGroupItems(id: string) {
        const groupList: string[] | undefined = (contextMenuGroups as Record<string, string[]>)[id.slice(6)]
        return groupList || []
    }

    let rgb = { r: 35, g: 35, b: 45 }
    const color = themesStore?.[currentTheme]?.colors?.["primary"]
    if (color) {
        const newRgb = hexToRgb(color)
        rgb = { r: Math.max(0, newRgb.r - 1), g: Math.max(0, newRgb.g - 5), b: Math.max(0, newRgb.b - 5) }
    }

    const isOptimized = !!specialStore?.optimizedMode

    if (!isActive || !activeMenu.length) return null

    return (
        <div
            className={`contextMenu ${styles.contextMenu} ${top ? styles.top : ""} ${isOptimized ? "isOptimized" : ""}`.trim()}
            style={{ left: pos.x, top: pos.y, transform: `translateY(-${pos.translate}%)`, ["--background" as string]: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.97)` } as React.CSSProperties}
        >
            <div key={update}>
                <SpellCheckMenu />

                {activeMenu.map((id, i) => {
                    if (id === "SEPARATOR") return <hr key={`sep-${i}`} className={styles.hr} />

                    if (id.startsWith("GROUP_")) {
                        const first = i === 0
                        const last = i === activeMenu.length - 1
                        return (
                            <div key={id} className={`${styles.group} ${first ? styles.isFirst : ""} ${last ? styles.isLast : ""}`.trim()}>
                                {getGroupItems(id).map((itemId) => (
                                    <ContextItem key={itemId} id={itemId} contextElem={contextElem} highlighted={highlighted.id === itemId} group />
                                ))}
                            </div>
                        )
                    }

                    if ((contextMenuItems as unknown as never)[id]?.items) {
                        if (!shouldShowMenuWithItems(id)) return null
                        return <ContextChild key={id} id={id} contextElem={contextElem} side={pos.side} translate={pos.y > window.innerHeight - 50 ? pos.translate : 0} highlightedPath={highlighted.path} />
                    }

                    return <ContextItem key={id} id={id} contextElem={contextElem} highlighted={highlighted.id === id} />
                })}
            </div>

            {searchQuery ? <div className={styles.search}>{searchQuery}</div> : null}
        </div>
    )
}

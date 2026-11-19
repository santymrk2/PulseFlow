import { Fragment, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { get } from "../../shared/core/lib/store"
import type { DrawerTabIds } from "../../../types/Tabs"
import { getBreadcrumbs } from "../../components/drawer/breadcrumb"
import { keysToID } from "../../shared/utils/helpers/array"
import { cn } from "../../shared/core/lib/utils"
import { activeDrawerTab, activeEdit, activePage, activeShow, audioFolders, audioPlaylists, categories, drawer, drawerOpenedInEdit, drawerTabsData, focusMode, mediaFolders, mediaOptions, os, overlayCategories, previousShow, scriptures, selected, templateCategories } from "../../shared/core/stores"
import { DEFAULT_DRAWER_HEIGHT, DEFAULT_WIDTH, MENU_BAR_HEIGHT } from "../../shared/utils/common"
import { startResizing, stopResizing } from "../../shared/utils/cursor"
import { translateText } from "../../shared/utils/language"
import { getAccess } from "../../shared/utils/profile"
import { getNormalizedKey } from "../../utils/shortcuts"
import { isTypingTarget } from "../../shared/utils/shortcutsHelper"
import { drawerTabs } from "../../shared/core/values/tabs"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Resizeable } from "../system/Resizeable"
import { Button } from "../ui/button/Button"
import { Slider } from "../ui/slider/Slider"
import { Content } from "./Content"
import { Info } from "./info/Info"
import { Navigation } from "./Navigation"
import styles from "./Drawer.module.css"

// Port de components/drawer/Drawer.svelte. Los`<svelte:window on:mouseup|mousemove|keydown>` son listeners de
// window registrados una vez, con cleanup. Los handlers leen los stores con `get()` (como `$store` en Svelte),
// así que no hace falta volver a registrarlos cuando cambian.
const MIN_HEIGHT = 40
const TOP_HEIGHT = 48 // altura de la barra superior
const TABS = keysToID(drawerTabs)
const VALID_TABS = drawerTabs as Record<string, unknown>
const HIDDEN_IN_FOCUS_MODE: readonly string[] = ["templates", "calendar"]
const RESET_SUBTAB_ON_OPEN: readonly string[] = ["shows", "overlays", "templates", "media", "audio"]
const SIZE_SLIDER_TABS: readonly string[] = ["media", "overlays", "templates"]

interface MouseState {
    x: number
    y: number
    offsetY: number
}

function computeMaxHeight(platform: string) {
    return window.innerHeight - TOP_HEIGHT - (platform === "win32" ? MENU_BAR_HEIGHT - 0.3 : 0)
}

function accessGlobal(id: string): string | undefined {
    return (getAccess(id) as { global?: string }).global
}

export function Drawer() {
    const drawerValue = useStore(drawer)
    const tabValue = useStore(activeDrawerTab)
    const tabsData = useStore(drawerTabsData)
    const pageValue = useStore(activePage)
    const showValue = useStore(activeShow)
    const focusValue = useStore(focusMode)
    const mediaValue = useStore(mediaOptions)
    const allCategories = useStore(categories)
    const mediaFolderValues = useStore(mediaFolders)
    const audioFolderValues = useStore(audioFolders)
    const playlistValues = useStore(audioPlaylists)
    const overlayValues = useStore(overlayCategories)
    const templateValues = useStore(templateCategories)
    const scriptureValues = useStore(scriptures)

    // `activeTab` se adelanta al store para que la pestaña se pinte enseguida; el store se escribe 10 ms después.
    const [activeTab, setActiveTab] = useState<DrawerTabIds>(() => get(activeDrawerTab))
    const [resizing, setResizing] = useState(false)
    const mouse = useRef<MouseState | null>(null)
    const move = useRef(false)
    const animFrame = useRef<number | null>(null)
    const maxHeight = useRef(computeMaxHeight(get(os).platform))

    // $: if ($activePage === "show" && $drawer.autoclosed) setTimeout(...)
    useEffect(() => {
        if (pageValue !== "show" || !drawerValue.autoclosed) return
        const timer = setTimeout(() => {
            const current = get(drawer)
            drawer.set({ height: current.stored ?? DEFAULT_DRAWER_HEIGHT, stored: null })
        }, 100)
        return () => clearTimeout(timer)
    }, [pageValue, drawerValue.autoclosed])

    // la vista de shows ya no vive en el cajón; una pestaña guardada que ya no existe vuelve a Media
    useEffect(() => {
        if (tabValue === "shows" || !VALID_TABS[tabValue]) activeDrawerTab.set("media")
    }, [tabValue])

    // $: activeTab = $activeDrawerTab
    useEffect(() => setActiveTab(tabValue), [tabValue])

    // $: if ($activeShow?.type === undefined || $activeShow?.type === "show") previousShow.set(...)
    useEffect(() => {
        if (showValue?.type === undefined || showValue?.type === "show") previousShow.set(JSON.stringify(showValue))
    }, [showValue])

    useEffect(
        () => () => {
            if (animFrame.current !== null) cancelAnimationFrame(animFrame.current)
            if (mouse.current) stopResizing()
        },
        []
    )

    function getHeight(height: number) {
        if (height < MIN_HEIGHT * 2) return MIN_HEIGHT
        if (height > maxHeight.current) return maxHeight.current
        move.current = true
        return height
    }

    function closeDrawer() {
        drawer.set({ height: MIN_HEIGHT, stored: get(drawer).height })
        drawerOpenedInEdit.set(false)
    }

    // `e === null` en el original meant "apertura programática" (Ctrl+D / búsqueda)
    function click(target: EventTarget | null) {
        const element = target instanceof Element ? target : null
        const height = get(drawer).height

        if ((height > MIN_HEIGHT && element?.closest("button")) || move.current || target instanceof HTMLInputElement) {
            move.current = false
            return
        }

        if (height > MIN_HEIGHT) {
            if (target === null || element?.classList.contains("top") || element?.closest(`#${get(activeDrawerTab)}`)) closeDrawer()
            drawerOpenedInEdit.set(false)
            return
        }

        const stored = get(drawer).stored
        drawer.set({ height: stored === null || stored < DEFAULT_DRAWER_HEIGHT ? DEFAULT_DRAWER_HEIGHT : stored, stored: null })
        if (get(activePage) === "edit") drawerOpenedInEdit.set(true)

        // si el cajón estaba cerrado al buscar, vuelve a la categoría "all"
        const tab = get(activeDrawerTab)
        if (target === null && RESET_SUBTAB_ON_OPEN.includes(tab)) {
            if (tab === "media") mediaOptions.update((a) => ({ ...a, view: "all" }))
            drawerTabsData.update((a) => {
                const next = { ...a }
                next[tab] = { ...a[tab], activeSubTab: "all" }
                return next
            })
        }
    }

    function mousedown(event: ReactMouseEvent<HTMLDivElement>) {
        startResizing("ns-resize")
        maxHeight.current = computeMaxHeight(get(os).platform)
        const e = event.nativeEvent
        mouse.current = { x: e.clientX, y: e.clientY, offsetY: window.innerHeight - get(drawer).height - e.clientY }
        setResizing(true)
    }

    function mousemove(e: MouseEvent) {
        const current = mouse.current
        if (!current) return

        const currentSelected = get(selected)
        if (currentSelected?.id || currentSelected?.data?.length) selected.set({ id: null, data: [] })

        if (animFrame.current !== null) return
        animFrame.current = requestAnimationFrame(() => {
            animFrame.current = null
            if (!mouse.current) return

            const newHeight = getHeight(window.innerHeight - e.clientY - mouse.current.offsetY)
            if (newHeight !== get(drawer).height) {
                drawer.set({ height: newHeight, stored: null })

                if (newHeight <= MIN_HEIGHT) drawerOpenedInEdit.set(false)
                else if (get(activePage) === "edit") drawerOpenedInEdit.set(true)
            }
        })
    }

    function mouseup(e: MouseEvent) {
        if (animFrame.current !== null) {
            cancelAnimationFrame(animFrame.current)
            animFrame.current = null
        }
        if (mouse.current) {
            stopResizing()
            mouse.current = null
            setResizing(false)
        }
        if (!(e.target instanceof Element && e.target.closest(".top"))) move.current = false
    }

    function keydown(e: KeyboardEvent) {
        if (e.shiftKey || e.altKey) return
        const ctrlKey = e.ctrlKey || e.metaKey ? getNormalizedKey(e) : ""
        if (ctrlKey === "d" && !isTypingTarget(document.activeElement)) {
            const currentSelected = get(selected)
            if (!currentSelected?.id && !get(activeEdit).items.length) click(null)
        }
    }

    function openDrawerTab(tab: { id: string; name: string; icon: string }) {
        const newId = tab.id as DrawerTabIds
        if (get(activeDrawerTab) === newId) return
        // se abre visualmente de inmediato y el store se escribe después de dejar pasar el click
        setActiveTab(newId)
        setTimeout(() => activeDrawerTab.set(newId), 10)
    }

    function toggleView() {
        mediaOptions.update((a) => ({ ...a, mode: a.mode === "grid" ? "list" : "grid" }))
    }

    // los listeners se registran una sola vez; `latest` apunta siempre a los handlers del último render
    const latest = useRef({ mousemove, mouseup, keydown })
    useEffect(() => {
        latest.current = { mousemove, mouseup, keydown }
    })
    useEffect(() => {
        const up = (e: MouseEvent) => latest.current.mouseup(e)
        const moving = (e: MouseEvent) => latest.current.mousemove(e)
        const down = (e: KeyboardEvent) => latest.current.keydown(e)
        window.addEventListener("mouseup", up)
        window.addEventListener("mousemove", moving)
        window.addEventListener("keydown", down)
        return () => {
            window.removeEventListener("mouseup", up)
            window.removeEventListener("mousemove", moving)
            window.removeEventListener("keydown", down)
        }
    }, [])

    const crumbs = getBreadcrumbs(tabValue, tabsData[tabValue]?.activeSubTab || undefined, {
        categories: allCategories,
        mediaFolders: mediaFolderValues,
        audioFolders: audioFolderValues,
        audioPlaylists: playlistValues,
        overlayCategories: overlayValues,
        templateCategories: templateValues,
        scriptures: scriptureValues
    })
    const showViewToggle = tabValue === "media"
    const showSizeSlider = SIZE_SLIDER_TABS.includes(tabValue) || (tabValue === "functions" && tabsData.functions?.activeSubTab === "scenes")

    return (
        <section className={styles.drawer} style={{ height: `${drawerValue.height}px` }}>
            <div className={cn(styles.handle, resizing && styles.resizing)} title={translateText("_ resizable")} onMouseDown={mousedown} />
            <div className={cn("top", "context", "#drawer_top", styles.top)} onClick={(event) => click(event.target)}>
                <span className={styles.tabs}>
                    {TABS.map((tab, i) => {
                        const parts = tab.name.split(".")
                        const title = `<b>${parts[0]}.${parts[1]}</b>${tab.title ? `\n${tab.title}` : ""} [Ctrl+${i + 1}]`
                        if (tab.id === "shows" || tabsData[tab.id]?.enabled === false || accessGlobal(tab.id) === "none" || (focusValue && HIDDEN_IN_FOCUS_MODE.includes(tab.id))) return null

                        return (
                            <Button key={tab.id} id={tab.id} style={{ borderRadius: "var(--radius) var(--radius) 0 0", borderBottom: "2px solid var(--primary)", padding: "0 0.75em", height: "100%" }} className={cn("context", "#drawer_top")} title={title} isActive={activeTab === tab.id} onClick={() => openDrawerTab(tab)} onDblClick={closeDrawer}>
                                <span className={styles.tabLabel}>{translateText(tab.name)}</span>
                            </Button>
                        )
                    })}
                </span>

                <span className={styles.topRight}>
                    {showViewToggle ? (
                        <Button onClick={toggleView} title={`show.${mediaValue.mode}`}>
                            <Icon size={1.2} id={mediaValue.mode} white />
                        </Button>
                    ) : null}
                    {showSizeSlider ? (
                        <Slider
                            style={{ width: "110px" }}
                            value={mediaValue.columns}
                            min={2}
                            max={10}
                            invert
                            onInput={(event) => {
                                const input = event.currentTarget
                                mediaOptions.update((a) => ({ ...a, columns: Number(input.value) }))
                            }}
                        />
                    ) : null}
                </span>
            </div>

            {crumbs.length ? (
                <div className={styles.breadcrumbs}>
                    {crumbs.map((crumb, i) => (
                        <Fragment key={i}>
                            {i ? <span className={styles.sep}>›</span> : null}
                            <span className={cn(styles.crumb, i === crumbs.length - 1 && styles.current)}>{crumb.key ? translateText(crumb.key) : crumb.name?.includes(".") ? translateText(crumb.name) : crumb.name || ""}</span>
                        </Fragment>
                    ))}
                </div>
            ) : null}

            <div className={styles.content}>
                <Resizeable id="leftPanelDrawer">
                    <Navigation id={tabValue} />
                </Resizeable>
                <Content id={tabValue} />
                <Resizeable id="rightPanelDrawer" side="right">
                    {(width) => (
                        <div className={cn(styles.right, width > DEFAULT_WIDTH * 1.8 && styles.row)}>
                            <Info id={tabValue} />
                        </div>
                    )}
                </Resizeable>
            </div>
        </section>
    )
}

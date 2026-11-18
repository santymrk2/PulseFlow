// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DrawerTabIds } from "../../../types/Tabs"
import { activeDrawerTab, activeEdit, activePage, activeShow, drawer, drawerTabsData, focusMode, mediaFolders, mediaOptions, os, previousShow, selected } from "../../stores"
import { clearIslands } from "../test/islandMock"
import { looseEntry, setStoresForTest, storeEntry, type StoreEntry } from "../test/storeTestKit"
import { Drawer } from "./Drawer"
import styles from "./Drawer.module.css"

const cursor = vi.hoisted(() => ({ empezar: vi.fn(), parar: vi.fn(), globals: {} as Record<string, string> }))
vi.mock("../../utils/cursor", () => ({ startResizing: cursor.empezar, stopResizing: cursor.parar }))
vi.mock("../../utils/common", () => ({ DEFAULT_WIDTH: 290, DEFAULT_DRAWER_HEIGHT: 300, MENU_BAR_HEIGHT: 25 }))
vi.mock("../../utils/profile", () => ({ getAccess: (id: string) => ({ global: cursor.globals[id] ?? "full" }) }))
vi.mock("../../utils/language", () => ({ translateText: (text: string) => text }))
vi.mock("../../utils/shortcuts", () => ({ getNormalizedKey: (e: KeyboardEvent) => e.key }))
vi.mock("../system/Resizeable", () => ({
    Resizeable: ({ children }: { children?: ReactNode | ((width: number) => ReactNode) }) => <div data-resizeable="">{typeof children === "function" ? children(600) : children}</div>
}))
vi.mock("./info/Info", () => ({ Info: ({ id }: { id: string }) => <div data-isla="Info" data-id={id} /> }))
vi.mock("./Navigation", () => ({ Navigation: ({ id }: { id: string }) => <div data-isla="Navigation" data-id={id} /> }))
vi.mock("./Content", () => ({ Content: ({ id }: { id: string }) => <div data-isla="Content" data-id={id} /> }))

let restaurar: () => void = () => {}
function montar(extra: StoreEntry[] = []) {
    restaurar()
    restaurar = setStoresForTest([looseEntry(drawer, { height: 300, stored: null }), storeEntry(activeDrawerTab, "media"), looseEntry(drawerTabsData, {}), storeEntry(activePage, "show"), looseEntry(activeShow, null), looseEntry(previousShow, null), storeEntry(focusMode, false), storeEntry(mediaOptions, { columns: 5, mode: "grid" }), looseEntry(selected, { id: null, data: [] }), looseEntry(activeEdit, { items: [] }), looseEntry(os, { platform: "darwin" }), ...extra])
    return render(<Drawer />)
}

const section = () => document.querySelector("section") as HTMLElement
const top = () => document.querySelector(".top") as HTMLElement
const handle = () => document.querySelector(`.${styles.handle}`) as HTMLElement
const tabButtons = () => [...document.querySelectorAll("button[id]")] as HTMLButtonElement[]

beforeEach(() => {
    vi.clearAllMocks()
    cursor.globals = {}
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        cb(0)
        return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
})
afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    clearIslands()
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe("Drawer", () => {
    it("renderiza la altura del store, el handle y las islas de Navigation, Content e Info", () => {
        montar()
        expect(section().style.height).toBe("300px")
        expect(handle().getAttribute("title")).toBe("_ resizable")
        expect(document.querySelector("[data-isla='Navigation']")?.getAttribute("data-id")).toBe("media")
        expect(document.querySelector("[data-isla='Content']")?.getAttribute("data-id")).toBe("media")
        expect(document.querySelector("[data-isla='Info']")?.getAttribute("data-id")).toBe("media")
    })

    it("oculta shows, pestañas deshabilitadas, sin acceso y las de focus mode", () => {
        cursor.globals.scripture = "none"
        montar([storeEntry(focusMode, true), looseEntry(drawerTabsData, { audio: { enabled: false, activeSubTab: null } })])
        expect(tabButtons().map((b) => b.id)).toEqual(["media", "functions"])
    })

    it("abrir una pestaña la marca activa enseguida y escribe el store 10 ms después", () => {
        vi.useFakeTimers()
        montar()
        fireEvent.click(document.querySelector("button#audio") as HTMLElement)
        expect((document.querySelector("button#audio") as HTMLElement).classList.contains("isActive")).toBe(true)
        expect(get(activeDrawerTab)).toBe("media")
        act(() => vi.advanceTimersByTime(10))
        expect(get(activeDrawerTab)).toBe("audio")
        expect(get(drawer).height).toBe(300) // el click en la pestaña no cierra el cajón
        vi.useRealTimers()
    })

    it("doble click en una pestaña cierra el cajón guardando la altura", () => {
        montar()
        fireEvent.doubleClick(document.querySelector("button#media") as HTMLElement)
        expect(get(drawer)).toEqual({ height: 40, stored: 300 })
    })

    it("click en .top cierra el cajón abierto", () => {
        montar()
        fireEvent.click(top())
        expect(get(drawer)).toEqual({ height: 40, stored: 300 })
    })

    it("Ctrl+D abre el cajón cerrado y vuelve a 'all' la categoría activa", () => {
        montar([looseEntry(drawer, { height: 40, stored: 200 }), looseEntry(drawerTabsData, { media: { enabled: true, activeSubTab: "Folders" } })])
        fireEvent.keyDown(window, { key: "d", ctrlKey: true })
        expect(get(drawer)).toEqual({ height: 300, stored: null })
        expect(get(mediaOptions).view).toBe("all")
        expect(get(drawerTabsData).media.activeSubTab).toBe("all")
    })

    it("Ctrl+D con shift o con selección no togglea el cajón", () => {
        montar([looseEntry(drawer, { height: 40, stored: 200 })])
        fireEvent.keyDown(window, { key: "d", ctrlKey: true, shiftKey: true })
        expect(get(drawer).height).toBe(40)
        looseEntry(selected, { id: "algo", data: [] }).apply()
        fireEvent.keyDown(window, { key: "d", ctrlKey: true })
        expect(get(drawer).height).toBe(40)
    })

    it("el cajón autoclosed se reabre a los 100 ms con la altura guardada", () => {
        vi.useFakeTimers()
        montar([looseEntry(drawer, { height: 40, stored: 250, autoclosed: true })])
        act(() => vi.advanceTimersByTime(100))
        expect(get(drawer)).toEqual({ height: 250, stored: null })
        vi.useRealTimers()
    })

    it("una pestaña inexistente (o shows) vuelve a media", () => {
        montar([storeEntry(activeDrawerTab, "shows" as DrawerTabIds)])
        expect(get(activeDrawerTab)).toBe("media")
    })

    it("migas de navegación con el nombre de la carpeta guardada", () => {
        montar([looseEntry(drawerTabsData, { media: { enabled: true, activeSubTab: "carpeta1" } }), looseEntry(mediaFolders, { carpeta1: { name: "Mis videos" } })])
        expect(document.querySelector(`.${styles.breadcrumbs}`)).toBeTruthy()
        expect(document.body.textContent).toContain("Mis videos")
        expect(document.querySelectorAll(`.${styles.crumb}`).length).toBe(2)
    })

    it("media muestra el toggle de vista y el slider de columnas; audio no", () => {
        montar()
        expect(document.querySelector('[data-title="show.grid"]')).toBeTruthy()
        const range = document.querySelector('input[type="range"]') as HTMLInputElement
        expect(range).toBeTruthy()
        fireEvent.input(range, { target: { value: "8" } })
        expect(get(mediaOptions).columns).toBe(8)
        fireEvent.click(document.querySelector('[data-title="show.grid"]') as HTMLElement)
        expect(get(mediaOptions).mode).toBe("list")

        cleanup()
        restaurar()
        montar([storeEntry(activeDrawerTab, "audio" as DrawerTabIds)])
        expect(document.querySelector('[data-title="show.list"]')).toBeNull()
        expect(document.querySelector('input[type="range"]')).toBeNull()
    })

    it("el panel derecho aplica .row cuando supera 1.8 * DEFAULT_WIDTH", () => {
        montar()
        expect(document.querySelector(`.${styles.row}`)).toBeTruthy()
    })

    it("redimensionar con rAF actualiza la altura y suelta el cursor al soltar", () => {
        montar()
        const clientY = 0
        fireEvent.mouseDown(handle(), { clientX: 10, clientY })
        expect(cursor.empezar).toHaveBeenCalledWith("ns-resize")
        expect(handle().classList.contains(styles.resizing)).toBe(true)

        // offsetY = innerHeight - 300 - 0; mover a 50 deja altura 250
        fireEvent.mouseMove(window, { clientY: 50 })
        expect(get(drawer).height).toBe(250)
        expect(get(selected)).toEqual({ id: null, data: [] })

        fireEvent.mouseUp(window, { clientY: 50 })
        expect(cursor.parar).toHaveBeenCalledTimes(1)
        expect(handle().classList.contains(styles.resizing)).toBe(false)
    })
})

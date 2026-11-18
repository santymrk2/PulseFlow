// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activeProfile, activeShow, dictionary, labelsDisabled, mediaOptions, overlayCategories, outputs, overlays, previewOutputId, profiles, styles } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { Overlays } from "./Overlays"

const { historyMock, toggleOverlayOutputMock, addProjectItemMock, findMatchingOutMock } = vi.hoisted(() => ({
    historyMock: vi.fn(),
    toggleOverlayOutputMock: vi.fn(),
    addProjectItemMock: vi.fn(),
    findMatchingOutMock: vi.fn(() => null)
}))

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../components/helpers/history", () => ({ history: historyMock }))
vi.mock("../../../components/helpers/output", () => ({ getResolution: () => ({ width: 16, height: 9 }), findMatchingOut: findMatchingOutMock }))
vi.mock("../../../components/helpers/overlayOutput", () => ({ toggleOverlayOutput: toggleOverlayOutputMock }))
vi.mock("../../../converters/project", () => ({ addProjectItem: addProjectItemMock }))
vi.mock("../../../components/drawer/effects/Effects.svelte", () => ({ default: { isla: "Effects" } }))
vi.mock("../../../components/slide/Zoomed.svelte", () => ({ default: { isla: "Zoomed" } }))
vi.mock("../../../components/slide/Textbox.svelte", () => ({ default: { isla: "Textbox" } }))
vi.mock("../../bridge/SvelteIsland", () => ({
    SvelteIsland: ({ component, props, slots = {} }: { component: { isla: string }; props?: object; slots?: Record<string, unknown> }) => (
        <div data-isla={component.isla} data-props={JSON.stringify(props ?? {})}>
            {slots.default as never}
        </div>
    )
}))

const dict = {
    empty: { general: "Vacío", search: "Sin resultados" },
    main: { unnamed: "Sin nombre" },
    category: { create_nonexistent: "Crear categorías" },
    new: { overlay: "Nuevo overlay", effect: "Nuevo efecto" }
}

const overlay = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, color: null, category: null, items: [], ...extra })

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    findMatchingOutMock.mockReturnValue(null)
    restaurar = setStoresForTest([
        storeEntry(dictionary, dict),
        storeEntry(overlays, { o1: overlay("o1"), o2: overlay("o2") } as never),
        storeEntry(overlayCategories, {}),
        storeEntry(activeProfile, null),
        storeEntry(profiles, {}),
        storeEntry(activeShow, null),
        storeEntry(activeEdit, { items: [] } as never),
        storeEntry(activePage, "drawer"),
        storeEntry(mediaOptions, { columns: 5, mode: "grid" }),
        storeEntry(labelsDisabled, false),
        storeEntry(outputs, {} as never),
        storeEntry(styles, {}),
        storeEntry(previewOutputId, "")
    ])
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

const islas = (name: string) => [...document.querySelectorAll(`[data-isla="${name}"]`)] as HTMLElement[]

describe("Overlays", () => {
    it("lista los overlays y monta Zoomed con un Textbox por item", () => {
        vi.useFakeTimers()
        act(() =>
            overlays.set({
                o1: overlay("o1", {
                    items: [
                        { type: "text", lines: [] },
                        { type: "text", lines: [] }
                    ]
                })
            } as never)
        )
        render(<Overlays active="all" />)
        expect(screen.getByText("o1")).toBeTruthy()
        act(() => vi.runAllTimers())
        expect(islas("Zoomed")).toHaveLength(1)
        expect(islas("Textbox")).toHaveLength(2)
        expect(JSON.parse(islas("Textbox")[0].getAttribute("data-props") ?? "{}").preview).toBe(true)
    })

    it("un clic saca el overlay al aire", () => {
        vi.useFakeTimers()
        render(<Overlays active="all" />)
        act(() => vi.runAllTimers())
        fireEvent.click(screen.getByText("o2"))
        expect(toggleOverlayOutputMock).toHaveBeenCalledWith("o2")
    })

    it("con editOnClick abre el overlay en el editor", () => {
        render(<Overlays active="all" editOnClick />)
        fireEvent.click(screen.getByText("o1"))
        expect(get(activeEdit)).toEqual({ type: "overlay", id: "o1", items: [] })
        expect(get(activePage)).toBe("edit")
        expect(toggleOverlayOutputMock).not.toHaveBeenCalled()
    })

    it("ctrl+clic no cambia la salida", () => {
        render(<Overlays active="all" />)
        fireEvent.click(screen.getByText("o1"), { ctrlKey: true })
        expect(toggleOverlayOutputMock).not.toHaveBeenCalled()
    })

    it("doble clic agrega el overlay al proyecto", () => {
        render(<Overlays active="all" />)
        fireEvent.doubleClick(screen.getByText("o1"))
        expect(addProjectItemMock).toHaveBeenCalledWith({ id: "o1", name: "o1", type: "overlay" })
    })

    it("en la pestaña de efectos monta Effects y no la grilla", () => {
        render(<Overlays active="effects" />)
        expect(islas("Effects")).toHaveLength(1)
        expect(screen.queryByText("o1")).toBeNull()
    })

    it("el botón nuevo escribe el historial según la pestaña", () => {
        const { unmount } = render(<Overlays active="all" />)
        fireEvent.click(document.querySelector('[data-title="Nuevo overlay"]') as HTMLElement)
        expect(historyMock).toHaveBeenCalledWith({ id: "UPDATE", location: { page: "drawer", id: "overlay" } })
        unmount()

        render(<Overlays active="effects" />)
        fireEvent.click(document.querySelector('[data-title="Nuevo efecto"]') as HTMLElement)
        expect(historyMock).toHaveBeenCalledWith({ id: "UPDATE", location: { page: "drawer", id: "effect" } })
    })

    it("en unlabeled ofrece crear las categorías inexistentes", () => {
        act(() => overlays.set({ o1: overlay("o1", { category: "c1" }) } as never))
        render(<Overlays active="unlabeled" />)
        fireEvent.click(screen.getByText("Crear categorías"))
        expect(get(overlayCategories).c1).toEqual({ name: "Sin nombre" })
    })

    it("con acceso de sólo lectura deshabilita el botón nuevo", () => {
        act(() => {
            activeProfile.set("p1")
            profiles.set({ p1: { access: { overlays: { global: "read" } } } } as never)
        })
        render(<Overlays active="all" />)
        expect((document.querySelector('[data-title="Nuevo overlay"]') as HTMLButtonElement).disabled).toBe(true)
    })

    it("ctrl+rueda cambia las columnas sólo sin columns fijo", () => {
        const { container, rerender } = render(<Overlays active="all" />)
        const zona = container.firstElementChild as HTMLElement
        act(() => {
            const evento = new WheelEvent("wheel", { deltaY: -100, bubbles: true })
            Object.defineProperty(evento, "ctrlKey", { value: true })
            zona.dispatchEvent(evento)
        })
        expect(get(mediaOptions).columns).toBe(4)

        rerender(<Overlays active="all" columns={1} />)
        act(() => {
            const evento = new WheelEvent("wheel", { deltaY: -100, bubbles: true })
            Object.defineProperty(evento, "ctrlKey", { value: true })
            zona.dispatchEvent(evento)
        })
        expect(get(mediaOptions).columns).toBe(4)
    })
})

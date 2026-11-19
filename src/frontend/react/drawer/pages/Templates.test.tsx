// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activePopup, activeProfile, activeShow, categories, dictionary, labelsDisabled, mediaOptions, previewOutputId, profiles, selected, showsCache, special, styles, templateApplied, templateCategories, templates, outputs } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Templates } from "./Templates"

const { historyMock, deselectMock } = vi.hoisted(() => ({ historyMock: vi.fn(), deselectMock: vi.fn() }))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: historyMock }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getResolution: () => ({ width: 16, height: 9 }), getFirstActiveOutput: () => null }))
vi.mock("../../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [] }))
vi.mock("../../../shared/utils/helpers/shows", () => ({ _show: () => ({ slides: () => ({ get: () => [] }) }) }))
vi.mock("../../../shared/utils/helpers/select", () => ({ deselect: deselectMock }))
vi.mock("../../../features/slide/Actions", () => ({ Actions: (props: Record<string, unknown>) => <div data-isla="Actions" data-props={JSON.stringify(props ?? {})} /> }))
vi.mock("./TemplateSlide", () => ({ TemplateSlide: (props: Record<string, unknown>) => <div data-isla="TemplateSlide" data-props={JSON.stringify(props ?? {})} /> }))

const dict = {
    empty: { general: "Vacío", search: "Sin resultados" },
    new: { template: "Nueva plantilla" },
    category: { create_nonexistent: "Crear categorías" },
    main: { unnamed: "Sin nombre" },
    show: { locked: "Show bloqueado" },
    profile: { locked: "Perfil bloqueado" },
    tips: { category_template: "Categoría con plantilla", style_template_active: "Estilo con plantilla" }
}

const template = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, color: null, category: null, items: [], ...extra })

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([
        storeEntry(dictionary, dict),
        storeEntry(templates, { t1: template("t1"), t2: template("t2") } as never),
        storeEntry(templateCategories, {}),
        storeEntry(activeProfile, null),
        storeEntry(profiles, {}),
        storeEntry(activeShow, null),
        storeEntry(showsCache, {} as never),
        storeEntry(selected, { id: null, data: [] } as never),
        storeEntry(categories, {}),
        storeEntry(styles, {}),
        storeEntry(special, {}),
        storeEntry(mediaOptions, { columns: 5, mode: "grid" }),
        storeEntry(activeEdit, { items: [] } as never),
        storeEntry(activePage, "drawer"),
        storeEntry(labelsDisabled, false),
        storeEntry(outputs, {} as never),
        storeEntry(previewOutputId, ""),
        storeEntry(templateApplied, false)
    ])
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

const ports = (name: string) => [...document.querySelectorAll(`[data-isla="${name}"]`)] as HTMLElement[]
const propsDe = (port: HTMLElement) => JSON.parse(port.getAttribute("data-props") ?? "{}") as Record<string, unknown>

describe("Templates", () => {
    it("lista las plantillas ordenadas y las monta con el port TemplateSlide", () => {
        vi.useFakeTimers()
        render(<Templates active="all" />)
        expect(screen.getByText("t1")).toBeTruthy()
        expect(screen.getByText("t2")).toBeTruthy()

        act(() => vi.runAllTimers())
        expect(ports("TemplateSlide")).toHaveLength(2)
        expect(propsDe(ports("TemplateSlide")[0])).toMatchObject({ templateId: "t1", preview: true })
    })

    it("filtra las plantillas de modo texto", () => {
        act(() => templates.set({ t1: template("t1", { settings: { mode: "text" } }), t2: template("t2") } as never))
        render(<Templates active="all" />)
        expect(screen.queryByText("t1")).toBeNull()
        expect(screen.getByText("t2")).toBeTruthy()
    })

    it("sin plantillas muestra el vacío", () => {
        act(() => templates.set({}))
        render(<Templates active="all" />)
        expect(screen.getByText("Vacío")).toBeTruthy()
    })

    it("con editOnClick abre la plantilla en el editor", () => {
        render(<Templates active="all" editOnClick />)
        fireEvent.click(screen.getByText("t1"))
        expect(get(activeEdit)).toEqual({ type: "template", id: "t1", items: [] })
        expect(get(activePage)).toBe("edit")
    })

    it("aplica la plantilla al show activo con historial TEMPLATE", () => {
        vi.useFakeTimers()
        act(() => {
            activeShow.set({ id: "s1", type: "show" } as never)
            showsCache.set({ s1: { settings: { template: "" }, category: null } } as never)
        })
        render(<Templates active="all" />)
        fireEvent.click(screen.getByText("t2"))
        expect(historyMock).toHaveBeenCalledWith({
            id: "TEMPLATE",
            newData: { id: "t2", data: { createItems: true, shiftItems: false } },
            location: { page: "none", override: "show#s1" }
        })
        expect(get(templateApplied)).toBe(true)
        act(() => vi.runAllTimers())
        expect(get(templateApplied)).toBe(false)
    })

    it("con un show bloqueado avisa y no aplica", () => {
        act(() => {
            activeShow.set({ id: "s1", type: "show" } as never)
            showsCache.set({ s1: { locked: true, settings: { template: "" }, category: null } } as never)
        })
        render(<Templates active="all" />)
        fireEvent.click(screen.getByText("t1"))
        expect(get(activePopup)).toBe("alert")
        expect(historyMock).not.toHaveBeenCalled()
    })

    it("con perfil de sólo lectura deshabilita el botón nuevo y no aplica", () => {
        act(() => {
            activeProfile.set("p1")
            profiles.set({ p1: { access: { templates: { global: "read" } } } } as never)
        })
        render(<Templates active="all" />)
        const botones = screen.getAllByRole("button")
        expect((botones[botones.length - 1] as HTMLButtonElement).disabled).toBe(true)
    })

    it("el botón nuevo escribe el historial del drawer", () => {
        render(<Templates active="all" />)
        const botones = screen.getAllByRole("button")
        fireEvent.click(botones[botones.length - 1])
        expect(historyMock).toHaveBeenCalledWith({ id: "UPDATE", location: { page: "drawer", id: "template" } })
    })

    it("ctrl+rueda cambia las columnas sólo sin columns fijo", () => {
        vi.useFakeTimers()
        const { container, rerender } = render(<Templates active="all" />)
        const zona = container.firstElementChild as HTMLElement
        act(() => {
            const evento = new WheelEvent("wheel", { deltaY: -100, bubbles: true })
            Object.defineProperty(evento, "ctrlKey", { value: true })
            zona.dispatchEvent(evento)
        })
        expect(get(mediaOptions).columns).toBe(4)

        rerender(<Templates active="all" columns={1} />)
        act(() => {
            const evento = new WheelEvent("wheel", { deltaY: -100, bubbles: true })
            Object.defineProperty(evento, "ctrlKey", { value: true })
            zona.dispatchEvent(evento)
        })
        expect(get(mediaOptions).columns).toBe(4)
    })

    it("en unlabeled ofrece crear las categorías inexistentes", () => {
        act(() => templates.set({ t1: template("t1", { category: "c1" }) } as never))
        render(<Templates active="unlabeled" />)
        fireEvent.click(screen.getByText("Crear categorías"))
        expect(get(templateCategories).c1).toEqual({ name: "Sin nombre" })
    })
})

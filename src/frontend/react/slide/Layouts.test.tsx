// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "svelte/store"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { changeSlidesView } from "../../show/slides"
import { actions, activePopup, activeProject, activeShow, alertMessage, editingProjectTemplate, labelsDisabled, projects, projectTemplates, showsCache, slidesOptions } from "../../stores"
import { getAccess } from "../../utils/profile"
import { getActionIcon, runAction } from "../../components/actions/actions"
import { duplicate } from "../../components/helpers/clipboard"
import { history } from "../../components/helpers/history"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { Layouts } from "./Layouts"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../utils/profile", () => ({ getAccess: vi.fn(() => ({ global: "edit" })) }))
vi.mock("../../show/slides", () => ({ changeSlidesView: vi.fn() }))
vi.mock("../../components/actions/actions", () => ({ getActionIcon: vi.fn(() => "actions"), runAction: vi.fn() }))
vi.mock("../../components/helpers/clipboard", () => ({ duplicate: vi.fn() }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/shows", () => ({
    _show: vi.fn(() => ({
        layouts: () => ({ ref: () => [[{ data: { nextTimer: 30 } }, { data: { nextTimer: 90 }, id: "sl1" }]] }),
        slides: () => ({ get: () => [{ language: "en" }] })
    }))
}))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id} /> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, onClick, title }: { children?: ReactNode; onClick?: (detail: { ctrl: boolean }) => void; title?: string }) => (
        <button title={title} onClick={(event) => onClick?.({ ctrl: event.ctrlKey })}>
            {children}
        </button>
    )
}))
vi.mock("../ui/floating-bar/FloatingBar", () => ({
    FloatingBar: ({ children, menu, side, onlyOne, style }: { children?: ReactNode | ((open: boolean) => ReactNode); menu?: ReactNode; side?: string; onlyOne?: boolean; style?: object }) => (
        <div data-testid="bar" data-side={side} data-only-one={String(onlyOne)} style={style}>
            {menu}
            {typeof children === "function" ? children(false) : children}
        </div>
    )
}))
vi.mock("../ui/hidden-input/HiddenInput", () => ({
    HiddenInput: ({ value, id }: { value: string; id: string }) => <span data-input-id={id}>{value}</span>
}))
vi.mock("../ui/zoom-control/ZoomControl", () => ({ ZoomControl: ({ hidden }: { hidden?: boolean }) => <span data-zoom-hidden={String(!!hidden)} /> }))
vi.mock("../system/SelectElem", () => ({ SelectElem: ({ children }: { children?: ReactNode }) => <span data-select>{children}</span> }))
vi.mock("./Reference", () => ({ Reference: () => <span data-reference /> }))

const show = {
    settings: { activeLayout: "l1" },
    layouts: { l1: { name: "Principal", slides: [{ id: "sl1" }] }, l2: { name: "Segundo", slides: [] } },
    slides: { sl1: { group: "g1" } },
    category: "cat"
}

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([
        looseEntry(activeShow, { id: "s1", index: 0, type: "show" }),
        looseEntry(showsCache, { s1: structuredClone(show) }),
        looseEntry(actions, { a1: { name: "Acción" } }),
        looseEntry(editingProjectTemplate, null),
        looseEntry(activeProject, "p1"),
        looseEntry(projects, structuredClone({ p1: { shows: [{ layout: "l1", layoutInfo: { name: "Principal" } }] } })),
        looseEntry(projectTemplates, {}),
        looseEntry(slidesOptions, { columns: 4, mode: "grid" }),
        looseEntry(labelsDisabled, false),
        looseEntry(activePopup, null),
        looseEntry(alertMessage, "")
    ])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("Layouts", () => {
    it("muestra_el_tiempo_total_y_el_estado_traducido_en_la_barra_superior", () => {
        const { container } = render(<Layouts />)
        const buttons = Array.from(container.querySelectorAll("button"))
        expect(buttons.some((button) => button.title.includes("02:00"))).toBe(true)
        expect(buttons.some((button) => button.title.includes("popup.translate"))).toBe(true)
    })

    it("muestra_los_botones_de_accion_personalizada_y_del_popup", () => {
        restore = setStoresForTest([
            looseEntry(activeShow, { id: "s1", index: 0, type: "show" }),
            looseEntry(showsCache, { s1: { ...show, settings: { activeLayout: "l1", customAction: "a1" } } }),
            looseEntry(actions, { a1: { name: "Acción" } }),
            looseEntry(editingProjectTemplate, null),
            looseEntry(activeProject, "p1"),
            looseEntry(projects, { p1: {} }),
            looseEntry(projectTemplates, {}),
            looseEntry(slidesOptions, { columns: 4, mode: "grid" }),
            looseEntry(labelsDisabled, false),
            looseEntry(activePopup, null),
            looseEntry(alertMessage, "")
        ])
        const { container } = render(<Layouts />)
        expect(container.textContent).toContain("Acción")
        fireEvent.click(Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Acción"))!)
        expect(runAction).toHaveBeenCalledWith({ name: "Acción" }, { source: "click" })
    })

    it("abre_el_popup_de_acciones_al_editar_la_accion_personalizada", () => {
        restore = setStoresForTest([
            looseEntry(activeShow, { id: "s1", index: 0, type: "show" }),
            looseEntry(showsCache, { s1: { ...show, settings: { activeLayout: "l1", customAction: "a1" } } }),
            looseEntry(actions, { a1: { name: "Acción" } }),
            looseEntry(editingProjectTemplate, null),
            looseEntry(activeProject, null),
            looseEntry(projects, {}),
            looseEntry(projectTemplates, {}),
            looseEntry(slidesOptions, { columns: 4, mode: "grid" }),
            looseEntry(labelsDisabled, false),
            looseEntry(activePopup, null),
            looseEntry(alertMessage, "")
        ])
        const { container } = render(<Layouts />)
        fireEvent.click(Array.from(container.querySelectorAll("button")).find((button) => button.title === "show.custom_action_tip")!)
        expect(get(activePopup)).toBe("custom_action")
    })

    it("muestra_el_bloqueo_y_no_permite_editar_cuando_el_perfil_es_de_lectura", () => {
        vi.mocked(getAccess).mockReturnValue({ global: "read" } as never)
        const { container } = render(<Layouts />)
        expect(container.querySelector("[data-icon='locked']")).toBeTruthy()
        fireEvent.click(Array.from(container.querySelectorAll("button")).find((button) => button.title === "show.locked")!)
        expect(get(activePopup)).toBe("alert")
        expect(get(alertMessage)).toContain("Unlock it")
    })

    it("muestra_los_layouts_ordenados_y_cambia_el_activo", () => {
        const { container } = render(<Layouts />)
        const inputs = container.querySelectorAll("[data-input-id]")
        expect(Array.from(inputs).map((input) => input.getAttribute("data-input-id"))).toEqual(["layout_l1", "layout_l2"])
        fireEvent.click(container.querySelectorAll("[data-select] button")[1])
        expect(get(showsCache).s1.settings.activeLayout).toBe("l2")
        expect(get(projects).p1.shows[0].layout).toBe("l2")
    })

    it("duplica_el_layout_con_click_normal_y_lo_crea_con_ctrl", () => {
        const { container } = render(<Layouts />)
        const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.title === "show.new_arrangement")!
        fireEvent.click(addButton)
        expect(duplicate).toHaveBeenCalledWith({ id: "layout" })
        fireEvent.click(addButton, { ctrlKey: true })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ id: "UPDATE", newData: expect.objectContaining({ key: "layouts" }) }))
    })

    it("cambia_la_vista_de_slides_y_el_numero_de_columnas", () => {
        const { container } = render(<Layouts />)
        fireEvent.click(Array.from(container.querySelectorAll("button")).find((button) => button.title?.includes("show.change_view"))!)
        expect(changeSlidesView).toHaveBeenCalled()
        expect(container.querySelector("[data-zoom-hidden]")).toBeTruthy()
    })

    it("con_reference_type_lessons_muestra_solo_el_control_de_zoom", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "s1", index: 0, type: "show" }), looseEntry(showsCache, { s1: { ...show, reference: { type: "lessons" } } }), looseEntry(actions, {}), looseEntry(editingProjectTemplate, null), looseEntry(activeProject, null), looseEntry(projects, {}), looseEntry(projectTemplates, {}), looseEntry(slidesOptions, { columns: 4, mode: "grid" }), looseEntry(labelsDisabled, false), looseEntry(activePopup, null), looseEntry(alertMessage, "")])
        const { container } = render(<Layouts />)
        expect(container.querySelector("[data-zoom-hidden]")?.getAttribute("data-zoom-hidden")).toBe("true")
        expect(container.querySelector("[data-reference]")).toBeTruthy()
        expect(container.querySelectorAll("[data-testid='bar']").length).toBe(1)
    })

    it("con_reference_muestra_el_componente_Reference", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "s1", index: 0, type: "show" }), looseEntry(showsCache, { s1: { ...show, reference: { type: "scripture" } } }), looseEntry(actions, {}), looseEntry(editingProjectTemplate, null), looseEntry(activeProject, null), looseEntry(projects, {}), looseEntry(projectTemplates, {}), looseEntry(slidesOptions, { columns: 4, mode: "grid" }), looseEntry(labelsDisabled, false), looseEntry(activePopup, null), looseEntry(alertMessage, "")])
        const { container } = render(<Layouts />)
        expect(container.querySelector("[data-reference]")).toBeTruthy()
    })

    it("en_modo_simple_no_muestra_la_barra_de_layouts", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "s1", index: 0, type: "show" }), looseEntry(showsCache, { s1: show }), looseEntry(actions, {}), looseEntry(editingProjectTemplate, null), looseEntry(activeProject, null), looseEntry(projects, {}), looseEntry(projectTemplates, {}), looseEntry(slidesOptions, { columns: 4, mode: "simple" }), looseEntry(labelsDisabled, false), looseEntry(activePopup, null), looseEntry(alertMessage, "")])
        const { container } = render(<Layouts />)
        expect(container.querySelectorAll("[data-testid='bar']").length).toBe(1)
    })

    it("usa_el_icono_de_la_accion_personalizada", () => {
        restore = setStoresForTest([
            looseEntry(activeShow, { id: "s1", index: 0, type: "show" }),
            looseEntry(showsCache, { s1: { ...show, settings: { activeLayout: "l1", customAction: "a1" } } }),
            looseEntry(actions, { a1: { name: "Acción" } }),
            looseEntry(editingProjectTemplate, null),
            looseEntry(activeProject, null),
            looseEntry(projects, {}),
            looseEntry(projectTemplates, {}),
            looseEntry(slidesOptions, { columns: 4, mode: "grid" }),
            looseEntry(labelsDisabled, false),
            looseEntry(activePopup, null),
            looseEntry(alertMessage, "")
        ])
        vi.mocked(getActionIcon).mockReturnValue("forward")
        const { container } = render(<Layouts />)
        expect(container.querySelector("[data-icon='forward']")).toBeTruthy()
    })
})

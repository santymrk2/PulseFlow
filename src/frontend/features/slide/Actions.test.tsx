// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeShow, groups, outputs, showsCache, special, templates } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { getAccess } from "../../shared/utils/profile"
import { history } from "../../shared/utils/helpers/history"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Actions } from "./Actions"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../shared/utils/profile", () => ({ getAccess: vi.fn(() => ({ global: "edit" })) }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/output", () => ({ getFirstActiveOutput: vi.fn(() => undefined) }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: vi.fn(() => []) }))
vi.mock("../../components/actions/actions", () => ({ getActionName: vi.fn(() => ""), getActionTriggerId: vi.fn((id: string) => id) }))
vi.mock("../../components/actions/actionData", () => ({ actionData: { goto: { name: "actions.goto", icon: "forward" } } }))
vi.mock("../../shared/ui/helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(activeShow, { id: "s1" }), looseEntry(showsCache, { s1: { settings: { activeLayout: "l1" } } }), looseEntry(outputs, {}), looseEntry(special, { groupShortcutPreview: false }), looseEntry(groups, {}), looseEntry(templates, {})])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("Actions", () => {
    it("muestra_el_atajo_de_slide_y_al_quitarlo_lo_elimina_del_historial", () => {
        const { container } = render(<Actions columns={4} actions={{ slide_shortcut: { key: "F1" } }} />)
        expect(container.textContent).toContain("F1")
        fireEvent.click(container.querySelector("button")!)
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ id: "SHOW_LAYOUT", newData: expect.objectContaining({ data: expect.not.objectContaining({ slide_shortcut: expect.anything() }) }) }))
    })

    it("muestra_las_acciones_simples_activas_y_no_las_inactivas", () => {
        const { container } = render(<Actions columns={4} actions={{ nextAfterMedia: true, animate: false }} />)
        expect(container.querySelectorAll("button").length).toBe(1)
        expect(container.querySelector("[data-icon]")?.getAttribute("data-icon")).toBe("forward")
    })

    it("muestra_el_nombre_y_el_icono_de_las_slideActions", () => {
        const { container } = render(<Actions columns={4} actions={{ slideActions: [{ id: "a1", triggers: ["goto"], name: "Mi acción", actionValues: { goto: { slide: 2 } }, customData: { goto: {} } }] }} />)
        expect(container.querySelector("[data-icon='forward']")).toBeTruthy()
        fireEvent.click(container.querySelector("button")!)
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ id: "SHOW_LAYOUT" }))
    })

    it("con_show_bloqueado_muestra_el_toast_y_no_guarda", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "s1" }), looseEntry(showsCache, { s1: { locked: true } }), looseEntry(outputs, {}), looseEntry(special, {}), looseEntry(groups, {}), looseEntry(templates, {})])
        const { container } = render(<Actions columns={4} actions={{ nextAfterMedia: true }} />)
        fireEvent.click(container.querySelector("button")!)
        expect(newToast).toHaveBeenCalledWith("show.locked")
        expect(history).not.toHaveBeenCalled()
    })

    it("con_perfil_de_solo_lectura_no_guarda", () => {
        vi.mocked(getAccess).mockReturnValue({ global: "read" } as never)
        const { container } = render(<Actions columns={4} actions={{ nextAfterMedia: true }} />)
        fireEvent.click(container.querySelector("button")!)
        expect(newToast).toHaveBeenCalledWith("profile.locked")
        expect(history).not.toHaveBeenCalled()
    })

    it("con_template_id_no_guarda_el_cambio", () => {
        const { container } = render(<Actions columns={4} templateId="t1" actions={{ nextAfterMedia: true }} />)
        fireEvent.click(container.querySelector("button")!)
        expect(history).not.toHaveBeenCalled()
    })

    it("aplica_el_zoom_segun_las_columnas", () => {
        const { container } = render(<Actions columns={2} actions={{}} />)
        expect((container.firstElementChild as HTMLElement).style.zoom).toBe("2")
    })
})

// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { cleanup, render } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getDefaultProjectName, getProjectName } from "../../../shared/utils/helpers/historyHelpers"
import { special } from "../../../shared/core/stores"
import { clearFields, fields, fire } from "../../../shared/test/kitMocks"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { PlaylistOptionsModal } from "./PlaylistOptionsModal"

const { modalProps } = vi.hoisted(() => ({ modalProps: { current: {} as Record<string, unknown> } }))

vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, MENU_BAR_HEIGHT: 25 }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("./ModalBase", () => ({
    ModalBase: (props: { title?: string; width?: number; height?: number; lockOutsideClick?: boolean; children?: ReactNode }) => {
        modalProps.current = props
        return <div data-modal>{props.children}</div>
    }
}))
vi.mock("../../../shared/ui/kit/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../../../shared/test/kitMocks")>("../../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../../shared/ui/kit/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../../../shared/test/kitMocks")>("../../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../../shared/utils/helpers/historyHelpers", async () => {
    const actual = await vi.importActual<typeof import("../../../shared/utils/helpers/historyHelpers")>("../../../shared/utils/helpers/historyHelpers")
    return {
        ...actual,
        getDefaultProjectName: vi.fn(() => "Formato por defecto"),
        getProjectName: vi.fn(() => "Nombre calculado"),
        projectReplacers: [
            { id: "D0", title: "Domingo", value: () => "" },
            { id: "DD", title: "Día", value: () => "" },
            { id: "MM", title: "Mes", value: () => "" }
        ]
    }
})

const NAME_LABEL = "settings.default_project_name<span style='opacity: 0.5;padding-left: 8px;font-size: 0.8em;color: var(--text);'>Nombre calculado</span>"
const TOGGLE_LABEL = "settings.startup_projects_list"
const REPLACER_TITLE = "<br>• <b>Día:</b> {DD}<br>• <b>Mes:</b> {MM}"

let restaurar: () => void = () => {}
function montar(valor: Record<string, unknown> = {}) {
    restaurar = setStoresForTest([looseEntry(special, valor)] as never)
    return render(<PlaylistOptionsModal />)
}

beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    modalProps.current = {}
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("PlaylistOptionsModal", () => {
    it("usa_la_base_del_modal_con_las_props_originales_y_dentro_el_cuerpo", () => {
        montar()
        expect(modalProps.current).toMatchObject({ title: "edit.options", width: 520, height: 260, lockOutsideClick: false })
        expect(document.querySelector("[data-modal]")).toBeTruthy()
    })

    it("muestra_el_nombre_por_defecto_y_los_reemplazos_en_el_titulo", () => {
        montar()
        expect(fields[NAME_LABEL]).toMatchObject({ value: "Formato por defecto", defaultValue: "Formato por defecto", title: REPLACER_TITLE })
        expect(fields[TOGGLE_LABEL]).toMatchObject({ checked: undefined, defaultValue: false })
        expect(getDefaultProjectName).toHaveBeenCalled()
        expect(getProjectName).toHaveBeenCalledWith("", {})
    })

    it("usa_default_project_name_de_special_cuando_hay_uno", () => {
        montar({ default_project_name: "Personalizado" })
        expect(fields[NAME_LABEL].value).toBe("Personalizado")
    })

    it("cambia_default_project_name_incluso_con_valor_vacio", () => {
        montar()
        fire(NAME_LABEL, "onChange", "Nuevo nombre")
        expect(get(special).default_project_name).toBe("Nuevo nombre")
        fire(NAME_LABEL, "onChange", "")
        expect(get(special).default_project_name).toBe("")
    })

    it("alterna_startupProjectsList_y_lo_borra_al_deshabilitarlo", () => {
        montar()
        fire(TOGGLE_LABEL, "onChange", true)
        expect(get(special).startupProjectsList).toBe(true)
        fire(TOGGLE_LABEL, "onChange", false)
        expect("startupProjectsList" in get(special)).toBe(false)
    })
})

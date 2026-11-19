// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renameCalendar } from "../../components/drawer/calendar/calendars"
import { history } from "../../components/helpers/history"
import { getLayoutRef } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { activePopup, activeShow, audioRouting, calendars, customScriptureBooks, dictionary, drawerTabsData, effectsLibrary, selected, scripturesCache, showsCache } from "../../shared/core/stores"
import { clearPopupSubmit, triggerPopupSubmit } from "../../utils/popup"
import { clearFields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Rename } from "./Rename"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/drawer/calendar/calendars", () => ({ renameCalendar: vi.fn() }))
vi.mock("../../components/helpers/shows", () => ({ _show: vi.fn(() => ({ slides: () => ({ get: () => [undefined], set: vi.fn() }), layouts: () => ({ get: () => [] }) })) }))
vi.mock("../../components/helpers/show", () => ({ getLayoutRef: vi.fn(() => []) }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const dict = { popup: { change_name: "Cambiar nombre" }, inputs: { name: "Nombre" }, actions: { rename: "Renombrar" } }
function montar(
    opts: {
        id: string
        data: object[]
        activeShow?: object | null
        shows?: object
        routing?: object
        cals?: object
        drawer?: object
        scriptures?: object
        effects?: object[]
    } = { id: "group", data: [{ id: "s1" }] }
) {
    restaurar = setStoresForTest([
        looseEntry(selected, { id: opts.id, data: opts.data }),
        looseEntry(activeShow, opts.activeShow === undefined ? { id: "sh1" } : opts.activeShow),
        looseEntry(showsCache, opts.shows || { sh1: { slides: { s1: { group: "Viejo" }, s2: { group: "Otro" } }, layouts: {} } }),
        looseEntry(audioRouting, opts.routing || { channels: [], connections: [] }),
        looseEntry(calendars, opts.cals || {}),
        looseEntry(drawerTabsData, opts.drawer || {}),
        looseEntry(scripturesCache, opts.scriptures || {}),
        looseEntry(customScriptureBooks, {}),
        looseEntry(effectsLibrary, opts.effects || []),
        storeEntry(activePopup, "rename"),
        storeEntry(dictionary, dict)
    ] as never)
    return render(<Rename />)
}
let restaurar: () => void = () => {}
const renombrar = () => fireEvent.click(screen.getByText("Renombrar"))
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    vi.mocked(getLayoutRef).mockReturnValue([])
})
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
})

describe("Rename", () => {
    it("grupo_toma_el_nombre_actual_y_escribe_el_nuevo_con_history", () => {
        montar()
        expect(document.querySelector('[data-field="inputs.name"]')?.getAttribute("data-value")).toBe("Viejo")
        fire("inputs.name", "onChange", "Nuevo")
        renombrar()
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ id: "UPDATE", newData: { data: "Nuevo", key: "slides", keys: ["s1"], subkey: "group" } }))
        expect(get(activePopup)).toBeNull()
        expect(get(selected)).toEqual({ id: null, data: [] })
    })

    it("muestra_la_lista_de_grupos_cuando_hay_más_de_uno", () => {
        vi.mocked(getLayoutRef).mockReturnValue([
            { id: "s1", index: 0, data: {} },
            { id: "s2", index: 1, data: {} }
        ] as never)
        montar({ id: "slide", data: [{ index: 0 }, { index: 1 }] })
        expect(screen.getByText("Cambiar nombre")).toBeTruthy()
        expect(screen.getByText("Viejo")).toBeTruthy()
        expect(screen.getByText("Otro")).toBeTruthy()
        expect(document.querySelectorAll("li").length).toBe(2)
    })

    it("renombrar_un_grupo_de_slides_manda_history_por_cada_slide", () => {
        montar({ id: "group", data: [{ id: "s1" }, { id: "s2" }] })
        fire("inputs.name", "onChange", "Grupo")
        renombrar()
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: expect.objectContaining({ keys: ["s1"], data: "Grupo" }) }))
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: expect.objectContaining({ keys: ["s2"], data: "Grupo" }) }))
    })

    it("audio_channel_actualiza_el_nombre_y_quita_outputLink", () => {
        montar({ id: "audio_channel", data: [{ id: "ch1" }], routing: { channels: [{ id: "ch1", name: "Viejo", outputLink: "out1" }], connections: [] } })
        expect(document.querySelector('[data-field="inputs.name"]')?.getAttribute("data-value")).toBe("Viejo")
        fire("inputs.name", "onChange", "Mic")
        renombrar()
        expect(get(audioRouting)?.channels?.[0]).toMatchObject({ id: "ch1", name: "Mic" })
        expect(get(audioRouting)?.channels?.[0].outputLink).toBeUndefined()
    })

    it("calendar_llama_a_renameCalendar_con_el_nombre_recortado", () => {
        montar({ id: "calendar", data: [{ id: "cal1" }], cals: { cal1: { name: "Viejo" } } })
        fire("inputs.name", "onChange", "  Nuevo  ")
        renombrar()
        expect(renameCalendar).toHaveBeenCalledWith("cal1", "Nuevo")
    })

    it("bible_book_escribe_customName_y_el_store_del_cajón", () => {
        montar({
            id: "bible_book",
            data: [{ index: 1 }],
            drawer: { scripture: { activeSubTab: "b1" } },
            scriptures: { b1: { name: "Biblia", books: [{ name: "Génesis", number: 1, chapters: [] }] } }
        })
        expect(document.querySelector('[data-field="inputs.name"]')?.getAttribute("data-value")).toBe("Génesis")
        fire("inputs.name", "onChange", "Genesis custom")
        renombrar()
        expect((get(scripturesCache).b1.books[0] as { customName?: string }).customName).toBe("Genesis custom")
        expect(get(customScriptureBooks).b1[0]).toBe("Genesis custom")
    })

    it("audio_effect_renombra_la_entrada_correspondiente", () => {
        montar({ id: "audio_effect", data: [{ path: "/fx/reverb", name: "Viejo" }], effects: [{ path: "/fx/reverb", name: "Viejo" }] })
        fire("inputs.name", "onChange", "Reverb")
        renombrar()
        expect(get(effectsLibrary)[0].name).toBe("Reverb")
    })

    it("Enter_renombra_y_un_id_desconocido_sólo_cierra", () => {
        montar({ id: "timer", data: [{ name: "Viejo" }] })
        fire("inputs.name", "onChange", "Nuevo")
        act(() => {
            expect(triggerPopupSubmit()).toBe(true)
        })
        expect(history).not.toHaveBeenCalled()
        expect(get(activePopup)).toBeNull()
    })
})

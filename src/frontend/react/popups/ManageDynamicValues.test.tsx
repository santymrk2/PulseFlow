// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { special } from "../../shared/core/stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ManageDynamicValues } from "./ManageDynamicValues"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../ui/checkbox-field/CheckboxField", async () => ({ CheckboxField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/file-field/FileField", async () => ({ FileField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const SECCIONES = ["timer.time", "guide_title.project", "guide_title.show", "edit.text", "edit.video", "tools.audio", "tools.metadata", "items.timer", "settings.rss", "settings.txt", "items.variable"]
let restaurar: () => void = () => {}
function montar(valor: object = {}) {
    restaurar = setStoresForTest([looseEntry(special, valor)])
    return render(<ManageDynamicValues />)
}
const agregar = (indice: number) => fireEvent.click(screen.getAllByText("[settings.add]")[indice].closest("button") as HTMLElement)
const abrirMenu = () => fireEvent.click(document.querySelector("[data-title='main.open']") as HTMLElement)
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ManageDynamicValues", () => {
    it("lista_las_once_secciones_con_los_siempre_activos_y_rss_txt_apagados_si_estan_vacios", () => {
        montar({ disabledDynamicValues: ["video"] })
        expect(SECCIONES.every((label) => fields[label])).toBe(true)
        const estado = (label: string) => [fields[label].checked, fields[label].disabled]
        expect(estado("timer.time")).toEqual([true, true])
        expect(estado("guide_title.show")).toEqual([true, true])
        expect(estado("items.variable")).toEqual([true, true])
        expect(estado("settings.rss")).toEqual([false, true])
        expect(estado("settings.txt")).toEqual([false, true])
        expect(estado("edit.video")).toEqual([false, false])
        expect(estado("guide_title.project")).toEqual([true, false])
    })

    it("con_rss_y_txt_cargados_sus_secciones_se_pueden_alternar", () => {
        montar({ dynamicRSS: [{ name: "a", url: "u", count: 5 }], dynamicTXT: [{ name: "b", url: "u" }] })
        expect([fields["settings.rss"].disabled, fields["settings.txt"].disabled]).toEqual([false, false])
        expect([fields["settings.rss"].checked, fields["settings.txt"].checked]).toEqual([true, true])
    })

    it("alternar_una_seccion_la_agrega_y_la_saca_de_disabledDynamicValues", () => {
        montar({ disabledDynamicValues: ["audio"] })
        fire("guide_title.project", "onChange", false)
        expect(get(special).disabledDynamicValues).toEqual(["audio", "project"])
        expect(fields["guide_title.project"].checked).toBe(false)
        fire("tools.audio", "onChange", true)
        expect(get(special).disabledDynamicValues).toEqual(["project"])
        expect(fields["tools.audio"].checked).toBe(true)
    })

    it("sin_lista_previa_crea_disabledDynamicValues", () => {
        montar()
        fire("edit.text", "onChange", false)
        expect(get(special).disabledDynamicValues).toEqual(["slide_text"])
    })

    describe("rss", () => {
        it("agregar_suma_una_fuente_por_defecto_y_borrar_la_saca", () => {
            const { container } = montar()
            agregar(0)
            expect(get(special).dynamicRSS).toEqual([{ name: "", url: "", count: 5 }])
            expect(container.querySelectorAll("[data-field='inputs.name']").length).toBe(1)
            fireEvent.click(document.querySelector("[data-title='actions.delete']") as HTMLElement)
            expect(get(special).dynamicRSS).toEqual([])
            expect(container.querySelectorAll("[data-field='inputs.name']").length).toBe(0)
        })

        it("el_nombre_se_deshabilita_cuando_ya_hay_nombre_y_url", () => {
            montar({ dynamicRSS: [{ name: "n", url: "", count: 5 }] })
            expect(fields["inputs.name"].disabled).toBe(false)
            fire("inputs.name", "onChange", "Noticias")
            expect(get(special).dynamicRSS[0].name).toBe("Noticias")
        })

        it("el_menu_muestra_url_divisor_intervalo_y_cantidad_con_sus_valores_por_defecto", () => {
            montar({ dynamicRSS: [{ name: "n", url: "", count: 0 }] })
            abrirMenu()
            expect(fields["inputs.url"].value).toBe("")
            expect(fields["meta.text_divider"].value).toBe(" | ")
            expect(fields["edit.interval"].value).toBe("60")
            expect(fields["edit.count"]).toMatchObject({ value: 5, min: 1, max: 1000 })
            expect((fields["edit.interval"].options as { value: string }[]).map((o) => o.value)).toEqual(["5", "10", "15", "30", "60", "120", "240"])

            fire("inputs.url", "onChange", "https://x")
            fire("meta.text_divider", "onChange", "-")
            fire("edit.interval", "onChange", "10")
            fire("edit.count", "onChange", 7)
            expect(get(special).dynamicRSS[0]).toEqual({ name: "n", url: "https://x", count: 7, divider: "-", updateInterval: "10" })
        })
    })

    describe("txt", () => {
        it("agregar_suma_una_fuente_con_intervalo_3_y_borrar_la_saca", () => {
            const { container } = montar()
            agregar(1)
            expect(get(special).dynamicTXT).toEqual([{ name: "", url: "", updateInterval: "3" }])
            expect(container.querySelectorAll("[data-field='inputs.name']").length).toBe(1)
            fireEvent.click(document.querySelector("[data-title='actions.delete']") as HTMLElement)
            expect(get(special).dynamicTXT).toEqual([])
        })

        it("el_menu_edita_url_archivo_intervalo_y_divisor", () => {
            montar({ dynamicTXT: [{ name: "n", url: "" }] })
            fire("inputs.name", "onChange", "Letras")
            abrirMenu()
            expect(fields["meta.text_divider"].value).toBe("<br>")
            expect(fields["edit.interval"].value).toBe("3")
            expect((fields["edit.interval"].options as { value: string }[]).map((o) => o.value)).toEqual(["1", "3", "5", "10", "30", "60", "300"])
            expect(fields[""]).toMatchObject({ title: "scripture.local", icon: "folder", noLabel: true, filter: { name: "Text files", extensions: ["txt"] } })

            fire("", "onChange", "/a.txt")
            fire("edit.interval", "onChange", "5")
            fire("meta.text_divider", "onChange", "|")
            expect(get(special).dynamicTXT[0]).toEqual({ name: "Letras", url: "/a.txt", updateInterval: "5", divider: "|" })
        })
    })
})

// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, scriptures } from "../../shared/core/stores"
import { clearPopupSubmit, triggerPopupSubmit } from "../../shared/utils/popup"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { CreateCollection } from "./CreateCollection"

vi.mock("uid", () => ({ uid: () => "col1" }))
vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../components/drawer/bible/scripture", () => ({ getShortBibleName: (n: string) => n.slice(0, 3) }))

const SCRIPTURES = {
    bible_a: { name: "Reina Valera", id: "rv" },
    bible_b: { name: "Biblia Larga", customName: "Mi Biblia", id: "bl" },
    bible_c: { name: "Api Bible", api: true, id: "ab" },
    bible_d: { name: "Colección", collection: { versions: [] }, id: "c" }
}
let restaurar: () => void = () => {}
function montar() {
    restaurar = setStoresForTest([looseEntry(scriptures, structuredClone(SCRIPTURES)), storeEntry(activePopup, "create_collection"), storeEntry(dictionary, { timer: { create: "Crear" } })] as never)
    return render(<CreateCollection />)
}
const marcar = (texto: string) => fireEvent.click(screen.getByText(texto))
const crear = () => document.querySelector("button") as HTMLButtonElement
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
})

describe("CreateCollection", () => {
    it("lista_biblias_locales_y_de_API_sin_colecciones_y_el_botón_empieza_en_0_de_2", () => {
        montar()
        expect(screen.getByText("Reina Valera")).toBeTruthy()
        expect(screen.getByText("Mi Biblia")).toBeTruthy()
        expect(screen.getByText("Api Bible")).toBeTruthy()
        expect(screen.queryByText("Colección")).toBeNull()
        expect(screen.getByText("API")).toBeTruthy()
        expect(crear().disabled).toBe(true)
        expect(crear().textContent).toContain("0/2")
    })

    it("con_dos_marcadas_crea_la_colección_con_nombre_compuesto_y_cierra", () => {
        montar()
        marcar("Reina Valera")
        expect(crear().textContent).toContain("1/2")
        marcar("Api Bible")
        expect(crear().disabled).toBe(false)
        fireEvent.click(crear())
        expect(get(scriptures).col1).toEqual({ name: "Rei + Api", collection: { versions: ["bible_a", "bible_c"] } })
        expect(get(activePopup)).toBeNull()
    })

    it("desmarcar_saca_la_versión_de_la_selección", () => {
        montar()
        marcar("Reina Valera")
        marcar("Reina Valera")
        expect(crear().textContent).toContain("0/2")
    })

    it("Enter_crea_sólo_si_hay_dos_o_más", () => {
        montar()
        marcar("Reina Valera")
        triggerPopupSubmit()
        expect(get(scriptures).col1).toBeUndefined()
        expect(get(activePopup)).toBe("create_collection")

        marcar("Mi Biblia")
        triggerPopupSubmit()
        expect(get(scriptures).col1.collection?.versions).toEqual(["bible_a", "bible_b"])
        expect(get(activePopup)).toBeNull()
    })

    it("cerrar_sin_crear_no_toca_scriptures", () => {
        const { unmount } = montar()
        marcar("Reina Valera")
        unmount()
        expect(Object.keys(get(scriptures))).toEqual(["bible_a", "bible_b", "bible_c", "bible_d"])
        expect(triggerPopupSubmit()).toBe(false)
    })
})

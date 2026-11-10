// @vitest-environment happy-dom
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { commonMock } from "../test/mockCommon"
import { reactPopups } from "./registry"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))

// Importar popupComponents arrastra ~90 popups Svelte que tocan AudioContext, pdf, etc. al cargarse: se leen las claves del literal.
function clavesDePopups(): string[] {
    const source = readFileSync("src/frontend/components/main/popupComponents.ts", "utf8")
    const literal = source.slice(source.indexOf("export const popups"))
    const body = literal.slice(0, literal.indexOf("\n}"))
    return [...body.matchAll(/^ {4}(\w+):/gm)].map((match) => match[1])
}

describe("reactPopups", () => {
    it("lee_las_claves_del_mapa_popups", () => {
        expect(clavesDePopups()).toContain("kit_demo")
    })

    it("ninguna_clave_esta_a_la_vez_en_popups_y_en_reactPopups", () => {
        const enPopups = clavesDePopups()
        expect(Object.keys(reactPopups).filter((id) => enPopups.includes(id))).toEqual([])
    })

    it("registra_la_demo_comparativa_y_no_esta_en_popups", () => {
        expect(reactPopups.kit_demo_react).toBeTypeOf("function")
        expect(clavesDePopups()).not.toContain("kit_demo_react")
    })
})

import { afterEach, describe, expect, it, vi } from "vitest"
import { get } from "../../../shared/core/lib/store"
import { activeLook, looks, outputs, styles } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { createLookFromPreset, LOOK_PRESETS } from "./lookPresets"

vi.mock("../../../app/wiring/save", () => ({ save: () => {} }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: () => {} }))
vi.mock("../../../shared/utils/language", () => ({ translateText: (id: string) => id, getLanguage: () => ({}), setLanguage: () => {} }))

let restore = () => {}
afterEach(() => restore())

function setup() {
    restore = setStoresForTest([looseEntry(looks, { l1: { name: "Uno", screens: {} } }), looseEntry(activeLook, "l1"), looseEntry(styles, { default: { name: "Default" } }), looseEntry(outputs, { a: { name: "A", style: "default" }, b: { name: "B", style: "default" }, s: { name: "S", stageOutput: "lay" } })])
}

describe("createLookFromPreset", () => {
    it.each([
        ["default", { media: true, slide: true, overlays: true }],
        ["lyrics", { media: false, slide: true, overlays: false }],
        ["speaker", { media: false, slide: true, overlays: true }]
    ] as const)("preset_%s_crea_un_look_nuevo_con_las_capas_esperadas_en_cada_pantalla_de_audiencia", (preset, layers) => {
        setup()
        const before = get(looks)
        const id = createLookFromPreset(preset, "Nuevo")
        expect(get(looks)).not.toBe(before) // referencia nueva: React Compiler cachea por identidad
        const created = get(looks)[id]
        expect(created.name).toBe("Nuevo")
        expect(Object.keys(created.screens).sort()).toEqual(["a", "b"])
        expect(created.screens.a.layers).toEqual(layers)
        expect(created.screens.b.layers).toEqual(layers)
        expect(get(looks).l1.screens).toEqual({}) // no toca los existentes
        expect(Object.keys(LOOK_PRESETS)).toContain(preset)
    })
})

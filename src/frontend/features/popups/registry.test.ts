// @vitest-environment happy-dom
import { existsSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { commonMock } from "../../shared/test/mockCommon"
import { reactPopups } from "./registry"

vi.mock("../../shared/utils/common", () => commonMock())
// el registro importa los popups React, que arrastran los .svelte de audio (AudioWorkletNode no existe en happy-dom)
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../import/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../edit/logic/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))

const MIGRADOS = ["effect_items", "kit_demo", "looks", "screen_config"]

describe("reactPopups", () => {
    it("registra_los_cuatro_popups_que_eran_Svelte", () => {
        expect(Object.keys(reactPopups)).toEqual(expect.arrayContaining(MIGRADOS))
        for (const id of MIGRADOS) expect(reactPopups[id as keyof typeof reactPopups]).toBeTypeOf("function")
    })

    it("ya_no_existe_el_registro_Svelte_ni_sus_cuatro_componentes", () => {
        expect(existsSync("src/frontend/components/main/popupComponents.ts")).toBe(false)
        expect(existsSync("src/frontend/components/main/popups/EffectItems.svelte")).toBe(false)
        expect(existsSync("src/frontend/components/main/popups/KitDemo.svelte")).toBe(false)
        expect(existsSync("src/frontend/components/looks/LooksWindow.svelte")).toBe(false)
        expect(existsSync("src/frontend/components/screens/ScreenConfig.svelte")).toBe(false)
    })

    it("registra_la_demo_comparativa_y_no_la_confunde_con_kit_demo", () => {
        expect(reactPopups.kit_demo_react).toBeTypeOf("function")
        expect(reactPopups.kit_demo).toBe(reactPopups.kit_demo_react)
    })
})

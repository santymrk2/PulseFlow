// @vitest-environment happy-dom
// Review Focus 4 (F24.8): con un TextField de React enfocado, los atajos globales de utils/shortcuts.ts no se disparan, igual que con el Svelte.
// Sin vi.mock de utils/common: shortcuts.ts importa mucho de ahí. Si el ciclo de imports rompe, ver el reporte de F24.8.
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"
import { quickSearchActive } from "../../../stores"
import { keydown as globalKeydown } from "../../../utils/shortcuts"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { TextField } from "./TextField"

// El árbol de imports de shortcuts.ts llega a módulos de audio que crean AudioContext al cargarse: un doble que acepta cualquier uso
vi.hoisted(() => {
    const any = (): unknown => new Proxy(function () {}, { get: () => any(), apply: () => any(), construct: () => any() as object })
    Object.assign(globalThis, {
        AudioWorkletNode: class {},
        AudioContext: function () {
            return any()
        }
    })
})

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
})

const input = () => document.querySelector("input") as HTMLInputElement
const ctrlF = () => new KeyboardEvent("keydown", { key: "f", ctrlKey: true, cancelable: true })

describe("TextField y los atajos globales", () => {
    it("sin_foco_en_un_campo_Ctrl+F_si_dispara_el_atajo", () => {
        restaurar = setStoresForTest([storeEntry(quickSearchActive, false)])
        render(<TextField label="x" value="" />)
        globalKeydown(ctrlF())
        expect(get(quickSearchActive)).toBe(true)
    })

    it("con_foco_en_el_TextField_Ctrl+F_no_dispara_el_atajo", () => {
        restaurar = setStoresForTest([storeEntry(quickSearchActive, false)])
        render(<TextField label="x" value="" />)
        input().focus()
        expect(document.activeElement).toBe(input())
        globalKeydown(ctrlF())
        expect(get(quickSearchActive)).toBe(false)
    })
})

// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { metronome, metronomeTimer } from "../../../shared/core/stores"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { MetronomeVisualizer } from "./MetronomeVisualizer"

let restaurar: () => void = () => {}

beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(metronome, { tempo: 120, beats: 3 }), storeEntry(metronomeTimer, { beat: 2, timeToNext: 0 })])
})

afterEach(() => {
    cleanup()
    restaurar()
})

describe("MetronomeVisualizer", () => {
    it("muestra una barra por beat y resalta el activo", () => {
        render(<MetronomeVisualizer />)
        expect(screen.getByText("1")).toBeTruthy()
        expect(screen.getByText("2")).toBeTruthy()
        expect(screen.getByText("3")).toBeTruthy()
    })

    it("aplica la clase isItem cuando se pide", () => {
        const { container } = render(<MetronomeVisualizer isItem />)
        expect(container.querySelector("section[class*='isItem']")).not.toBeNull()
    })
})

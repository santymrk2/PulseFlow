// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { popupData, transitionData } from "../../shared/core/stores"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Transition } from "./Transition"

vi.mock("../../shared/utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/request", () => ({ send: vi.fn() }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: vi.fn(() => []) }))
vi.mock("../../shared/utils/helpers/shows", () => ({ _show: vi.fn(() => ({ get: () => "" })) }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    restore = () => {}
})

function setStores() {
    restore = setStoresForTest([storeEntry(popupData, {}), storeEntry(transitionData, { text: { type: "fade", duration: 500, easing: "sine", custom: {} }, media: { type: "fade", duration: 800, easing: "sine", custom: {} } })])
}

describe("Transition", () => {
    it("usa el port React de Tabs para text/media y onActiveChange cambia el tipo", () => {
        setStores()
        render(<Transition />)
        const textTab = screen.getByTitle("transition.text")
        const mediaTab = screen.getByTitle("transition.media")
        expect(textTab.classList.contains("isActive")).toBe(true)
        fireEvent.click(mediaTab)
        expect(screen.getByTitle("transition.media").classList.contains("isActive")).toBe(true)
        expect(screen.getByTitle("transition.text").classList.contains("isActive")).toBe(false)
    })

    it("onActiveChange de la barra específica actualiza la pestaña elegida", () => {
        setStores()
        render(<Transition />)
        fireEvent.click(screen.getByTitle("create_show.more_options"))
        fireEvent.click(screen.getByTitle("transition.out"))
        expect(screen.getByTitle("transition.out").classList.contains("isActive")).toBe(true)
    })
})

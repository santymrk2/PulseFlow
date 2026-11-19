// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { applyLook } from "../../components/helpers/looks"
import { activeLook, activePopup, dictionary, looks, popupData } from "../../shared/core/stores"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { SelectLook } from "./SelectLook"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/helpers/looks", () => ({ applyLook: vi.fn() }))

const trigger = vi.fn()
let restaurar: () => void = () => {}
function montar(data: object = {}, looksData: object = { l1: { name: "Look uno" }, l2: { name: "Look dos" } }, activeLookId = "l1") {
    restaurar = setStoresForTest([storeEntry(popupData, data), looseEntry(looks, looksData), storeEntry(activeLook, activeLookId), storeEntry(activePopup, "select_look"), storeEntry(dictionary, {})] as never)
    return render(<SelectLook />)
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("SelectLook", () => {
    it("lista los looks y marca el activo con el ícono check", () => {
        montar()
        expect(screen.getByText("Look uno")).toBeTruthy()
        expect(screen.getByText("Look dos")).toBeTruthy()
        expect(document.querySelectorAll("svg").length).toBe(1)
    })

    it("elegir un look con trigger llama al trigger y escribe popupData", () => {
        montar({ trigger })
        fireEvent.click(screen.getByText("Look dos"))
        expect(trigger).toHaveBeenCalledWith("l2")
        expect(applyLook).not.toHaveBeenCalled()
        expect(get(popupData)).toMatchObject({ id: "select_look", value: "l2" })
    })

    it("sin trigger aplica el look directamente", () => {
        montar()
        fireEvent.click(screen.getByText("Look dos"))
        expect(applyLook).toHaveBeenCalledWith("l2")
    })

    it("cierra el popup y limpia popupData 200ms después", () => {
        montar({ trigger })
        fireEvent.click(screen.getByText("Look dos"))
        expect(get(activePopup)).toBe("select_look")
        act(() => vi.advanceTimersByTime(0))
        expect(get(activePopup)).toBeNull()
        expect(get(popupData)).toMatchObject({ value: "l2" })
        act(() => vi.advanceTimersByTime(200))
        expect(get(popupData)).toEqual({})
    })

    it("sin looks muestra los puntos", () => {
        montar({}, {}, "")
        expect(screen.getByText("...")).toBeTruthy()
    })
})

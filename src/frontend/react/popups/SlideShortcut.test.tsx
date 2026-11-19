// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { activePopup, dictionary, popupData } from "../../shared/core/stores"
import { clearIslands, islands } from "../test/islandMock"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { SlideShortcut } from "./SlideShortcut"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [{ id: "s1", data: { actions: {} } }] }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))

const trigger = vi.fn()
let restaurar: () => void = () => {}
function montar(data: object = { mode: "global_group" }) {
    restaurar = setStoresForTest([storeEntry(popupData, { trigger, ...data }), storeEntry(activePopup, "assign_shortcut"), storeEntry(dictionary, {})] as never)
    return render(<SlideShortcut />)
}

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("SlideShortcut", () => {
    it("al montar limpia popupData y muestra el tip de asignar", () => {
        montar()
        expect(get(popupData)).toEqual({})
        expect(islands.Tip.props).toEqual({ value: "actions.press_to_assign" })
        expect(get(activePopup)).toBe("assign_shortcut")
    })

    it("una letra válida llama a trigger, muestra la tecla y cierra el popup", () => {
        montar()
        fireEvent.keyDown(window, { key: "B" })
        expect(trigger).toHaveBeenCalledWith("b")
        expect(screen.getByText("b")).toBeTruthy()
        expect(get(activePopup)).toBeNull()
    })

    it("un atajo existente muestra el aviso y no llama a trigger", () => {
        montar({ mode: "global_group", existingShortcuts: ["b"] })
        fireEvent.keyDown(window, { key: "b" })
        expect(trigger).not.toHaveBeenCalled()
        expect(islands.Tip.props).toEqual({ type: "warning", value: "actions.shortcut_existing" })
        expect(get(activePopup)).toBe("assign_shortcut")
    })

    it("ignora números, teclas especiales y modificadores", () => {
        montar()
        fireEvent.keyDown(window, { key: "5" })
        fireEvent.keyDown(window, { key: "-" })
        fireEvent.keyDown(window, { key: "b", ctrlKey: true })
        expect(trigger).not.toHaveBeenCalled()
    })

    it("el botón volver restaura el popup anterior", () => {
        montar({ mode: "action", revert: "edit" })
        expect(get(popupData).mode).toBe("")
        fireEvent.click(document.querySelector("button.popup-back") as HTMLElement)
        expect(get(activePopup)).toBe("edit")
    })

    it("en slide_shortcut escribe la acción en el layout por history y cierra", () => {
        montar({ mode: "slide_shortcut", index: 0 })
        fireEvent.keyDown(window, { key: "x" })
        expect(history).toHaveBeenCalledWith({ id: "SHOW_LAYOUT", newData: { key: "actions", data: { slide_shortcut: { key: "x" } }, indexes: [0] } })
        expect(get(activePopup)).toBeNull()
    })

    it("sin modo conocido cierra directamente el popup", () => {
        montar({ mode: "otro" })
        expect(get(activePopup)).toBeNull()
    })

    it("el listener de teclado se quita al desmontar", () => {
        const { unmount } = montar()
        unmount()
        fireEvent.keyDown(window, { key: "b" })
        expect(trigger).not.toHaveBeenCalled()
    })
})

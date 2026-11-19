// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dictionary, overlays } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { OverlayActions } from "./OverlayActions"

const { historyMock } = vi.hoisted(() => ({ historyMock: vi.fn() }))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: historyMock }))

const overlayBase = {
    name: "Overlay 1",
    color: null,
    category: null,
    items: [],
    modified: 1,
    actions: [{ id: "a1", name: "Mi acción", triggers: ["clear_slide"] }],
    displayDuration: 5
}

let restaurar: () => void = () => {}

function montar(overlay: Record<string, unknown> = overlayBase) {
    restaurar()
    restaurar = setStoresForTest([storeEntry(dictionary, { actions: { remove: "Quitar" }, clear: { slide: "Limpiar slide" }, popup: { display_duration: "Duración" } }), storeEntry(overlays, { ov1: overlay } as never)])
    return render(<OverlayActions columns={5} overlayId="ov1" />)
}

beforeEach(() => {
    vi.clearAllMocks()
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

describe("OverlayActions", () => {
    it("muestra el nombre de la acción y la duración en segundos", () => {
        montar()
        expect(screen.getByText("Mi acción")).toBeTruthy()
        expect(screen.getByText("5s")).toBeTruthy()
    })

    it("las acciones con red no llevan el marcador whiteButton", () => {
        const { container } = montar()
        const button = screen.getByText("Mi acción").closest("button") as HTMLElement
        const marcador = button.closest("div[class*='button']") as HTMLElement
        expect(marcador.className).not.toContain("whiteButton")
        expect(container.querySelectorAll("button").length).toBe(2)
    })

    it("al quitar una acción escribe el historial con overlay_key actions_<id>", () => {
        vi.useFakeTimers()
        montar()
        fireEvent.click(screen.getByText("Mi acción").closest("button") as HTMLElement)
        act(() => vi.runAllTimers())
        expect(historyMock).toHaveBeenCalledWith({
            id: "UPDATE",
            newData: { key: "actions", data: [] },
            oldData: { id: "ov1" },
            location: { page: "drawer", id: "overlay_key", override: "actions_ov1" }
        })
    })

    it("al quitar displayDuration borra la propiedad del store y marca modified", () => {
        vi.useFakeTimers()
        montar()
        fireEvent.click(screen.getAllByRole("button")[1])
        act(() => vi.runAllTimers())
        const overlay = get(overlays).ov1 as unknown as Record<string, unknown>
        expect("displayDuration" in overlay).toBe(false)
        expect(typeof overlay.modified).toBe("number")
    })

    it("solo pinta los iconos de flags presentes en el overlay", () => {
        montar({ ...overlayBase, actions: [], locked: true })
        expect(screen.getAllByRole("button").length).toBe(1)
    })
})

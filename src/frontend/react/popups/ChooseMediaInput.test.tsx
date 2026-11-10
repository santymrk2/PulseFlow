// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, popupData } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { clearIslands, emit, islands } from "../test/islandMock"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ChooseMediaInput } from "./ChooseMediaInput"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("../../components/drawer/live/Cameras.svelte", () => ({ default: { isla: "Cameras" } }))
vi.mock("../../components/drawer/live/Screens.svelte", () => ({ default: { isla: "Screens" } }))
vi.mock("../../components/drawer/live/Windows.svelte", () => ({ default: { isla: "Windows" } }))
vi.mock("../../components/drawer/live/NDIStreams.svelte", () => ({ default: { isla: "NDIStreams" } }))
vi.mock("../../components/drawer/live/OMTStreams.svelte", () => ({ default: { isla: "OMTStreams" } }))
vi.mock("../../components/drawer/live/BMDStreams.svelte", () => ({ default: { isla: "BMDStreams" } }))

let restaurar: () => void = () => {}
function montar(data: object = {}) {
    restaurar = setStoresForTest([storeEntry(popupData, data), storeEntry(activePopup, "choose_media_input"), storeEntry(dictionary, { live: { cameras: "Cámaras", screens: "Pantallas" } })] as never)
    return render(<ChooseMediaInput />)
}
const presentes = (container: HTMLElement) => [...container.querySelectorAll("[data-isla]")].map((e) => e.getAttribute("data-isla"))
beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ChooseMediaInput", () => {
    it("renderiza_las_cinco_pestanas_y_las_camaras_por_defecto", () => {
        const { container } = montar()
        expect(screen.getByText("Cámaras")).toBeTruthy()
        expect(screen.getByText("NDI")).toBeTruthy()
        expect(screen.getByText("OMT")).toBeTruthy()
        expect(screen.getByText("Blackmagic")).toBeTruthy()
        expect(presentes(container)).toEqual(["Cameras"])
        expect(islands.Cameras.props).toEqual({ showPlayOnHover: false })
    })

    it("el_dispositivo_inicial_elige_la_pestana_y_active_gana_a_value", () => {
        let r = montar({ value: { type: "screen" } })
        expect(presentes(r.container)).toEqual(["Screens", "Windows"])
        cleanup()
        restaurar()
        r = montar({ value: { type: "screen" }, active: { type: "ndi" } })
        expect(presentes(r.container)).toEqual(["NDIStreams"])
        cleanup()
        restaurar()
        r = montar({ value: { type: "camera" } })
        expect(presentes(r.container)).toEqual(["Cameras"])
        cleanup()
        restaurar()
        r = montar({ value: { type: "blackmagic" } })
        expect(presentes(r.container)).toEqual(["BMDStreams"])
    })

    it("clic_en_una_pestana_cambia_la_lista", () => {
        const { container } = montar()
        fireEvent.click(screen.getByText("OMT"))
        expect(presentes(container)).toEqual(["OMTStreams"])
        fireEvent.click(screen.getByText("Pantallas"))
        expect(presentes(container)).toEqual(["Screens", "Windows"])
    })

    it("elegir_una_camara_sin_trigger_deja_value_en_popupData_y_cierra", () => {
        montar({ keep: 1 })
        emit("Cameras", "click", { cam: { id: "c1", name: "Cam", group: "g" } })
        expect(get(popupData)).toEqual({ keep: 1, value: { id: "c1", name: "Cam", group: "g", type: "camera" } })
        expect(get(activePopup)).toBeNull()
    })

    it("con_trigger_lo_llama_con_el_dispositivo_y_no_toca_popupData", () => {
        const trigger = vi.fn()
        montar({ trigger })
        emit("Cameras", "click", { cam: { id: "c1", name: "Cam", group: "g" } })
        expect(trigger).toHaveBeenCalledWith({ id: "c1", name: "Cam", group: "g", type: "camera" })
        expect(get(popupData)).toEqual({ trigger })
        expect(get(activePopup)).toBeNull()
    })

    it("pantallas_ndi_omt_y_blackmagic_eligen_con_su_tipo", () => {
        const { container } = montar({ value: { type: "screen" } })
        emit("Screens", "click", { screen: { id: "s1", name: "Pantalla" } })
        expect(get(popupData).value).toEqual({ id: "s1", name: "Pantalla", type: "screen" })
        emit("Windows", "click", { screen: { id: "w1", name: "Ventana" } })
        expect(get(popupData).value).toEqual({ id: "w1", name: "Ventana", type: "screen" })
        fireEvent.click(screen.getByText("NDI"))
        expect(presentes(container)).toEqual(["NDIStreams"])
        emit("NDIStreams", "click", { screen: { id: "n1", name: "N" } })
        expect(get(popupData).value).toEqual({ id: "n1", name: "N", type: "ndi" })
        fireEvent.click(screen.getByText("OMT"))
        emit("OMTStreams", "click", { screen: { id: "o1", name: "O" } })
        expect(get(popupData).value).toEqual({ id: "o1", name: "O", type: "omt" })
        fireEvent.click(screen.getByText("Blackmagic"))
        emit("BMDStreams", "click", { screen: { id: "b1", name: "B" } })
        expect(get(popupData).value).toEqual({ id: "b1", name: "B", type: "blackmagic" })
    })
})

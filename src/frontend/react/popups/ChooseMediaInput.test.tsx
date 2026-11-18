// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, popupData } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ChooseMediaInput } from "./ChooseMediaInput"

// Los ports de live/* exponen callbacks React: el test los reemplaza por botones que entregan un detalle fijo.
const details = vi.hoisted(() => ({
    Cameras: { cam: { id: "c1", name: "Cam", group: "g" } },
    Screens: { screen: { id: "s1", name: "Pantalla" } },
    Windows: { screen: { id: "w1", name: "Ventana" } },
    NDIStreams: { screen: { id: "n1", name: "N" } },
    OMTStreams: { screen: { id: "o1", name: "O" } },
    BMDStreams: { screen: { id: "b1", name: "B" } }
}))

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../drawer/live/Cameras", () => ({ Cameras: ({ onClick }: { onClick?: (d: unknown) => void }) => <button data-testid="Cameras" onClick={() => onClick?.(details.Cameras)} /> }))
vi.mock("../drawer/live/Screens", () => ({ Screens: ({ onClick }: { onClick?: (d: unknown) => void }) => <button data-testid="Screens" onClick={() => onClick?.(details.Screens)} /> }))
vi.mock("../drawer/live/Windows", () => ({ Windows: ({ onClick }: { onClick?: (d: unknown) => void }) => <button data-testid="Windows" onClick={() => onClick?.(details.Windows)} /> }))
vi.mock("../drawer/live/NDIStreams", () => ({ NDIStreams: ({ onClick }: { onClick?: (d: unknown) => void }) => <button data-testid="NDIStreams" onClick={() => onClick?.(details.NDIStreams)} /> }))
vi.mock("../drawer/live/OMTStreams", () => ({ OMTStreams: ({ onClick }: { onClick?: (d: unknown) => void }) => <button data-testid="OMTStreams" onClick={() => onClick?.(details.OMTStreams)} /> }))
vi.mock("../drawer/live/BMDStreams", () => ({ BMDStreams: ({ onClick }: { onClick?: (d: unknown) => void }) => <button data-testid="BMDStreams" onClick={() => onClick?.(details.BMDStreams)} /> }))

let restaurar: () => void = () => {}
function montar(data: object = {}) {
    restaurar = setStoresForTest([storeEntry(popupData, data), storeEntry(activePopup, "choose_media_input"), storeEntry(dictionary, { live: { cameras: "Cámaras", screens: "Pantallas" } })] as never)
    return render(<ChooseMediaInput />)
}
const presentes = (container: HTMLElement) => [...container.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid"))
const elegir = (name: string) => fireEvent.click(screen.getByTestId(name))

beforeEach(() => vi.clearAllMocks())
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
        elegir("Cameras")
        expect(get(popupData)).toEqual({ keep: 1, value: { id: "c1", name: "Cam", group: "g", type: "camera" } })
        expect(get(activePopup)).toBeNull()
    })

    it("con_trigger_lo_llama_con_el_dispositivo_y_no_toca_popupData", () => {
        const trigger = vi.fn()
        montar({ trigger })
        elegir("Cameras")
        expect(trigger).toHaveBeenCalledWith({ id: "c1", name: "Cam", group: "g", type: "camera" })
        expect(get(popupData)).toEqual({ trigger })
        expect(get(activePopup)).toBeNull()
    })

    it("pantallas_ndi_omt_y_blackmagic_eligen_con_su_tipo", () => {
        const { container } = montar({ value: { type: "screen" } })
        elegir("Screens")
        expect(get(popupData).value).toEqual({ id: "s1", name: "Pantalla", type: "screen" })
        elegir("Windows")
        expect(get(popupData).value).toEqual({ id: "w1", name: "Ventana", type: "screen" })
        fireEvent.click(screen.getByText("NDI"))
        expect(presentes(container)).toEqual(["NDIStreams"])
        elegir("NDIStreams")
        expect(get(popupData).value).toEqual({ id: "n1", name: "N", type: "ndi" })
        fireEvent.click(screen.getByText("OMT"))
        elegir("OMTStreams")
        expect(get(popupData).value).toEqual({ id: "o1", name: "O", type: "omt" })
        fireEvent.click(screen.getByText("Blackmagic"))
        elegir("BMDStreams")
        expect(get(popupData).value).toEqual({ id: "b1", name: "B", type: "blackmagic" })
    })
})

// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../shared/core/ipc/main"
import { openSettings } from "../settings/logic/openSettings"
import { activePopup, currentOutputSettings, dictionary, outputs } from "../../shared/core/stores"
import { send } from "../../shared/utils/request"
import { clearIslands, islands } from "../../shared/test/islandMock"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { OutputSelector } from "./OutputSelector"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/core/ipc/main", () => ({ requestMain: vi.fn() }))
vi.mock("../../shared/utils/request", () => ({ send: vi.fn() }))
vi.mock("../settings/logic/openSettings", () => ({ openSettings: vi.fn() }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../output/PreviewOutput", async () => ({ PreviewOutput: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("PreviewOutput") }))

const displays = [
    { id: "display-1", label: "Principal", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, internal: true },
    { id: "display-2", label: "Externo", bounds: { x: 1920, y: 0, width: 1280, height: 720 }, internal: false }
]
let restaurar: () => void = () => {}
function montar(outputsData: object = {}) {
    restaurar = setStoresForTest([looseEntry(outputs, outputsData), storeEntry(currentOutputSettings, null), storeEntry(activePopup, "output_selector"), storeEntry(dictionary, { remote: { loading: "Cargando…" }, settings: { identify_screens: "Identificar pantallas" }, main: { open: "Abrir" } })] as never)
    return render(<OutputSelector />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    vi.mocked(requestMain).mockResolvedValue(displays as never)
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("OutputSelector", () => {
    it("muestra_cargando_y_luego_las_pantallas_ordenadas_interna_primero", async () => {
        montar()
        expect(screen.getByText("Cargando…")).toBeTruthy()
        await act(async () => {})
        expect(screen.queryByText("Cargando…")).toBeNull()
        expect(requestMain).toHaveBeenCalledWith(Main.GET_DISPLAYS)
        const screenLabels = [...document.querySelectorAll("div")].map((d) => d.textContent).filter((t) => t === "1" || t === "2")
        expect(screenLabels).toEqual(["1", "2"])
    })

    it("identificar_envía_las_pantallas_obtenidas_por_OUTPUT", async () => {
        montar()
        await act(async () => {})
        const btn = document.querySelector("button") as HTMLElement
        expect(btn.getAttribute("title")).toBe("settings.identify_screens")
        act(() => {
            btn.click()
        })
        expect(send).toHaveBeenCalledWith(OUTPUT, ["IDENTIFY_SCREENS"], expect.arrayContaining([expect.objectContaining({ id: "display-1" })]))
    })

    it("elegir_una_salida_abre_la_configuración_y_cierra_el_popup", async () => {
        montar({ out1: { id: "out1", enabled: true, active: true, name: "Salida 1", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, screen: "display-1" } })
        await act(async () => {})
        expect(islands.PreviewOutput).toBeTruthy()
        const target = document.querySelector('[role="button"]') as HTMLElement
        expect(target.getAttribute("data-title")).toBe("main.open: <b>Salida 1</b>")
        act(() => {
            target.click()
        })
        expect(get(currentOutputSettings)).toBe("out1")
        expect(openSettings).toHaveBeenCalledWith("display_settings")
        expect(get(activePopup)).toBeNull()
    })

    it("una_salida_deshabilitada_no_muestra_la_vista_previa", async () => {
        montar({ out2: { id: "out2", enabled: false, active: false, name: "Apagada", bounds: { x: 0, y: 0, width: 800, height: 600 }, screen: null } })
        await act(async () => {})
        expect(islands.PreviewOutput).toBeUndefined()
        expect(document.body.textContent).toContain("Apagada")
    })
})

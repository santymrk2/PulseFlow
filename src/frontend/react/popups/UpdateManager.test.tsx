// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../IPC/main"
import { alertUpdates, dictionary, special, version } from "../../stores"
import { getUpdateData } from "../../utils/checkForUpdates"
import { setPopupSubmit } from "../../utils/popup"
import { clearFields, fields, fire } from "../test/kitMocks"
import { clearIslands } from "../test/islandMock"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { UpdateManager } from "./UpdateManager"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: (value: string) => value }))
vi.mock("../../utils/checkForUpdates", () => ({ getUpdateData: vi.fn() }))
vi.mock("../../utils/popup", () => ({ setPopupSubmit: vi.fn(() => () => {}) }))
vi.mock("../../IPC/main", () => ({ sendMain: vi.fn() }))
vi.mock("../main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Loader") }))
vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const UPDATE = { latestVersion: "2.0.0", changelog: "- nuevo\r\n- arreglos", hasUpdate: true }
let restaurar: () => void = () => {}
function montar(versionValue = "1.0.0", specialValue: object = {}, alerts = false) {
    restaurar = setStoresForTest([storeEntry(version, versionValue), looseEntry(special, specialValue), storeEntry(alertUpdates, alerts), looseEntry(dictionary, { about: { download_latest: "Descargar", changes: "Cambios" }, settings: { alert_updates_beta: "Avisos beta", alert_updates: "Avisos", auto_updates: "Auto" } })] as never)
    return render(<UpdateManager />)
}
const submit = () => vi.mocked(setPopupSubmit).mock.calls[0][0]

beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    clearIslands()
    vi.mocked(getUpdateData).mockResolvedValue(UPDATE)
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("UpdateManager", () => {
    it("al montar consulta con la versión actual y sin beta, y muestra el Loader isla", () => {
        const { container } = montar()
        expect(getUpdateData).toHaveBeenCalledWith("1.0.0", false)
        expect(container.querySelector("[data-isla='Loader']")).toBeTruthy()
    })

    it("muestra el changelog con saltos y viñetas y el botón de descarga", async () => {
        const { container } = montar()
        await waitFor(() => expect(screen.getByText("Descargar")).toBeTruthy())
        expect(container.querySelector("[data-isla='Loader']")).toBeNull()
        expect(container.innerHTML).toContain("• nuevo<br>• arreglos")
        expect(screen.getByText("v1.0.0")).toBeTruthy()
        expect(screen.getByText("v2.0.0")).toBeTruthy()
    })

    it("una versión beta pide también las betas y deshabilita el aviso beta", async () => {
        montar("1.0.0-beta", { betaVersionAlert: true })
        expect(getUpdateData).toHaveBeenCalledWith("1.0.0-beta", true)
        await waitFor(() => expect(fields["settings.alert_updates_beta"].disabled).toBe(true))
        expect(fields["settings.alert_updates_beta"].checked).toBe(false)
    })

    it("descargar abre la URL de releases y el submit registrado hace lo mismo", async () => {
        montar()
        await waitFor(() => expect(screen.getByText("Descargar")).toBeTruthy())
        fireEventClick(screen.getByText("Descargar"))
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://github.com/santymrk2/PulseFlow/releases")
        vi.mocked(sendMain).mockClear()
        act(() => submit()())
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://github.com/santymrk2/PulseFlow/releases")
    })

    it("sin actualización muestra la versión con el check y no ofrece descargar", async () => {
        vi.mocked(getUpdateData).mockResolvedValue({ ...UPDATE, hasUpdate: false, changelog: "" })
        const { container } = montar()
        await waitFor(() => expect(screen.queryByText("Descargar")).toBeNull())
        expect(container.textContent).toContain("✓")
        expect(container.querySelector("[data-isla='Loader']")).toBeNull()
    })

    it("si falla la consulta muestra el error y el Loader desaparece", async () => {
        vi.mocked(getUpdateData).mockRejectedValue(new Error("sin red"))
        const { container } = montar()
        await waitFor(() => expect(screen.getByText(/Error: Could not check/)).toBeTruthy())
        expect(container.querySelector("[data-isla='Loader']")).toBeNull()
    })

    it("los toggles escriben alertUpdates y special", async () => {
        montar("1.0.0", {})
        await waitFor(() => expect(fields["settings.alert_updates"]).toBeDefined())
        fire("settings.alert_updates", "onChange", true)
        expect(get(alertUpdates)).toBe(true)
        fire("settings.auto_updates", "onChange", true)
        expect(get(special)).toEqual({ autoUpdates: true })
    })

    it("el submit se da de baja al desmontar", async () => {
        const cleanupSubmit = vi.fn()
        vi.mocked(setPopupSubmit).mockReturnValue(cleanupSubmit)
        const { unmount } = montar()
        await waitFor(() => expect(setPopupSubmit).toHaveBeenCalled())
        unmount()
        expect(cleanupSubmit).toHaveBeenCalled()
    })
})

function fireEventClick(element: HTMLElement) {
    act(() => element.closest("button")?.click())
}

// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { obsData } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { OBSInfo } from "./OBSInfo"

const obs = vi.hoisted(() => ({
    call: vi.fn(),
    onStateChange: vi.fn(),
    listen: vi.fn()
}))
vi.mock("../../../utils/obsTalk", () => ({ connectToOBS: () => Promise.resolve(obs) }))
vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: () => {}, wait: () => Promise.resolve() }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(obsData, { connected: true })])
})
afterEach(() => {
    cleanup()
    restaurar()
})

async function montar() {
    const resultado = render(<OBSInfo />)
    await act(async () => {
        await Promise.resolve()
    })
    return resultado
}

describe("OBSInfo", () => {
    it("conecta con OBS y muestra el panel cuando cambia el estado a conectado", async () => {
        await montar()
        expect(obs.onStateChange).toHaveBeenCalled()
        expect(obs.listen).toHaveBeenCalled()

        await act(async () => {
            obs.onStateChange.mock.calls[0][0](true)
        })
        expect(screen.getByText("No Preview Available")).toBeTruthy()
        expect(screen.getByText("0.0%")).toBeTruthy()
        expect(screen.getByText("0 FPS")).toBeTruthy()
    })

    it("actualiza métricas, escena y vista previa desde los eventos de OBS", async () => {
        await montar()
        const listen = obs.listen.mock.calls[0][0]

        await act(async () => {
            obs.onStateChange.mock.calls[0][0](true)
            listen({ op: 7, d: { requestType: "GetSceneList", responseData: { currentProgramSceneName: "Escena 1" } } })
            listen({ op: 7, d: { requestType: "GetStats", responseData: { cpuUsage: 20, activeFps: 60 } } })
            listen({ op: 7, d: { requestType: "GetSourceScreenshot", responseData: { imageData: "data:image/jpeg;base64,abc" }, requestStatus: { result: true } } })
        })

        expect(obs.call).toHaveBeenCalledWith("GetSourceScreenshot", expect.objectContaining({ sourceName: "Escena 1" }))
        expect(screen.getByText("20.0%")).toBeTruthy()
        expect(screen.getByText("60 FPS")).toBeTruthy()
        expect((document.querySelector("#preview-img") as HTMLImageElement).src).toContain("data:image/jpeg")
    })

    it("muestra la duración y los bytes cuando el stream está activo", async () => {
        await montar()
        const listen = obs.listen.mock.calls[0][0]
        await act(async () => {
            obs.onStateChange.mock.calls[0][0](true)
            listen({ op: 7, d: { requestType: "GetStreamStatus", responseData: { outputActive: true, outputTimecode: "00:01:20", outputBytes: 1048576 } } })
        })
        expect(screen.getByText("00:01:20")).toBeTruthy()
        expect(screen.getByText("1.0 MB")).toBeTruthy()
    })
})

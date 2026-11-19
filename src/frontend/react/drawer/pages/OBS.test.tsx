// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dictionary, obsData } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { OBS } from "./OBS"

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../app/wiring/obsTalk", () => ({ connectToOBS: connectMock }))

type Message = { op: number; d?: Record<string, unknown> }
type StateCallback = (connected: boolean, error?: string) => void

const dict = {
    main: { docs: "Documentación" },
    settings: { connect_to: "Conectar a $1" }
}

// Doble de OBSWebSocket: guarda el listener de estado y los de mensajes para que el test dispare respuestas y eventos.
function fakeConnection(initiallyConnected = false) {
    const listeners: ((msg: Message) => void)[] = []
    const call = vi.fn()
    const send = vi.fn()
    let stateCallback: StateCallback | undefined
    const connection = {
        isConnected: initiallyConnected,
        call,
        send,
        onStateChange: (callback: StateCallback) => {
            stateCallback = callback
        },
        listen: (callback: (msg: Message) => void) => {
            listeners.push(callback)
        }
    }

    return {
        connection,
        call,
        send,
        connected: (value: boolean, error?: string) => act(() => stateCallback?.(value, error)),
        message: (msg: Message) => act(() => listeners.forEach((listener) => listener(msg)))
    }
}

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(obsData, { connected: false, ip: "", port: 4455, password: "" })])
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

const buttonByTitle = (title: string) => document.querySelector(`button[data-title="${title}"]`) as HTMLButtonElement | null

const renderConnected = async (connection: ReturnType<typeof fakeConnection>["connection"]) => {
    connectMock.mockResolvedValue(connection)
    await act(async () => {
        render(<OBS />)
    })
}

describe("OBS", () => {
    it("desconectado muestra la documentación y el botón de conexión", () => {
        render(<OBS />)
        expect(screen.getByText("Documentación")).toBeTruthy()
        expect(screen.getByText("Conectar a OBS Studio")).toBeTruthy()
    })

    it("al conectar pide escenas, estado del stream y de la grabación", async () => {
        const obs = fakeConnection()
        connectMock.mockResolvedValue(obs.connection)
        render(<OBS />)
        await act(async () => {
            fireEvent.click(screen.getByText("Conectar a OBS Studio"))
        })
        obs.connected(true)
        expect(obs.call).toHaveBeenCalledWith("GetSceneList")
        expect(obs.call).toHaveBeenCalledWith("GetStreamStatus")
        expect(obs.call).toHaveBeenCalledWith("GetRecordStatus")
        expect(screen.getByText("Scenes")).toBeTruthy()
        expect(screen.getByText("Start Streaming")).toBeTruthy()
    })

    it("al reconectar al montar usa la conexión previa", async () => {
        act(() => obsData.set({ connected: true, ip: "", port: 4455, password: "" }))
        const obs = fakeConnection(true)
        await renderConnected(obs.connection)
        expect(connectMock).toHaveBeenCalledTimes(1)
        expect(screen.getByText("Audio Mixer")).toBeTruthy()
    })

    it("muestra el error de conexión", async () => {
        const obs = fakeConnection()
        connectMock.mockResolvedValue(obs.connection)
        render(<OBS />)
        await act(async () => {
            fireEvent.click(screen.getByText("Conectar a OBS Studio"))
        })
        obs.connected(false, "Authentication failed")
        expect(screen.getByText("Authentication failed")).toBeTruthy()
    })

    it("ordena las escenas por índice y marca la activa", async () => {
        act(() => obsData.set({ connected: true, ip: "", port: 4455, password: "" }))
        const obs = fakeConnection(true)
        await renderConnected(obs.connection)
        obs.message({
            op: 7,
            d: {
                requestType: "GetSceneList",
                responseData: {
                    currentProgramSceneName: "Escena B",
                    scenes: [
                        { sceneName: "Escena A", sceneIndex: 0 },
                        { sceneName: "Escena B", sceneIndex: 2 },
                        { sceneName: "Escena C", sceneIndex: 1 }
                    ]
                }
            }
        })
        const escenas = screen.getAllByRole("button").filter((button) => button.textContent?.startsWith("Escena"))
        expect(escenas.map((button) => button.textContent)).toEqual(["Escena B", "Escena C", "Escena A"])
        expect(escenas[0].id).toBe("active-scene-btn")
        expect(escenas[0].className).toContain("active-scene")

        fireEvent.click(escenas[2])
        expect(obs.call).toHaveBeenCalledWith("SetCurrentProgramScene", { sceneName: "Escena A" })
    })

    it("el evento de cambio de escena actualiza la escena activa", async () => {
        act(() => obsData.set({ connected: true, ip: "", port: 4455, password: "" }))
        const obs = fakeConnection(true)
        await renderConnected(obs.connection)
        obs.message({
            op: 7,
            d: {
                requestType: "GetSceneList",
                responseData: {
                    currentProgramSceneName: "Escena A",
                    scenes: [
                        { sceneName: "Escena A", sceneIndex: 0 },
                        { sceneName: "Escena B", sceneIndex: 1 }
                    ]
                }
            }
        })
        obs.message({ op: 5, d: { eventType: "CurrentProgramSceneChanged", eventData: { sceneName: "Escena B" } } })
        expect(screen.getByText("Escena B").id).toBe("active-scene-btn")
        expect(screen.getByText("Escena A").id).toBe("")
    })

    it("muestra las fuentes y las oculta/muestra al hacer click", async () => {
        act(() => obsData.set({ connected: true, ip: "", port: 4455, password: "" }))
        const obs = fakeConnection(true)
        await renderConnected(obs.connection)
        obs.message({
            op: 7,
            d: {
                requestType: "GetSceneList",
                responseData: { currentProgramSceneName: "Escena A", scenes: [{ sceneName: "Escena A", sceneIndex: 0 }] }
            }
        })
        obs.message({
            op: 7,
            d: {
                requestType: "GetSceneItemList",
                responseData: { sceneItems: [{ sceneItemId: 4, sceneItemIndex: 1, sceneItemEnabled: true, sourceName: "Cámara" }] }
            }
        })

        // Sin showAll las fuentes están ocultas
        expect(screen.queryByText("Cámara")).toBeNull()
        fireEvent.click(buttonByTitle("create_show.more_options") as HTMLButtonElement)
        expect(screen.getByText("Cámara")).toBeTruthy()

        fireEvent.click(buttonByTitle("Hide Layer") as HTMLButtonElement)
        expect(obs.call).toHaveBeenCalledWith("SetSceneItemEnabled", { sceneName: "Escena A", sceneItemId: 4, sceneItemEnabled: false })
        expect(buttonByTitle("Show Layer")).toBeTruthy()
    })

    it("filtra entradas sin audio y permite silenciar", async () => {
        act(() => obsData.set({ connected: true, ip: "", port: 4455, password: "" }))
        const obs = fakeConnection(true)
        await renderConnected(obs.connection)
        obs.message({
            op: 7,
            d: {
                requestType: "GetInputList",
                responseData: {
                    inputs: [
                        { inputName: "Mic", inputKind: "wasapi_input_capture", inputMuted: false },
                        { inputName: "Imagen", inputKind: "image_source" }
                    ]
                }
            }
        })
        expect(screen.getByText("No Audio")).toBeTruthy()
        expect(obs.send).toHaveBeenCalledWith({ op: 6, d: { requestType: "GetInputMute", requestId: "mute_Mic", requestData: { inputName: "Mic" } } })

        obs.message({ op: 7, d: { requestType: "GetInputMute", requestId: "mute_Mic", requestStatus: { result: true }, responseData: { inputMuted: false } } })
        expect(screen.queryByText("No Audio")).toBeNull()
        expect(screen.getByText("Mic")).toBeTruthy()
        expect(screen.queryByText("Imagen")).toBeNull()

        fireEvent.click(buttonByTitle("Mute") as HTMLButtonElement)
        expect(obs.call).toHaveBeenCalledWith("ToggleInputMute", { inputName: "Mic" })
        expect(buttonByTitle("Unmute")).toBeTruthy()
    })

    it("dibuja el medidor de volumen con el mapeo de OBS", async () => {
        act(() => obsData.set({ connected: true, ip: "", port: 4455, password: "" }))
        const obs = fakeConnection(true)
        await renderConnected(obs.connection)
        obs.message({
            op: 7,
            d: { requestType: "GetInputList", responseData: { inputs: [{ inputName: "Mic", inputKind: "wasapi_input_capture", inputMuted: false }] } }
        })
        obs.message({ op: 7, d: { requestType: "GetInputMute", requestId: "mute_Mic", requestStatus: { result: true }, responseData: { inputMuted: false } } })
        obs.message({ op: 5, d: { eventType: "InputVolumeMeters", eventData: { inputs: [{ inputName: "Mic", inputLevelsMul: [[0.001, 0.5]] }] } } })

        const medidor = screen.getByTitle("Signal Active").nextElementSibling?.firstElementChild as HTMLElement
        expect(parseFloat(medidor.style.width)).toBeGreaterThan(90)
        expect(medidor.style.background).toBe("#ef4444")

        obs.message({ op: 5, d: { eventType: "InputVolumeMeters", eventData: { inputs: [{ inputName: "Mic", inputLevelsMul: [[0, 0]] }] } } })
        expect(screen.getByTitle("No Signal")).toBeTruthy()
    })

    it("reinicia el medidor si el evento no trae niveles", async () => {
        act(() => obsData.set({ connected: true, ip: "", port: 4455, password: "" }))
        const obs = fakeConnection(true)
        await renderConnected(obs.connection)
        obs.message({
            op: 7,
            d: { requestType: "GetInputList", responseData: { inputs: [{ inputName: "Mic", inputKind: "wasapi_input_capture", inputMuted: false }] } }
        })
        obs.message({ op: 7, d: { requestType: "GetInputMute", requestId: "mute_Mic", requestStatus: { result: true }, responseData: { inputMuted: false } } })
        obs.message({ op: 5, d: { eventType: "InputVolumeMeters", eventData: { inputs: [{ inputName: "Mic", inputLevelsMul: [[0.001, 0.5]] }] } } })
        expect(screen.getByTitle("Signal Active")).toBeTruthy()
        obs.message({ op: 5, d: { eventType: "InputVolumeMeters", eventData: { inputs: [{ inputName: "Mic" }] } } })
        expect(screen.queryByTitle("Signal Active")).toBeNull()
        expect(screen.queryByTitle("No Signal")).toBeNull()
    })

    it("cambia de transición y muestra el estado de stream y grabación", async () => {
        act(() => obsData.set({ connected: true, ip: "", port: 4455, password: "" }))
        const obs = fakeConnection(true)
        await renderConnected(obs.connection)
        obs.message({
            op: 7,
            d: { requestType: "GetSceneTransitionList", responseData: { transitions: [{ transitionName: "Corte" }, { transitionName: "Fundido" }], currentSceneTransitionName: "Corte" } }
        })
        fireEvent.click(buttonByTitle("create_show.more_options") as HTMLButtonElement)
        expect(screen.getByText("Scene Transitions")).toBeTruthy()
        expect(screen.getByText("Corte").id).toBe("active-transition-btn")

        fireEvent.click(screen.getByText("Fundido"))
        expect(obs.call).toHaveBeenCalledWith("SetCurrentSceneTransition", { transitionName: "Fundido" })
        expect(screen.getByText("Fundido").id).toBe("active-transition-btn")

        obs.message({ op: 7, d: { requestType: "GetStreamStatus", responseData: { outputActive: true } } })
        obs.message({ op: 7, d: { requestType: "GetRecordStatus", responseData: { outputActive: true } } })
        expect(screen.getByText("Stop Streaming")).toBeTruthy()
        expect(screen.getByText("Stop Recording")).toBeTruthy()

        fireEvent.click(screen.getByText("Stop Streaming"))
        expect(obs.call).toHaveBeenCalledWith("ToggleStream")
        fireEvent.click(screen.getByText("Stop Recording"))
        expect(obs.call).toHaveBeenCalledWith("ToggleRecord")
    })
})

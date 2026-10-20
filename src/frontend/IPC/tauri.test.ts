// Tests del puente Tauri (F7.2): respuesta inmediata para canales pospuestos.
//
// El entorno de vitest es "node", así que se simula `window.__TAURI_INTERNALS__`
// antes de importar el módulo (el flag `isTauri` se calcula en load time) y se
// mockean los paquetes de Tauri y las utilidades de UI.

import { beforeEach, describe, expect, it, vi } from "vitest"

const invokeMock = vi.fn(() => Promise.resolve("RUST_RESULT"))
const listenMock = vi.fn(() => Promise.resolve(() => {}))

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }))
vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }))
vi.mock("../utils/common", () => ({ newToast: vi.fn(), setStatus: vi.fn() }))

// window debe existir ANTES de importar tauri.ts (isTauri se evalúa en load time).
;(globalThis as any).window = {
    __TAURI_INTERNALS__: { invoke: invokeMock },
    addEventListener: () => {},
    removeEventListener: () => {}
}

const { Main, MAIN } = await import("../../types/IPC/Main")
const { setupTauriApi, invokeCommand } = await import("./tauri")
setupTauriApi()
const api = (window as any).api

// Los warnings de DEV se reenvían al backend con `invoke("LOG", ...)`; para
// assertar "no se invocó el comando" hay que ignorar ese forward.
const commandCalls = () => invokeMock.mock.calls.filter((call) => call[0] !== "LOG")

beforeEach(async () => {
    invokeMock.mockClear()
    const common = await import("../utils/common")
    vi.mocked(common.newToast).mockClear()
    vi.mocked(common.setStatus).mockClear()
    setupTauriApi()
})

describe("send (F7.2)", () => {
    it("responde undefined al instante a un canal pospuesto, sin invocar", async () => {
        const received: any[] = []
        const listenerId = "posp1"
        api.receive(MAIN, (msg: any, id: string) => received.push({ msg, id }), listenerId)

        api.send(MAIN, { channel: Main.NOW_PLAYING, data: { test: true } }, listenerId)
        await vi.waitFor(() => expect(received.length).toBe(1))

        expect(received[0].msg).toEqual({ channel: Main.NOW_PLAYING, data: undefined })
        expect(received[0].id).toBe(listenerId)
        expect(commandCalls()).toEqual([])
    })

    it("sigue resolviendo el timeout corto de requestMain (undefined) sin error", async () => {
        // requestMain registraría su listener y esperaría; acá verificamos que el
        // dispatch inmediato llega con el id correcto y con data undefined.
        const received: any[] = []
        api.receive(MAIN, (msg: any) => received.push(msg), "id-2")
        api.send(MAIN, { channel: Main.GET_LYRICS, data: undefined }, "id-2")
        await vi.waitFor(() => expect(received.length).toBe(1))
        expect(received[0].data).toBeUndefined()
    })

    it("invoca al comando Rust para canales no pospuestos y despacha el resultado", async () => {
        const received: any[] = []
        api.receive(MAIN, (msg: any) => received.push(msg), "id-3")

        api.send(MAIN, { channel: Main.SAVE, data: { a: 1 } }, "id-3")
        await vi.waitFor(() => expect(received.length).toBe(1))

        expect(invokeMock).toHaveBeenCalledWith(Main.SAVE, { data: { a: 1 } })
        expect(received[0]).toEqual({ channel: Main.SAVE, data: "RUST_RESULT" })
    })

    it("descarta comandos del canal OUTPUT que no existen en Rust (F2.6)", async () => {
        api.send("OUTPUT", { channel: "DRAW", data: {} })
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(commandCalls()).toEqual([])
    })

    it("un canal pospuesto repetido responde a cada listener sin invocar", async () => {
        // `dispatch` llega a todos los receptores de MAIN; el filtrado por
        // listenedId lo hace el callback (como en requestMain).
        const forA: any[] = []
        const forB: any[] = []
        api.receive(MAIN, (msg: any, id: string) => id === "id-a" && forA.push(msg), "id-a")
        api.receive(MAIN, (msg: any, id: string) => id === "id-b" && forB.push(msg), "id-b")

        api.send(MAIN, { channel: Main.CAPTURE_SLIDE, data: undefined }, "id-a")
        api.send(MAIN, { channel: Main.CAPTURE_SLIDE, data: undefined }, "id-b")
        await vi.waitFor(() => expect(forA.length + forB.length).toBe(2))

        expect(commandCalls()).toEqual([])
        expect(forA[0].data).toBeUndefined()
        expect(forB[0].data).toBeUndefined()
    })
})

describe("invokeCommand (F7.3)", () => {
    it("devuelve { ok: true, value } cuando el comando resuelve", async () => {
        const result = await invokeCommand(Main.SAVE, { any: "data" })

        expect(result).toEqual({ ok: true, value: "RUST_RESULT" })
        expect(invokeMock).toHaveBeenCalledWith(Main.SAVE, { data: { any: "data" } })
    })

    it("devuelve { ok: false, error } sin lanzar cuando el comando falla", async () => {
        invokeMock.mockRejectedValueOnce("comando roto")

        const result = await invokeCommand("COMANDO_QUE_FALLA")

        expect(result).toEqual({ ok: false, error: "comando roto" })
    })

    it("muestra el toast de persistencia si falla un comando de guardado", async () => {
        const { newToast, setStatus } = await import("../utils/common")
        invokeMock.mockRejectedValueOnce("disco lleno")

        const result = await invokeCommand(Main.SAVE)

        expect(result.ok).toBe(false)
        expect(setStatus).toHaveBeenCalledWith("error", 10)
        expect(newToast).toHaveBeenCalledWith("toast.save_error")
    })

    it("no muestra toast de persistencia para comandos no críticos", async () => {
        const { newToast } = await import("../utils/common")
        invokeMock.mockRejectedValueOnce("fallo cualquiera")

        await invokeCommand("UN_COMANDO_CUALQUIERA")

        expect(newToast).not.toHaveBeenCalledWith("toast.save_error")
    })
})

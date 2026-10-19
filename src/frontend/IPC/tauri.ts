// ----- FreeShow -----
// Puente de comunicación del frontend con el backend Tauri.
//
// Reemplaza al `window.api` que exponía `src/electron/preload.ts` mediante
// `contextBridge`. Mantiene la misma interfaz (`send`, `receive`, `removeListener`,
// `getListeners`, `showFilePath`) para no tener que reescribir las llamadas
// existentes, pero internamente:
//
//   - `send`    → `invoke(data.channel, { data: data.data })` (Bloque 2)
//   - `receive` → `listen(channel, ...)` (Bloque 3)
//
// El contrato de Electron era: `send("MAIN", { channel: "SAVE", data })`; aquí el
// canal externo (`MAIN`, `OUTPUT`, ...) se usa para enrutar la respuesta a los
// receptores registrados, y el canal interno (`SAVE`, ...) es el comando Tauri.

import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { OUTPUT } from "../../types/Channels"

type Receiver = (args: any, listenedId?: string) => void

interface StoredReceiver {
    id?: string
    func: Receiver
}

const receivers: { [channel: string]: StoredReceiver[] } = {}
const unlisteners: { [channel: string]: UnlistenFn } = {}
const listenerPromises: { [channel: string]: Promise<void> } = {}

// Lista blanca de comandos del canal `OUTPUT` que existen en Rust (F2.6).
//
// El canal `OUTPUT` de Svelte se usaba, en la versión Electron, para hablar con
// la ventana de salida que alojaba el HTML de la webview: ahí se consumían
// señales como `CREATE`, `DRAW`, `SHOWS`, `CAPTURE`, `SET_VALUE`… En PulseFlow
// esa ventana ya no existe (la salida es una ventana nativa WGPU) y el frontend
// sólo necesita unos pocos comandos, que sí están registrados en
// `src-tauri/src/lib.rs` (módulo `commands::output`).
//
// Cualquier otro comando del canal `OUTPUT` se descarta antes de `invoke` para
// no llenar la consola de errores "Command … not found" (p. ej. al cambiar de
// slide, que dispara muchas señales heredadas). En desarrollo se avisa una sola
// vez por nombre.
const OUTPUT_COMMANDS = new Set(["TOGGLE_OUTPUTS", "RENDER_SCENE", "UPDATE_BOUNDS", "IDENTIFY_SCREENS"])

// Comandos ya avisados en desarrollo, para no repetir el warning en cada envío.
const warnedOutputCommands = new Set<string>()

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

function dispatch(channel: string, payload: any, listenedId?: string) {
    const list = receivers[channel]
    if (!list) return
    list.forEach((receiver) => receiver.func(payload, listenedId))
}

function ensureListener(channel: string): Promise<void> {
    if (!isTauri || unlisteners[channel]) return Promise.resolve()
    if (listenerPromises[channel]) return listenerPromises[channel]

    listenerPromises[channel] = listen(channel, (event) => dispatch(channel, event.payload))
        .then((unlisten) => {
            unlisteners[channel] = unlisten
        })
        .catch((error) => {
            console.warn(`[tauri] listen("${channel}") failed:`, error)
            delete listenerPromises[channel]
        })

    return listenerPromises[channel]
}

async function send(channel: string, data?: any, id?: string) {
    let command = channel
    let payload = data

    // contrato { channel, data } → comando + payload
    if (data && typeof data === "object" && "channel" in data) {
        command = data.channel
        payload = data.data
    }

    // Canal `OUTPUT`: sólo se invocan los comandos que existen en Rust; el resto
    // son señales heredadas de la ventana webview de Electron (F2.6).
    if (channel === OUTPUT && !OUTPUT_COMMANDS.has(command)) {
        if (!warnedOutputCommands.has(command)) {
            warnedOutputCommands.add(command)
            if (import.meta.env.DEV) console.warn(`[tauri] canal OUTPUT: comando "${command}" descartado (no existe en el engine nativo)`)
        }
        return
    }

    if (!isTauri) {
        console.warn(`[tauri] invoke("${command}") skipped: not running inside Tauri`)
        return
    }

    // Asegura que los `listen()` registrados hasta ahora estén activos antes de
    // invocar. Sin esto, un `receive()` seguido de un `send()` inmediato (p. ej.
    // el handshake STARTUP/READY) puede perder el evento de respuesta.
    await Promise.all(Object.values(listenerPromises))

    invoke(command, { data: payload })
        .then((result) => dispatch(channel, { channel: command, data: result }, id))
        .catch((error) => {
            // Muchos canales (servidores, salidas, etc.) aún no tienen comando en el
            // backend; se registran como advertencia en lugar de colapsar.
            console.warn(`[tauri] invoke("${command}") failed:`, error)
        })
}

function receive(channel: string, func: Receiver, id?: string) {
    if (!receivers[channel]) receivers[channel] = []

    // reemplaza un receptor previo con el mismo id (como el preload de Electron)
    if (id) {
        const existing = receivers[channel].findIndex((receiver) => receiver.id === id)
        if (existing > -1) receivers[channel].splice(existing, 1)
    }

    receivers[channel].push({ id, func })
    void ensureListener(channel)
}

function removeListener(channel: string, id: string) {
    const list = receivers[channel]
    if (!list) return

    const index = list.findIndex((receiver) => receiver.id === id)
    if (index > -1) list.splice(index, 1)
}

function getListeners(): [string, number][] {
    return Object.entries(receivers).map(([channel, list]) => [channel, list.length])
}

function showFilePath(file: File): string {
    // Tauri expone las rutas de archivos arrastrados vía eventos de drag & drop;
    // el objeto File del DOM no las incluye. Se mantiene el contrato devolviendo "".
    return (file as any)?.path || ""
}

// En desarrollo, reenvía `console.warn`/`console.error` del webview a la terminal
// de Tauri (comando `LOG`), para ver los errores del frontend sin el inspector.
function forwardConsoleToTerminal() {
    if (!isTauri || !import.meta.env.DEV) return

    const stringify = (value: any) => {
        if (value instanceof Error) return value.stack || value.message
        if (typeof value === "string") return value
        try {
            return JSON.stringify(value)
        } catch {
            return String(value)
        }
    }

    ;(["warn", "error"] as const).forEach((level) => {
        const original = console[level].bind(console)
        console[level] = (...args: any[]) => {
            original(...args)
            invoke("LOG", { data: `${level.toUpperCase()}: ${args.map(stringify).join(" ")}` }).catch(() => {})
        }
    })

    window.addEventListener("error", (e) => console.error(e.error || e.message))
    window.addEventListener("unhandledrejection", (e) => console.error("Unhandled rejection:", e.reason))
}

export function setupTauriApi() {
    window.api = { send, receive, removeListener, getListeners, showFilePath }
    forwardConsoleToTerminal()
}

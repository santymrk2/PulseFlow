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

type Receiver = (args: any, listenedId?: string) => void

interface StoredReceiver {
    id?: string
    func: Receiver
}

const receivers: { [channel: string]: StoredReceiver[] } = {}
const unlisteners: { [channel: string]: UnlistenFn } = {}
const listenerPromises: { [channel: string]: Promise<void> } = {}

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

export function setupTauriApi() {
    window.api = { send, receive, removeListener, getListeners, showFilePath }
}

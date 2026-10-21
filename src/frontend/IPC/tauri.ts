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
import { Main } from "../../types/IPC/Main"
import { newToast, setStatus } from "../utils/common"

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
// vez por nombre (ver `ipcDebugWarn`, F10.0f).
const OUTPUT_COMMANDS = new Set(["TOGGLE_OUTPUTS", "RENDER_SCENE", "UPDATE_BOUNDS", "IDENTIFY_SCREENS", "REMOVE_SCREEN", "RENDER_PREFETCH"])

// Canales de servidor (F10.0f): en Electron estos mensajes iban por websocket a
// las apps web de control remoto/stage/controller/output-stream (el puente
// `io.emit(id, msg)` de `src/electron/servers.ts`). En PulseFlow se reenvían al
// servidor interno con el comando `SERVER_SEND`, que difunde el mensaje JSON a
// la sala correspondiente. Nunca se invocan como comando
// (`invoke("SCRIPTURE")` no existe y producía "Command not found" en cada
// actualización).
const SERVER_ROOMS: { [channel: string]: string } = {
    REMOTE: "remote",
    STAGE: "stage",
    CONTROLLER: "controller",
    OUTPUT_STREAM: "output_stream"
}

// Resultado de un `invoke` directo al backend (F7.3). `ok: false` significa que
// el comando falló en Rust o que no había backend Tauri; el frontend decide qué
// mostrar. Se evita el `throw` para que ningún call site crítico quede sin
// capturar (guardar, abrir salidas, renderizar escena).
export type InvokeResult<T> = { ok: true; value: T } | { ok: false; error: string }

// Invoca un comando Rust y devuelve el resultado o el error, sin lanzar.
//
// A diferencia de `window.api.send` (fire & forget, errores sólo en consola),
// esta función devuelve el error al call site. Se usa sólo para las operaciones
// críticas marcadas en el roadmap de F7: guardar (`SAVE`), abrir/cerrar salidas
// (`TOGGLE_OUTPUTS`) y renderizar escena (`RENDER_SCENE`).
export async function invokeCommand<T = void>(command: string, data?: any): Promise<InvokeResult<T>> {
    if (!isTauri) return { ok: false, error: "not running inside Tauri" }

    try {
        const value = (await invoke(command, { data })) as T
        return { ok: true, value }
    } catch (error) {
        const message = typeof error === "string" ? error : JSON.stringify(error)
        console.warn(`[tauri] invoke("${command}") failed:`, error)

        // Comandos de persistencia (F3.1): si fallan, los cambios del usuario no
        // quedaron guardados → toast + estado de error, igual que en `send`.
        if (PERSISTENCE_COMMANDS.has(command)) {
            setStatus("error", 10)
            newToast("toast.save_error")
        }

        return { ok: false, error: message }
    }
}

// Comandos que escriben datos en disco (F3.1). Si fallan, los cambios del
// usuario no quedaron guardados: además del warning se muestra un toast y el
// indicador de estado pasa a "error" (deja el "saving" para poder reintentar).
const PERSISTENCE_COMMANDS = new Set(["SAVE", "SET_STORE_VALUE", "SET_MEDIA_FOLDER_PATH", "UPDATE_DATA_PATH"])

// Canales marcados *posponer* en el inventario de F7.1 (`PLAN.md`): no tienen
// comando Rust y no están previstos a corto plazo (Now Playing, providers de
// contenido, Spotify, lyrics, PPT externo, …). Para no castigar al frontend con
// la espera de `requestMain` (15 s), `send` responde `undefined` al instante al
// listener que hizo la petición. En desarrollo se avisa una sola vez por canal.
const POSTPONED_COMMANDS = new Set<Main>([
    Main.DEVICE_ID,
    Main.GET_DEVICE_NAME,
    Main.CHECK_RAM_USAGE,
    Main.ACCESS_CAMERA_PERMISSION,
    Main.ACCESS_MICROPHONE_PERMISSION,
    Main.ACCESS_SCREEN_PERMISSION,
    Main.GET_GRAPHICS_DEVICES,
    Main.NOW_PLAYING,
    Main.NOW_PLAYING_UNSET,
    Main.OPEN_NOW_PLAYING,
    Main.LOG_ERROR,
    Main.SPELLCHECK,
    Main.AUTO_UPDATE,
    Main.DOWNLOAD_LESSONS_MEDIA,
    Main.MEDIA_DOWNLOAD,
    Main.MEDIA_IS_DOWNLOADED,
    Main.MEDIA_FOLDER_COPY,
    Main.GET_SIMILAR,
    Main.CHECK_MEDIA_LICENSE,
    Main.CAPTURE_SLIDE,
    Main.PPT_TO_PDF,
    Main.SLIDESHOW_GET_APPS,
    Main.START_SLIDESHOW,
    Main.PRESENTATION_CONTROL,
    Main.SEND_MIDI,
    Main.RECEIVE_MIDI,
    Main.CLOSE_MIDI,
    Main.TIMECODE_AUDIO_DATA,
    Main.TIMECODE_STATUS,
    Main.GET_LYRICS,
    Main.SEARCH_LYRICS,
    Main.RECORDER,
    Main.API_TRIGGER,
    Main.EMIT_OSC,
    Main.CLOUD_SYNC,
    Main.RESTORE_CLOUD_BACKUP,
    Main.GET_CONVERSATION_ID,
    Main.SEND_SOCKET_MESSAGE,
    Main.PROVIDER_LOAD_SERVICES,
    Main.PROVIDER_CONNECTIONS,
    Main.PROVIDER_DISCONNECT,
    Main.PROVIDER_STARTUP_LOAD,
    Main.ONSTAGE_LOAD_SERVICE,
    Main.ONSTAGE_GET_TEAMS,
    Main.ONSTAGE_SWITCH_TEAM,
    Main.GET_CONTENT_PROVIDERS,
    Main.GET_CONTENT_LIBRARY,
    Main.GET_PROVIDER_CONTENT,
    Main.SPOTIFY_GET_STATE,
    Main.SPOTIFY_COMMAND,
    Main.FFMPEG_DOWNLOAD,
    Main.ENCODER_DETECT,
    Main.SET_RTMP_ENCODER
])

// Comandos ya avisados en depuración de IPC, para no repetir el warning.
const warnedIpcCommands = new Set<string>()

// Aviso de depuración de IPC (F10.0f): una sola vez por nombre y sólo si el
// usuario habilitó `localStorage.pulseflowIpcDebug = "1"`. Sin esa clave no se
// imprime nada (ni en desarrollo), así la terminal queda limpia al usar la app.
// Si la clave está activa, además se reenvía el warn a la terminal vía `LOG`
// (`forwardConsoleToLog`).
function ipcDebugWarn(label: string, name: string) {
    const key = `${label}:${name}`
    if (warnedIpcCommands.has(key)) return
    warnedIpcCommands.add(key)

    try {
        if (typeof localStorage === "undefined" || localStorage.getItem("pulseflowIpcDebug") !== "1") return
    } catch {
        return
    }

    console.warn(`[tauri] ${label}: "${name}"`)
}

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
        ipcDebugWarn("canal OUTPUT: comando descartado", command)
        return
    }

    if (!isTauri) {
        console.warn(`[tauri] invoke("${command}") skipped: not running inside Tauri`)
        return
    }

    // Canales de servidor (F10.0f): el mensaje completo (`{ id?, channel, data }`)
    // se difunde a la sala vía `SERVER_SEND`; el `id` (si existe) apunta a un
    // cliente concreto, como en el puente de Electron. No hay respuesta que
    // despachar, así que no hace falta esperar a los listeners.
    if (channel in SERVER_ROOMS) {
        invoke("SERVER_SEND", { data: { channel: SERVER_ROOMS[channel], message: data } }).catch((error) => {
            console.warn(`[tauri] SERVER_SEND(${channel}) failed:`, error)
        })
        return
    }

    // Asegura que los `listen()` registrados hasta ahora estén activos antes de
    // invocar. Sin esto, un `receive()` seguido de un `send()` inmediato (p. ej.
    // el handshake STARTUP/READY) puede perder el evento de respuesta.
    await Promise.all(Object.values(listenerPromises))

    // Canal pospuesto (F7.2): se responde `undefined` al instante, sin invocar y
    // sin esperar el timeout de `requestMain` (15 s). Va después del `await`
    // anterior porque `requestMain` registra su listener de forma síncrona
    // apenas retorna el control de este `send`.
    if (POSTPONED_COMMANDS.has(command as Main)) {
        ipcDebugWarn("canal pospuesto", command)
        dispatch(channel, { channel: command, data: undefined }, id)
        return
    }

    invoke(command, { data: payload })
        .then((result) => dispatch(channel, { channel: command, data: result }, id))
        .catch((error) => {
            // Muchos canales (servidores, salidas, etc.) aún no tienen comando en el
            // backend; se registran como advertencia en lugar de colapsar.
            console.warn(`[tauri] invoke("${command}") failed:`, error)

            if (PERSISTENCE_COMMANDS.has(command)) {
                setStatus("error", 10)
                newToast("toast.save_error")
            }
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

// Reenvía `console.warn`/`console.error` y los errores sin capturar del webview al registro de la app
// (comando `LOG`, F13.3): quedan en el archivo de `app_log_dir` con su nivel, también en release, y en
// desarrollo salen por la terminal de Tauri, así se ven sin abrir el inspector.
function forwardConsoleToLog() {
    if (!isTauri) return

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
    forwardConsoleToLog()
}

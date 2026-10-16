// ----- FreeShow -----
// Comandos de sistema: pantallas/salidas, ajustes, hardware (MIDI/NDI/Blackmagic),
// copias de seguridad y sincronización. Todos resueltos con `invoke` directo.

import { invoke } from "@tauri-apps/api/core"

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

// ---------------------------------------------------------------------------
// Pantallas y ventanas de salida
// ---------------------------------------------------------------------------

export interface Bounds {
    x: number
    y: number
    width: number
    height: number
}

export interface Display {
    id: number
    label: string
    bounds: Bounds
    workArea: Bounds
    size: { width: number; height: number }
    scaleFactor: number
}

export interface OutputWindowOptions {
    display?: number
    fullscreen?: boolean
}

export async function getDisplays(): Promise<Display[]> {
    if (!isTauri) return []
    return invoke<Display[]>("GET_DISPLAYS")
}

export async function openOutputWindow(options: OutputWindowOptions = {}): Promise<boolean> {
    if (!isTauri) return false
    return invoke<boolean>("OPEN_OUTPUT_WINDOW", { data: options })
}

export async function closeOutputWindow(): Promise<void> {
    if (!isTauri) return
    await invoke("CLOSE_OUTPUT_WINDOW")
}

export async function isOutputWindowOpen(): Promise<boolean> {
    if (!isTauri) return false
    return invoke<boolean>("IS_OUTPUT_WINDOW_OPEN")
}

export async function openStageWindow(options: OutputWindowOptions = {}): Promise<boolean> {
    if (!isTauri) return false
    return invoke<boolean>("OPEN_STAGE_WINDOW", { data: options })
}

export async function closeStageWindow(): Promise<void> {
    if (!isTauri) return
    await invoke("CLOSE_STAGE_WINDOW")
}

export async function isStageWindowOpen(): Promise<boolean> {
    if (!isTauri) return false
    return invoke<boolean>("IS_STAGE_WINDOW_OPEN")
}

// ---------------------------------------------------------------------------
// Tiendas (lectura/escritura de valores concretos)
// ---------------------------------------------------------------------------

export async function getStoreValue(file: string, key: string): Promise<unknown> {
    if (!isTauri) return null
    return invoke<unknown>("GET_STORE_VALUE", { data: { file, key } })
}

export async function setStoreValue(file: string, key: string, value: unknown): Promise<void> {
    if (!isTauri) return
    await invoke("SET_STORE_VALUE", { data: { file, key, value } })
}

// ---------------------------------------------------------------------------
// Hardware: MIDI
// ---------------------------------------------------------------------------

export interface MidiPort {
    name: string
}

export async function getMidiInputs(): Promise<MidiPort[]> {
    if (!isTauri) return []
    return invoke<MidiPort[]>("GET_MIDI_INPUTS")
}

export async function getMidiOutputs(): Promise<MidiPort[]> {
    if (!isTauri) return []
    return invoke<MidiPort[]>("GET_MIDI_OUTPUTS")
}

// ---------------------------------------------------------------------------
// Hardware: NDI
// ---------------------------------------------------------------------------

export interface NdiStatus {
    available: boolean
    library?: string
    message: string
}

export interface NdiSource {
    name: string
    url: string
}

export async function ndiStatus(): Promise<NdiStatus | null> {
    if (!isTauri) return null
    return invoke<NdiStatus>("NDI_STATUS")
}

export async function ndiSources(): Promise<NdiSource[]> {
    if (!isTauri) return []
    return invoke<NdiSource[]>("NDI_SOURCES")
}

// ---------------------------------------------------------------------------
// Hardware: Blackmagic (DeckLink)
// ---------------------------------------------------------------------------

export interface BlackmagicStatus {
    available: boolean
    library?: string
    message: string
}

export interface BlackmagicDevice {
    index: number
    name: string
}

export async function blackmagicStatus(): Promise<BlackmagicStatus | null> {
    if (!isTauri) return null
    return invoke<BlackmagicStatus>("BLACKMAGIC_STATUS")
}

export async function blackmagicDevices(): Promise<BlackmagicDevice[]> {
    if (!isTauri) return []
    return invoke<BlackmagicDevice[]>("BLACKMAGIC_DEVICES")
}

// ---------------------------------------------------------------------------
// Sincronización en la nube
// ---------------------------------------------------------------------------

export async function canSync(id?: string): Promise<boolean> {
    if (!isTauri) return false
    return invoke<boolean>("CAN_SYNC", { data: { id } })
}

export async function getTeams(id?: string): Promise<unknown[]> {
    if (!isTauri) return []
    return invoke<unknown[]>("GET_TEAMS", { data: { id } })
}

export async function cloudData(data: {
    id?: string
    church_id?: string
    team_id?: string
}): Promise<boolean> {
    if (!isTauri) return false
    return invoke<boolean>("CLOUD_DATA", { data })
}

// ---------------------------------------------------------------------------
// Copias de seguridad
// ---------------------------------------------------------------------------

export interface BackupInfo {
    path: string
    name: string
    date: number
    size: number
}

export async function listBackups(): Promise<BackupInfo[]> {
    if (!isTauri) return []
    return invoke<BackupInfo[]>("BACKUPS")
}

export async function restoreBackup(path?: string): Promise<void> {
    if (!isTauri) return
    await invoke("RESTORE", { data: { path } })
}

export async function deleteBackup(path: string): Promise<void> {
    if (!isTauri) return
    await invoke("DELETE_BACKUP", { data: { path } })
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export async function getVersion(): Promise<string> {
    if (!isTauri) return ""
    return invoke<string>("VERSION")
}

export interface OsInfo {
    platform: string
    name: string
    arch: string
}

export async function getOs(): Promise<OsInfo | null> {
    if (!isTauri) return null
    return invoke<OsInfo>("GET_OS")
}

// ---------------------------------------------------------------------------
// Servidores (REST/WebSocket) y streaming
// ---------------------------------------------------------------------------

export interface StartServersOptions {
    ports?: Record<string, number>
    max?: number
    disabled?: Record<string, boolean>
    data?: Record<string, unknown>
}

/** `START`: levanta los servidores REST/WebSocket de cada dominio activo. */
export async function startServers(options: StartServersOptions = {}): Promise<void> {
    if (!isTauri) return
    await invoke("START", { data: options })
}

/** `STOP`: detiene los servidores. */
export async function stopServers(): Promise<void> {
    if (!isTauri) return
    await invoke("STOP")
}

/** `SERVER_DATA`: actualiza los datos de configuración de los servidores. */
export async function serverData(data: Record<string, unknown>): Promise<void> {
    if (!isTauri) return
    await invoke("SERVER_DATA", { data })
}

export async function websocketStart(options: { port?: number; password?: string } = {}): Promise<void> {
    if (!isTauri) return
    await invoke("WEBSOCKET_START", { data: options })
}

export async function websocketStop(): Promise<void> {
    if (!isTauri) return
    await invoke("WEBSOCKET_STOP")
}

// ---------------------------------------------------------------------------
// Timecode
// ---------------------------------------------------------------------------

export async function timecodeStart(data: { value?: string; framerate?: number } = {}): Promise<void> {
    if (!isTauri) return
    await invoke("TIMECODE_START", { data })
}

export async function timecodeStop(): Promise<void> {
    if (!isTauri) return
    await invoke("TIMECODE_STOP")
}

export async function timecodeValue(data: { value: string }): Promise<unknown> {
    if (!isTauri) return null
    return invoke("TIMECODE_VALUE", { data })
}

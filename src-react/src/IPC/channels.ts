// ----- FreeShow -----
// Canales IPC usados por el frontend React.
//
// Los canales externos ("STARTUP", "MAIN", ...) enrutan los eventos del puente
// (`src/IPC/tauri.ts`), mientras que los comandos (`Main.SHOWS`, ...) son el
// nombre del comando Tauri que el backend de Rust expone.

export const STARTUP = "STARTUP"
export const MAIN = "MAIN"

// Comandos del dominio MAIN (subconjunto usado por el frontend).
export const Main = {
    SHOWS: "SHOWS",
    SHOW: "SHOW",
    SETTINGS: "SETTINGS",
    SAVE: "SAVE",
} as const

export type MainCommand = (typeof Main)[keyof typeof Main]

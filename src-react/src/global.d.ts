// ----- FreeShow -----
// Declaraciones globales para el frontend React.

// window.api — contrato expuesto por el puente IPC (src/IPC/tauri.ts).
interface Window {
    api: {
        send: (channel: string, data?: any, id?: string) => void
        receive: (channel: string, func: any, id?: string) => void
        removeListener: (channel: string, id: string) => void
        getListeners: () => [string, number][]
        showFilePath: (file: File) => string
    }
}

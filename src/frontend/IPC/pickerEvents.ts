// Los diálogos nativos de Rust (`OPEN_FOLDER`, `OPEN_FILE`) devuelven lo elegido como resultado del comando; el frontend
// heredado de Electron lo espera como evento (`ToMain.OPEN_FOLDER2` / `OPEN_FILE2`) con el canal y el id del pedido.
// Esta función hace esa traducción; devuelve `null` si el usuario canceló o el comando no es un selector.

export interface PickerEvent {
    channel: "OPEN_FOLDER2" | "OPEN_FILE2"
    data: { channel: string; path?: string; id?: string; files?: string[]; content?: { [key: string]: string } }
}

interface PickerRequest {
    channel?: string
    id?: string
}
interface PickedFiles {
    files?: string[]
    content?: { [key: string]: string }
}

export function pickerEvent(command: string, payload: PickerRequest | undefined, result: unknown): PickerEvent | null {
    if (command === "OPEN_FOLDER") {
        if (typeof result !== "string" || !result) return null
        return { channel: "OPEN_FOLDER2", data: { channel: payload?.channel || "", path: result } }
    }

    if (command === "OPEN_FILE") {
        const picked = result as PickedFiles | null
        if (!Array.isArray(picked?.files) || !picked.files.length) return null
        return { channel: "OPEN_FILE2", data: { channel: payload?.channel || "", id: payload?.id, files: picked.files, content: picked.content || {} } }
    }

    return null
}

// ----- FreeShow -----
// Store de la biblioteca de medios (Zustand). Lee la carpeta de medios del disco
// a través de Rust (`GET_MEDIA_FOLDER_PATH` + `READ_FOLDER`) y expone la lista de
// archivos multimedia para que `MediaPanel` los renderice.

import { create } from "zustand"
import { getMediaFolderPath, readFolder } from "@/IPC/media"
import { isMediaFile } from "@/lib/media"
import type { MediaFileEntry } from "@/types/Media"

interface MediaState {
    /** Carpeta de medios activa devuelta por Rust. */
    folder: string
    /** Archivos multimedia encontrados (recursivo). */
    files: MediaFileEntry[]
    loading: boolean
    /** Ya se intentó cargar al menos una vez. */
    loaded: boolean
    error: string | null

    /** Lee la carpeta de medios. Con `force` vuelve a leer aunque ya esté cargada. */
    loadMedia: (force?: boolean) => Promise<void>
}

export const useMediaStore = create<MediaState>((set, get) => ({
    folder: "",
    files: [],
    loading: false,
    loaded: false,
    error: null,

    loadMedia: async (force = false) => {
        const { loading, loaded } = get()
        if (loading) return
        if (loaded && !force) return

        set({ loading: true, error: null })
        try {
            const folder = await getMediaFolderPath()
            const entries = await readFolder(folder)
            const files = Object.values(entries)
                .filter((entry): entry is MediaFileEntry => !entry.isFolder && isMediaFile(entry.path))
                .sort((a, b) => a.path.localeCompare(b.path))
            set({ folder, files, loading: false, loaded: true })
        } catch (error) {
            console.warn("[media] loadMedia failed:", error)
            set({ loading: false, loaded: true, error: String(error) })
        }
    },
}))

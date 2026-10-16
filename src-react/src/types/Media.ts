// ----- FreeShow -----
// Tipos del dominio MEDIA. Espejo de `commands::files::READ_FOLDER`
// (`FileFolder`) y `commands::media::GET_THUMBNAIL` (`GetThumbnailResult`).

/** `FileInfoStat` de `src-tauri/src/utils/files.rs`. */
export interface FileInfoStat {
    size: number
    isFile: boolean
    isDirectory: boolean
    isSymbolicLink: boolean
    atimeMs: number | null
    mtimeMs: number | null
    ctimeMs: number | null
    birthtimeMs: number | null
}

/** Entrada de archivo devuelta por `READ_FOLDER`. */
export interface MediaFileEntry {
    isFolder: false
    path: string
    name: string
    thumbnailPath: string
    stats: FileInfoStat
}

/** Entrada de carpeta devuelta por `READ_FOLDER`. */
export interface MediaFolderEntry {
    isFolder: true
    path: string
    name: string
    files: string[]
    noMedia?: boolean
}

export type FileFolder = MediaFileEntry | MediaFolderEntry

/** Respuesta de `GET_THUMBNAIL` (`output` vacío si no se pudo generar). */
export interface ThumbnailResult {
    input: string
    size: number
    output: string
}

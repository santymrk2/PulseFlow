// ----- FreeShow -----
// Tipos compartidos de proveedores de contenido.
//
// Movidos desde `src/electron/contentProviders/base/types.ts` para que el frontend
// no dependa de la carpeta `src/electron` (retirada).

export type ContentProviderId = "churchApps" | "amazinglife" | "onstage" | "canva"

/**
 * Category tree structure for content library
 */
export interface ContentLibraryCategory {
    name: string
    thumbnail?: string
    children?: ContentLibraryCategory[]
    key?: string
}

/**
 * Content file (image or video) with metadata
 */
export interface ContentFile {
    url: string
    thumbnail?: string
    fileSize: number
    type: "image" | "video"
    name?: string
    decryptionKey?: string
    mediaId?: string // Provider-specific media ID for tracking
    pingbackUrl?: string // URL to ping after 30+ seconds of playback
    providerId?: ContentProviderId // ID of the content provider this file came from
}

/**
 * Result of a provider license check. `null` from checkMediaLicense means
 * the item is not licensed or the check failed.
 */
export interface MediaLicense {
    pingbackUrl: string
    expiresAt: number // unix ms; license is valid while Date.now() < expiresAt
}

// Imágenes de una escena: lo que el engine nativo puede precargar en sus workers (F19.2).
// Sin stores ni IPC, para poder testearlo.

type MaybeMedia = { type?: string; src?: string; mediaType?: string }

/**
 * Rutas de las imágenes de `items` (las de tipo "media" con `mediaType: "image"`), sin repetir y en
 * orden. `extra` son rutas ya conocidas como imagen (p. ej. fondos) y van primero. Los videos no
 * entran: los decodifica el hub de video del engine, no se precargan como imagen.
 */
export function imagePathsOf(items: readonly MaybeMedia[], extra: readonly (string | null | undefined)[] = []): string[] {
    const paths: string[] = []
    const add = (path: string | null | undefined) => {
        if (path && !paths.includes(path)) paths.push(path)
    }

    extra.forEach(add)
    items.forEach((item) => {
        if (item.type === "media" && item.mediaType === "image") add(item.src)
    })
    return paths
}

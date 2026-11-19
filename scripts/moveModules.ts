// Mudanza de módulos: calcula el mapa de archivos movidos y reescribe las rutas relativas.
// Lógica pura (sin disco ni procesos) para poder testearla; el CLI está en `move-modules.ts`.
import { posix } from "node:path"

export interface Move {
    from: string
    to: string
}

interface Resolved {
    path: string
    /** lo que hay que sacar de la ruta resuelta para recuperar el estilo de la ruta original */
    suffix: string
}

const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"]

// prefijo (from / import / import( / vi.xxx() o vi.xxx<genérico>() + comilla + ruta relativa + misma comilla
const VI_CALL = "\\bvi\\.(?:mock|doMock|unmock|importActual|importMock)"
const SPECIFIER = new RegExp(`(\\bfrom\\s*|\\bimport\\s*\\(?\\s*|${VI_CALL}\\s*\\(\\s*|(?<=${VI_CALL}\\s*<[^>\\n]*>\\s*\\(\\s*))(["'])(\\.{1,2}/[^"'\\n]*)\\2`, "g")

const toPosix = (p: string) => p.replace(/\\/g, "/")

/** Rutas relativas de un archivo, en las mismas formas que reescribe `rewriteSpecifiers`. */
export const listSpecifiers = (code: string): string[] => [...code.matchAll(SPECIFIER)].map((m) => m[3])

export function buildFileMap(moves: Move[], allFiles: string[]): Map<string, string> {
    const map = new Map<string, string>()
    for (const file of allFiles.map(toPosix)) {
        for (const { from, to } of moves) {
            const f = toPosix(from).replace(/\/$/, "")
            const t = toPosix(to).replace(/\/$/, "")
            if (file === f) map.set(file, t)
            else if (file.startsWith(f + "/")) map.set(file, t + file.slice(f.length))
            else continue
            break
        }
    }
    return map
}

function resolve(fromPath: string, spec: string, exists: (p: string) => boolean): Resolved | null {
    const base = posix.join(posix.dirname(toPosix(fromPath)), toPosix(spec))
    for (const suffix of CANDIDATE_SUFFIXES) {
        if (exists(base + suffix)) return { path: base + suffix, suffix }
    }
    return null
}

export function resolveSpecifier(fromPath: string, spec: string, exists: (p: string) => boolean): string | null {
    return resolve(fromPath, spec, exists)?.path ?? null
}

export function rewriteSpecifiers(code: string, oldPath: string, newPath: string, fileMap: Map<string, string>, exists: (p: string) => boolean): { code: string; unresolved: string[] } {
    const unresolved: string[] = []
    const out = code.replace(SPECIFIER, (match, prefix: string, quote: string, spec: string) => {
        const resolved = resolve(oldPath, spec, exists)
        if (!resolved) {
            unresolved.push(spec)
            return match
        }
        const target = fileMap.get(resolved.path) ?? resolved.path
        const styled = resolved.suffix ? target.slice(0, target.length - resolved.suffix.length) : target
        let rel = posix.relative(posix.dirname(toPosix(newPath)), styled)
        if (rel === "") rel = "."
        else if (!rel.startsWith(".")) rel = "./" + rel
        // `./../x` y `../x` son lo mismo: si la ruta no cambió se deja como estaba
        if (posix.normalize(rel) === posix.normalize(spec)) return match
        return `${prefix}${quote}${rel}${quote}`
    })
    return { code: out, unresolved }
}

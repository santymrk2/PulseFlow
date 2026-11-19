// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { listSpecifiers, resolveSpecifier } from "../../../scripts/moveModules"

// Toda ruta relativa de un .ts/.tsx de src/frontend resuelve a un archivo que existe (mismas reglas que
// scripts/moveModules.ts). KNOWN_BROKEN son roturas anteriores, anotadas en docs/diagnostico.md: la lista
// sólo puede achicarse (falla si una entrada ya resuelve).

const ROOT = join(__dirname, "../../..")
const FRONTEND_DIR = join(ROOT, "src/frontend")

// "<archivo relativo a la raíz>|<specifier>"
const KNOWN_BROKEN = ["src/frontend/features/drawer/logic/audio/metronome.ts|../../../types/Audio", "src/frontend/features/drawer/media/Media.test.tsx|./pixabay", "src/frontend/features/drawer/media/Media.test.tsx|./unsplash", "src/frontend/features/show/Show.test.tsx|./MediaPreview"]

function listSources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return listSources(full)
        return /\.tsx?$/.test(entry.name) ? [full] : []
    })
}

const exists = (path: string) => {
    const full = join(ROOT, path)
    return existsSync(full) && statSync(full).isFile()
}

function findBroken(): string[] {
    return listSources(FRONTEND_DIR)
        .flatMap((path) => {
            const file = relative(ROOT, path).replace(/\\/g, "/")
            return listSpecifiers(readFileSync(path, "utf8"))
                .filter((spec) => !resolveSpecifier(file, spec, exists))
                .map((spec) => `${file}|${spec}`)
        })
        .sort()
}

describe("rutas relativas", () => {
    const broken = findBroken()

    it("toda ruta relativa resuelve a un archivo existente", () => {
        expect(broken.filter((entry) => !KNOWN_BROKEN.includes(entry))).toEqual([])
    })
    it("KNOWN_BROKEN sólo se achica: ninguna entrada ya resuelve", () => {
        expect(KNOWN_BROKEN.filter((entry) => !broken.includes(entry))).toEqual([])
    })
})

// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { describe, expect, it } from "vitest"

// Cada acceso `styles.nombre` / `styles["nombre"]` de un .tsx tiene que existir como clase local del
// .module.css importado; si no, da undefined y el estilo se perdió (o el acceso está muerto).

const FRONTEND_DIR = join(__dirname, "..")

function listFiles(dir: string, match: (name: string) => boolean): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return listFiles(full, match)
        return match(entry.name) ? [full] : []
    })
}

// Reemplaza por espacios conservando los saltos de línea.
function blank(text: string): string {
    return text.replace(/[^\n]/g, " ")
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, blank)
}

// Saca url(...) y :global(...) (con paréntesis balanceados); :global(.x) no declara una clase local.
function stripGlobals(css: string): string {
    let out = css.replace(/url\([^)]*\)/g, blank)
    for (;;) {
        const start = out.indexOf(":global(")
        if (start === -1) return out
        let depth = 0
        let end = start + ":global".length
        for (; end < out.length; end++) {
            if (out[end] === "(") depth++
            else if (out[end] === ")" && --depth === 0) break
        }
        out = out.slice(0, start) + blank(out.slice(start, end + 1)) + out.slice(end + 1)
    }
}

function camelCase(name: string): string {
    return name.replace(/[-_]+(.)?/g, (_, ch: string | undefined) => ch?.toUpperCase() ?? "")
}

function localClasses(path: string): Set<string> {
    const css = stripGlobals(stripComments(readFileSync(path, "utf8")))
    const names = new Set<string>()
    for (const [, name] of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
        names.add(name)
        names.add(camelCase(name))
    }
    return names
}

// Rangos donde una declaración local (const/let/var X) tapa al import: desde la declaración hasta el cierre
// de su bloque. Ahí `X.algo` no es el módulo.
function shadowedRanges(src: string, local: string): [number, number][] {
    return [...src.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${local}\\b`, "g"))].map((decl) => {
        let depth = 0
        let end = src.length
        for (let i = decl.index; i < src.length; i++) {
            if (src[i] === "{") depth++
            else if (src[i] === "}" && --depth < 0) {
                end = i
                break
            }
        }
        return [decl.index, end]
    })
}

interface Leak {
    file: string
    line: number
    access: string
}

function findLeaks(): Leak[] {
    return listFiles(FRONTEND_DIR, (n) => n.endsWith(".tsx") && !n.endsWith(".test.tsx")).flatMap((path) => {
        const src = stripComments(readFileSync(path, "utf8"))
        const file = relative(FRONTEND_DIR, path)
        const leaks: Leak[] = []
        for (const [, local, cssPath] of src.matchAll(/import\s+(\w+)\s+from\s+["'](\.[^"']*\.module\.css)["']/g)) {
            const classes = localClasses(resolve(dirname(path), cssPath))
            const body = src.replace(/import[^\n]*\n/g, blank)
            const shadows = shadowedRanges(body, local)
            const access = new RegExp(`(?<![\\w.$])${local}(?:\\.(\\w+)|\\["([^"]+)"\\])`, "g")
            for (const m of body.matchAll(access)) {
                const name = m[1] ?? m[2]
                if (classes.has(name)) continue
                if (shadows.some(([from, to]) => m.index >= from && m.index < to)) continue
                leaks.push({ file, line: body.slice(0, m.index).split("\n").length, access: `${local}.${name}` })
            }
        }
        return leaks
    })
}

describe("CSS Modules: cada clase usada existe en el módulo", () => {
    it("cada styles.X de un .tsx es una clase local de su .module.css", () => {
        const report = findLeaks().map(({ file, line, access }) => `${file}:${line}  ${access}`)
        expect(report).toEqual([])
    })
})

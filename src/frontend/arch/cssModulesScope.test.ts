// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

// En CSS Modules sólo se hashean las clases. Un selector de elemento (div, span, svg…) es GLOBAL.
// Este test marca cada selector cuyo primer compuesto no tiene una clase de nivel superior ni está
// dentro de :global(...) / :root.

const FRONTEND_DIR = join(__dirname, "..")

interface Leak {
    file: string
    line: number
    selector: string
}

function listModuleCss(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return listModuleCss(full)
        return entry.name.endsWith(".module.css") ? [full] : []
    })
}

// Reemplaza los comentarios por espacios, conservando los saltos de línea para que los números de línea coincidan.
function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
}

function matchingBrace(css: string, open: number): number {
    let depth = 0
    for (let i = open; i < css.length; i++) {
        if (css[i] === "{") depth++
        else if (css[i] === "}" && --depth === 0) return i
    }
    return css.length
}

interface RuleHit {
    prelude: string
    offset: number
}

// Recorre bloques: @keyframes se saltea, @media/@supports se entra, las reglas de estilo se registran.
// Los `;` cierran declaraciones sueltas (@import, @charset, declaraciones de cuerpo).
function collectRules(css: string, start: number, end: number, hits: RuleHit[]): void {
    let preludeStart = start
    let i = start
    while (i < end) {
        if (css[i] === ";") {
            preludeStart = ++i
            continue
        }
        if (css[i] !== "{") {
            i++
            continue
        }
        const close = matchingBrace(css, i)
        const raw = css.slice(preludeStart, i)
        const prelude = raw.trim()
        const offset = preludeStart + (raw.length - raw.trimStart().length)
        if (!/^@(-\w+-)?keyframes\b/.test(prelude)) {
            if (!prelude.startsWith("@")) hits.push({ prelude, offset })
            collectRules(css, i + 1, close, hits)
        }
        preludeStart = i = close + 1
    }
}

// Parte por un separador sólo en el nivel superior (fuera de (), [] y strings).
function splitTopLevel(text: string, separator: "," | ">+~" | " "): { part: string; offset: number }[] {
    const parts: { part: string; offset: number }[] = []
    let depth = 0
    let quote: string | null = null
    let start = 0
    const isSeparator = (ch: string) => (separator === "," ? ch === "," : separator === " " ? /\s/.test(ch) : ">+~".includes(ch))
    for (let i = 0; i <= text.length; i++) {
        const ch = text[i] ?? ""
        if (quote) {
            if (ch === quote) quote = null
            continue
        }
        if (ch === '"' || ch === "'") quote = ch
        else if (ch === "(" || ch === "[") depth++
        else if (ch === ")" || ch === "]") depth--
        else if (i === text.length || (depth === 0 && isSeparator(ch))) {
            parts.push({ part: text.slice(start, i), offset: start })
            start = i + 1
        }
    }
    return parts.filter(({ part }) => part.trim() !== "")
}

// Primer compuesto de un selector: hasta el primer espacio o combinador (> + ~) de nivel superior.
function firstCompound(selector: string): string {
    const [first] = splitTopLevel(selector.trim(), " ").flatMap(({ part }) => splitTopLevel(part, ">+~"))
    return (first?.part ?? "").trim()
}

// Hay una clase en el compuesto fuera de paréntesis y corchetes (div:not(.x) no cuenta).
function hasTopLevelClass(compound: string): boolean {
    let depth = 0
    let quote: string | null = null
    for (const ch of compound) {
        if (quote) {
            if (ch === quote) quote = null
        } else if (ch === '"' || ch === "'") quote = ch
        else if (ch === "(" || ch === "[") depth++
        else if (ch === ")" || ch === "]") depth--
        else if (ch === "." && depth === 0) return true
    }
    return false
}

function isLeak(selector: string): boolean {
    const compound = firstCompound(selector)
    if (compound.startsWith(":global(") || compound.startsWith(":root")) return false
    return !hasTopLevelClass(compound)
}

function findLeaks(): Leak[] {
    return listModuleCss(FRONTEND_DIR).flatMap((path) => {
        const css = stripComments(readFileSync(path, "utf8"))
        const hits: RuleHit[] = []
        collectRules(css, 0, css.length, hits)
        const file = relative(FRONTEND_DIR, path)
        return hits.flatMap(({ prelude, offset }) => {
            const selectors = splitTopLevel(prelude, ",")
            return selectors
                .filter(({ part }) => isLeak(part))
                .map(({ part, offset: partOffset }) => {
                    const at = offset + partOffset + (part.length - part.trimStart().length)
                    return {
                        file,
                        line: css.slice(0, at).split("\n").length,
                        selector: part.trim().replace(/\s+/g, " ")
                    }
                })
        })
    })
}

describe("CSS Modules: sin selectores de elemento globales", () => {
    it("cada selector de un *.module.css tiene una clase o está en :global / :root", () => {
        const leaks = findLeaks()
        const report = leaks.map(({ file, line, selector }) => `${file}:${line}  ${selector}`)
        expect(report).toEqual([])
    })
})

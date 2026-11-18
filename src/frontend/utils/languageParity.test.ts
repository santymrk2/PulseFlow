// Paridad de claves entre los dos únicos diccionarios de `public/lang/` (F25.9).
// Se recorren todas las claves, no sólo las hojas, y se comprueba en ambos sentidos.

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

function collectKeys(file: string): Set<string> {
    const raw: unknown = JSON.parse(readFileSync(new URL(`../../../public/lang/${file}.json`, import.meta.url), "utf8"))
    const found = new Set<string>()

    const visit = (value: unknown, prefix: string): void => {
        if (!isObject(value)) return
        for (const [key, child] of Object.entries(value)) {
            const path = prefix ? `${prefix}.${key}` : key
            found.add(path)
            visit(child, path)
        }
    }

    visit(raw, "")
    return found
}

describe("paridad de claves en/es (F25.9)", () => {
    it("todas las claves de en.json existen en es.json", () => {
        const en = collectKeys("en")
        const es = collectKeys("es")
        expect([...en].filter((key) => !es.has(key))).toEqual([])
    })

    it("todas las claves de es.json existen en en.json", () => {
        const en = collectKeys("en")
        const es = collectKeys("es")
        expect([...es].filter((key) => !en.has(key))).toEqual([])
    })
})

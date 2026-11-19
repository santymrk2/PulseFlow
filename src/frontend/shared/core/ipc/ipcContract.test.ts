// Contrato de IPC (F15.2): todo canal `Main.*` que el frontend usa tiene que tener un comando Rust
// registrado en `src-tauri/src/lib.rs`, estar marcado como pospuesto en `IPC/tauri.ts`
// (responde `undefined` al instante) o figurar en la lista de excepciones de abajo.
//
// Si este test falla con un canal nuevo: o falta implementar el comando en Rust y registrarlo, o es
// un canal que todavía no existe y se marca explícitamente como pospuesto/excepción. Lo que no se
// puede es llamarlo y esperar 15 s a que `requestMain` venza sin avisar.

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { classifyChannels, collectChannelUses, parseMainEnum, parsePostponed, parseRegisteredCommands } from "./ipcContract"

const ROOT = fileURLToPath(new URL("../../../", import.meta.url))
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

function walk(dir: string, found: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path, found)
        else if (/\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name)) found.push(path)
    }
    return found
}

/**
 * Canales que el frontend llama y que hoy no tienen comando Rust NI están marcados como pospuestos.
 * Cada uno es deuda conocida (la llamada espera el timeout de `requestMain` y devuelve `undefined`).
 * Para sumar uno acá hay que tener una razón; para sacarlo, implementar el comando.
 */
const KNOWN_WITHOUT_COMMAND: string[] = []

describe("contrato de IPC Main.* ↔ comandos Rust", () => {
    const enumNames = parseMainEnum(read("src/types/IPC/Main.ts"))
    const registered = parseRegisteredCommands(read("src-tauri/src/lib.rs"))
    const postponed = parsePostponed(read("src/frontend/IPC/tauri.ts"))
    const used = collectChannelUses(
        walk(join(ROOT, "src/frontend")).map((path) => readFileSync(path, "utf8")),
        enumNames
    )

    it("lee los tres listados y encuentra datos (el test no pasa por estar vacío)", () => {
        expect(enumNames.size).toBeGreaterThan(100)
        expect(registered.size).toBeGreaterThan(80)
        expect(postponed.size).toBeGreaterThan(20)
        expect(used.size).toBeGreaterThan(50)
    })

    it("no hay canales usados sin comando, sin marca de pospuesto y sin excepción explícita", () => {
        const { unmapped } = classifyChannels({ used, registered, postponed, known: new Set(KNOWN_WITHOUT_COMMAND) })
        expect(unmapped).toEqual([])
    })

    it("la lista de excepciones no tiene entradas viejas (ya implementadas o que nadie usa)", () => {
        const { staleKnown } = classifyChannels({ used, registered, postponed, known: new Set(KNOWN_WITHOUT_COMMAND) })
        expect(staleKnown).toEqual([])
    })
})

describe("clasificación (lógica pura)", () => {
    const base = { registered: new Set(["SAVE"]), postponed: new Set(["NOW_PLAYING"]), known: new Set(["OLD"]) }

    it("un canal sin comando, sin marca y sin excepción es un hueco", () => {
        const result = classifyChannels({ ...base, used: new Set(["SAVE", "NOW_PLAYING", "NUEVO"]) })
        expect(result.unmapped).toEqual(["NUEVO"])
    })

    it("una excepción cubre su canal y se marca vieja si ya tiene comando o nadie lo usa", () => {
        const covered = classifyChannels({ ...base, used: new Set(["OLD"]) })
        expect(covered.unmapped).toEqual([])
        expect(covered.staleKnown).toEqual([])

        const unused = classifyChannels({ ...base, used: new Set(["SAVE"]) })
        expect(unused.staleKnown).toEqual(["OLD"])

        const implemented = classifyChannels({ ...base, registered: new Set(["OLD"]), used: new Set(["OLD"]) })
        expect(implemented.staleKnown).toEqual(["OLD"])
    })
})

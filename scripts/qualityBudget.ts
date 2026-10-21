// Trinquete de calidad (F13.2): la deuda medida puede bajar pero no subir.
// Lógica pura (sin disco ni procesos) para poder testearla; el CLI está en `quality-budget.ts`.

export type Measures = { svelteCheckErrors: number | null; anyCount: number; hexColors: number; rgbColors: number }
export type Budget = { [K in keyof Measures]: number }
export type Change = { key: keyof Measures; from: number; to: number }

const ANY = /(?::\s*any\b|\bas\s+any\b)/g
const HEX = /#[0-9a-fA-F]{3,8}\b/g
const RGB = /\brgba?\(/g

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0

export const countAny = (text: string) => count(text, ANY)
export const countHex = (text: string) => count(text, HEX)
export const countRgb = (text: string) => count(text, RGB)

/**
 * Mide `any` en `.ts`/`.svelte` (sin contar los `*.test.ts`) y los colores literales (hex y `rgb()`) sólo en `.svelte`.
 * `excludedColorPaths` son prefijos de ruta (plantillas o datos de ejemplo) que no cuentan para los colores.
 */
export function measureSources(files: { path: string; text: string }[], excludedColorPaths: string[] = []): Omit<Measures, "svelteCheckErrors"> {
    let anyCount = 0
    let hexColors = 0
    let rgbColors = 0

    for (const file of files) {
        const isSvelte = file.path.endsWith(".svelte")
        if (!isSvelte && !file.path.endsWith(".ts")) continue
        // los tests inspeccionan estructuras internas con `any`: el presupuesto mide el código de producción
        if (file.path.endsWith(".test.ts")) continue

        anyCount += countAny(file.text)
        if (isSvelte && !excludedColorPaths.some((prefix) => file.path.startsWith(prefix))) {
            hexColors += countHex(file.text)
            rgbColors += countRgb(file.text)
        }
    }
    return { anyCount, hexColors, rgbColors }
}

/** Errores de la línea final de `svelte-check` (`… COMPLETED 535 FILES 41 ERRORS …`). `null` si no aparece. */
export function parseSvelteCheckErrors(output: string): number | null {
    const match = output.match(/COMPLETED\s+\d+\s+FILES\s+(\d+)\s+ERRORS/)
    return match ? Number(match[1]) : null
}

/** Compara lo medido con el presupuesto: sube = falla; baja = se informa para actualizar el json. */
export function compareToBudget(budget: Budget, current: Measures): { failures: Change[]; improvements: Change[] } {
    const failures: Change[] = []
    const improvements: Change[] = []

    for (const key of Object.keys(budget) as (keyof Measures)[]) {
        const now = current[key]
        // una medida que no se pudo tomar no puede pasar en silencio
        if (now === null) {
            failures.push({ key, from: budget[key], to: Number.NaN })
        } else if (now > budget[key]) {
            failures.push({ key, from: budget[key], to: now })
        } else if (now < budget[key]) {
            improvements.push({ key, from: budget[key], to: now })
        }
    }
    return { failures, improvements }
}

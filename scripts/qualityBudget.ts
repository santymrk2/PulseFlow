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
 * Mide `any` en `.ts`/`.tsx`/`.svelte` (sin contar los tests) y los colores literales (hex y `rgb()`) en `.svelte`, `.tsx` y `react/ (*.module.css)`.
 * `excludedColorPaths` son prefijos de ruta (plantillas o datos de ejemplo) que no cuentan para los colores.
 */
export function measureSources(files: { path: string; text: string }[], excludedColorPaths: string[] = []): Omit<Measures, "svelteCheckErrors"> {
    let anyCount = 0
    let hexColors = 0
    let rgbColors = 0

    for (const file of files) {
        const isModuleCss = file.path.startsWith("src/frontend/react/") && file.path.endsWith(".module.css")
        const hasColors = file.path.endsWith(".svelte") || file.path.endsWith(".tsx") || isModuleCss
        const hasCode = file.path.endsWith(".ts") || file.path.endsWith(".tsx") || file.path.endsWith(".svelte")
        if (!hasCode && !isModuleCss) continue
        // los tests inspeccionan estructuras internas con `any`: el presupuesto mide el código de producción
        if (/\.test\.tsx?$/.test(file.path)) continue

        if (!isModuleCss) anyCount += countAny(file.text)
        if (hasColors && !excludedColorPaths.some((prefix) => file.path.startsWith(prefix))) {
            hexColors += countHex(file.text)
            rgbColors += countRgb(file.text)
        }
    }
    return { anyCount, hexColors, rgbColors }
}

/**
 * Errores de `svelte-check`: la línea `… COMPLETED 535 FILES 41 ERRORS …` de la salida `machine` o el
 * resumen `svelte-check found 41 errors and …` de la salida `human`. `null` si no aparece ninguno
 * (o sea: si svelte-check no llegó a terminar y la medida no se pudo tomar).
 */
export function parseSvelteCheckErrors(output: string): number | null {
    const completed = output.match(/COMPLETED\s+\d+\s+FILES\s+(\d+)\s+ERRORS/)
    if (completed) return Number(completed[1])
    const found = output.match(/svelte-check found (\d+) errors?/)
    return found ? Number(found[1]) : null
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

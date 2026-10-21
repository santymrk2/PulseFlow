// Trinquete de calidad (F13.2): `bun run test:budget`.
//
// Mide (1) errores de svelte-check, (2) `: any` / `as any` y (3) colores literales en .svelte, y los
// compara con `config/quality-budget.json`. Si algún número SUBE, falla; si BAJA, imprime el valor
// nuevo para actualizar el json en el mismo commit (o `--update` lo escribe).
//
//   bun run test:budget            compara
//   bun run test:budget --update   escribe en el json lo medido (sólo si no empeoró)

import { Glob } from "bun"
import { readFileSync, writeFileSync } from "node:fs"
import { compareToBudget, measureSources, parseSvelteCheckErrors, type Budget, type Measures } from "./qualityBudget"

const BUDGET_PATH = "config/quality-budget.json"
type BudgetFile = Budget & { excludedColorPaths?: string[] }

const budgetFile: BudgetFile = JSON.parse(readFileSync(BUDGET_PATH, "utf8"))
const { excludedColorPaths = [], ...budget } = budgetFile

const files: { path: string; text: string }[] = []
for (const path of new Glob("src/**/*.{ts,svelte}").scanSync(".")) {
    files.push({ path, text: readFileSync(path, "utf8") })
}

// La salida `machine` termina con `COMPLETED <archivos> FILES <errores> ERRORS …`: es la única
// con un resumen estable para medir (la `human` dice `svelte-check found N errors…`).
const check = Bun.spawnSync(["bunx", "svelte-check", "--ignore", "docs", "--output", "machine"], { stdout: "pipe", stderr: "pipe" })
const svelteCheckErrors = parseSvelteCheckErrors(check.stdout.toString() + check.stderr.toString())

const current: Measures = { svelteCheckErrors, ...measureSources(files, excludedColorPaths) }
const { failures, improvements } = compareToBudget(budget, current)

console.log("Presupuesto de calidad (actual / permitido):")
for (const key of Object.keys(budget) as (keyof Measures)[]) {
    console.log(`  ${key.padEnd(18)} ${String(current[key] ?? "sin medir").padStart(6)} / ${budget[key]}`)
}

if (process.argv.includes("--update") && !failures.length) {
    const next: BudgetFile = { ...budgetFile, ...(current as Budget) }
    writeFileSync(BUDGET_PATH, JSON.stringify(next, null, 4) + "\n")
    console.log(`\n${BUDGET_PATH} actualizado.`)
    process.exit(0)
}

if (improvements.length) {
    console.log("\nMejoró (actualizá config/quality-budget.json en este commit, o corré con --update):")
    improvements.forEach((c) => console.log(`  ${c.key}: ${c.from} → ${c.to}`))
}

if (failures.length) {
    console.error("\nEmpeoró (el presupuesto no puede subir):")
    failures.forEach((c) => console.error(`  ${c.key}: ${c.from} → ${Number.isNaN(c.to) ? "no se pudo medir" : c.to}`))
    process.exit(1)
}
console.log("\nOK")

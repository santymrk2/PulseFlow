// `bun run test:types`: falla si hay más errores de TypeScript en src/frontend/** que MAX_ERRORS.
// MAX_ERRORS sólo baja (la línea base de 168 incluía 8 errores de node_modules/json-bible, fuera de src/frontend): cuando el conteo real es menor, se baja acá.
import { parseTscErrors } from "./checkTypes"

export const MAX_ERRORS = 95

const run = Bun.spawnSync(["bunx", "tsc", "-p", "src/frontend/tsconfig.json", "--noEmit", "--pretty", "false"], { stdout: "pipe", stderr: "pipe" })
const output = run.stdout.toString() + run.stderr.toString()
const parsed = parseTscErrors(output)
const errors = parsed.filter((e) => e.file.startsWith("src/frontend/"))

// tsc murió sin errores parseables (p. ej. tsconfig roto): no pasar en silencio
if (run.exitCode !== 0 && !parsed.length) {
    console.error(output)
    process.exit(1)
}
console.log(`errores: ${errors.length} (máximo ${MAX_ERRORS})`)
if (errors.length > MAX_ERRORS) {
    errors.forEach((e) => console.error(`${e.file}:${e.line} ${e.message}`))
    process.exit(1)
}
if (errors.length < MAX_ERRORS) console.log(`bajar MAX_ERRORS a ${errors.length}`)

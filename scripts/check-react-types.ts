// `bun run test:react`: falla si hay errores de TypeScript en src/frontend/react/**.
import { parseTscErrors } from "./checkReactTypes"

const run = Bun.spawnSync(["bunx", "tsc", "-p", "src/frontend/react/tsconfig.json", "--pretty", "false"], { stdout: "pipe", stderr: "pipe" })
const output = run.stdout.toString() + run.stderr.toString()
const errors = parseTscErrors(output).filter((e) => e.file.startsWith("src/frontend/react/"))

errors.forEach((e) => console.error(`${e.file}:${e.line} ${e.message}`))
if (errors.length) process.exit(1)
// tsc murió sin errores parseables (p. ej. tsconfig roto): no pasar en silencio
if (run.exitCode !== 0 && !parseTscErrors(output).length) {
    console.error(output)
    process.exit(1)
}
console.log("OK: sin errores de TypeScript en src/frontend/react/")

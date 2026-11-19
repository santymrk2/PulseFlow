// CLI de mudanza: `bun scripts/move-modules.ts <from>=<to> [<from>=<to> ...]`
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { buildFileMap, rewriteSpecifiers, type Move } from "./moveModules"

const moves: Move[] = process.argv.slice(2).map((arg) => {
    const [from, to] = arg.split("=")
    if (!from || !to) throw new Error(`Par inválido "${arg}": se espera <from>=<to>`)
    return { from, to }
})

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 })
const files = git("ls-files", "src").split("\n").filter(Boolean)
const known = new Set(files)
const exists = (p: string) => known.has(p)
const fileMap = buildFileMap(moves, files)

let rewritten = 0
const unresolved: string[] = []
for (const file of files.filter((f) => /\.tsx?$/.test(f))) {
    const code = readFileSync(file, "utf8")
    const result = rewriteSpecifiers(code, file, fileMap.get(file) ?? file, fileMap, exists)
    unresolved.push(...result.unresolved.map((spec) => `${file}: ${spec}`))
    if (result.code === code) continue
    writeFileSync(file, result.code)
    rewritten++
}

for (const [from, to] of fileMap) {
    mkdirSync(dirname(to), { recursive: true })
    git("mv", from, to)
}

// shortcut: sólo poda las carpetas de origen; si quedan vacías más arriba, se borran a mano
function pruneEmpty(dir: string) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return
    for (const entry of readdirSync(dir)) pruneEmpty(`${dir}/${entry}`)
    if (readdirSync(dir).length === 0) rmdirSync(dir)
}
for (const { from } of moves) pruneEmpty(from)

console.log(`movidos: ${fileMap.size}, reescritos: ${rewritten}, sin resolver: ${unresolved.length}`)
for (const line of unresolved) console.log(line)

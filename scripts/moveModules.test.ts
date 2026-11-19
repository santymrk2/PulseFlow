import { describe, expect, it } from "vitest"
import { buildFileMap, resolveSpecifier, rewriteSpecifiers } from "./moveModules"

const files = ["src/a/X.tsx", "src/a/X.test.tsx", "src/b/Y.tsx", "src/b/A.module.css", "src/b/Lazy.tsx", "src/c/index.ts", "src/c/Z.ts"]
const exists = (p: string) => files.includes(p)

function run(code: string, oldPath: string, moves: { from: string; to: string }[]) {
    const fileMap = buildFileMap(moves, files)
    return rewriteSpecifiers(code, oldPath, fileMap.get(oldPath) ?? oldPath, fileMap, exists)
}

describe("buildFileMap", () => {
    it("conserva la subruta de los archivos dentro de una carpeta", () => {
        const map = buildFileMap([{ from: "src/b", to: "src/z/b" }], files)
        expect(map.get("src/b/Y.tsx")).toBe("src/z/b/Y.tsx")
        expect(map.has("src/a/X.tsx")).toBe(false)
    })
    it("acepta un archivo suelto y no confunde prefijos parecidos", () => {
        const map = buildFileMap([{ from: "src/a/X.tsx", to: "src/q/X.tsx" }], [...files, "src/a/X.tsxx"])
        expect([...map.entries()]).toEqual([["src/a/X.tsx", "src/q/X.tsx"]])
    })
})

describe("resolveSpecifier", () => {
    it("resuelve exacta, con extensión e index", () => {
        expect(resolveSpecifier("src/a/X.tsx", "../b/A.module.css", exists)).toBe("src/b/A.module.css")
        expect(resolveSpecifier("src/a/X.tsx", "../b/Y", exists)).toBe("src/b/Y.tsx")
        expect(resolveSpecifier("src/a/X.tsx", "../c", exists)).toBe("src/c/index.ts")
        expect(resolveSpecifier("src/a/X.tsx", "./NoExiste", exists)).toBeNull()
    })
})

describe("rewriteSpecifiers", () => {
    const moveB = [{ from: "src/b", to: "src/z/b" }]

    it("archivo que no se mueve importa uno movido", () => {
        expect(run(`import Y from "../b/Y"`, "src/a/X.tsx", moveB).code).toBe(`import Y from "../z/b/Y"`)
    })
    it("archivo movido importa uno que no se mueve", () => {
        expect(run(`import X from "../a/X"`, "src/b/Y.tsx", moveB).code).toBe(`import X from "../../a/X"`)
    })
    it("los dos se mueven juntos: la ruta queda igual", () => {
        expect(run(`import L from "./Lazy"`, "src/b/Y.tsx", moveB).code).toBe(`import L from "./Lazy"`)
    })
    it("vi.mock", () => {
        const out = run(`vi.mock("../b/Y", async () => ({}))`, "src/a/X.test.tsx", moveB)
        expect(out.code).toBe(`vi.mock("../z/b/Y", async () => ({}))`)
    })
    it("vi.importActual con genérico: reescribe las dos rutas", () => {
        const code = `vi.importActual<typeof import("../b/Y")>("../b/Y")`
        expect(run(code, "src/a/X.test.tsx", moveB).code).toBe(`vi.importActual<typeof import("../z/b/Y")>("../z/b/Y")`)
    })
    it("import() dinámico", () => {
        const code = `const L = lazy(() => import('./Lazy'))`
        expect(run(code, "src/b/Y.tsx", [{ from: "src/b/Y.tsx", to: "src/q/Y.tsx" }]).code).toBe(`const L = lazy(() => import('../b/Lazy'))`)
    })
    it(".module.css sigue a su archivo", () => {
        expect(run(`import styles from "../b/A.module.css"`, "src/a/X.tsx", moveB).code).toBe(`import styles from "../z/b/A.module.css"`)
    })
    it("index queda sin /index", () => {
        const out = run(`import { z } from "../c"`, "src/a/X.tsx", [{ from: "src/c", to: "src/w/c" }])
        expect(out.code).toBe(`import { z } from "../w/c"`)
    })
    it("ruta que no cambia queda con su forma original", () => {
        expect(run(`import Y from "./../b/Y"`, "src/a/X.tsx", [{ from: "src/q", to: "src/r" }]).code).toBe(`import Y from "./../b/Y"`)
    })
    it("no toca paquetes", () => {
        const code = `import r from "react"\nimport { invoke } from "@tauri-apps/api/core"`
        expect(run(code, "src/a/X.tsx", moveB)).toEqual({ code, unresolved: [] })
    })
    it("sin resolver: queda igual y se informa", () => {
        const code = `import N from "./NoExiste"`
        expect(run(code, "src/a/X.tsx", moveB)).toEqual({ code, unresolved: ["./NoExiste"] })
    })
})

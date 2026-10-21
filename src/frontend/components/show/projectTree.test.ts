import { describe, expect, test } from "vitest"
import { buildProjectTree } from "./projectTree"

const project = (name: string, parent = "/", extra: Record<string, unknown> = {}) => ({ name, parent, created: 0, shows: [], ...extra })
const folder = (name: string, parent = "/", extra: Record<string, unknown> = {}) => ({ name, parent, created: 0, ...extra })
const ids = (tree: { id: string }[]) => tree.map((node) => node.id)

describe("buildProjectTree", () => {
    test("carpetas primero (con sus hijos adentro) y después los proyectos de la raíz", () => {
        const tree = buildProjectTree({
            folders: { f1: folder("Domingos") },
            projects: { p2: project("Zeta"), p1: project("Alfa", "f1"), p3: project("Beta") },
            sortType: "name",
            profile: {}
        })
        expect(ids(tree)).toEqual(["f1", "p1", "p3", "p2"])
        expect(tree[1].index).toBe(1)
        expect(tree[1].path).toBe("f1/")
        expect(tree[0].type).toBe("folder")
    })

    test("un proyecto cuya carpeta no existe cae a la raíz", () => {
        const tree = buildProjectTree({ folders: {}, projects: { p1: project("Alfa", "fantasma") }, sortType: "name", profile: {} })
        expect(tree).toHaveLength(1)
        expect(tree[0].parent).toBe("/")
        expect(tree[0].index).toBe(0)
    })

    test("ignora lo borrado", () => {
        const tree = buildProjectTree({
            folders: { f1: folder("X", "/", { deleted: true }) },
            projects: { p1: project("Alfa", "/", { deleted: true }), p2: project("Beta") },
            sortType: "name",
            profile: {}
        })
        expect(ids(tree)).toEqual(["p2"])
    })

    test("una carpeta sin acceso oculta la carpeta y todo lo que tiene adentro", () => {
        const tree = buildProjectTree({
            folders: { f1: folder("Privada"), f2: folder("Pública") },
            projects: { p1: project("Adentro", "f1"), p2: project("Visible", "f2") },
            sortType: "name",
            profile: { f1: "none" }
        })
        expect(ids(tree)).toEqual(["f2", "p2"])
    })

    test("acceso de sólo lectura se marca en el nodo", () => {
        const tree = buildProjectTree({ folders: { f1: folder("Solo lectura") }, projects: { p1: project("Adentro", "f1") }, sortType: "name", profile: { f1: "read" } })
        expect(tree.every((node) => node.readOnly === true)).toBe(true)
    })

    test("los archivados van al final de su grupo", () => {
        const tree = buildProjectTree({ folders: {}, projects: { a: project("Alfa", "/", { archived: true }), b: project("Beta") }, sortType: "name", profile: {} })
        expect(ids(tree)).toEqual(["b", "a"])
    })

    test("orden por creación: el más nuevo primero", () => {
        const tree = buildProjectTree({ folders: {}, projects: { viejo: project("A", "/", { created: 1 }), nuevo: project("B", "/", { created: 9 }) }, sortType: "created", profile: {} })
        expect(ids(tree)).toEqual(["nuevo", "viejo"])
    })

    test("orden por nombre descendente", () => {
        const tree = buildProjectTree({ folders: {}, projects: { a: project("Alfa"), b: project("Beta") }, sortType: "name_des", profile: {} })
        expect(ids(tree)).toEqual(["b", "a"])
    })
})

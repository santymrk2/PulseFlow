import { describe, expect, test } from "vitest"
import { appendShowRefs, filterShows, isSourceValid, resolveInitialSource, showsOfLibrary, toggleId } from "./leftSource"

const ids = { playlists: ["p1", "p2"], libraries: ["general", "songs"] }

describe("isSourceValid", () => {
    test("una fuente existente es válida", () => {
        expect(isSourceValid({ type: "playlist", id: "p1" }, ids)).toBe(true)
        expect(isSourceValid({ type: "library", id: "songs" }, ids)).toBe(true)
    })
    test("una fuente borrada o null no es válida", () => {
        expect(isSourceValid({ type: "playlist", id: "borrada" }, ids)).toBe(false)
        expect(isSourceValid({ type: "library", id: "p1" }, ids)).toBe(false)
        expect(isSourceValid(null, ids)).toBe(false)
    })
})

describe("resolveInitialSource", () => {
    test("prefiere la última fuente usada si sigue existiendo", () => {
        const last = { type: "library" as const, id: "songs" }
        expect(resolveInitialSource({ last, ...ids })).toEqual(last)
    })
    test("si la última ya no existe, cae a la primera playlist", () => {
        const last = { type: "playlist" as const, id: "borrada" }
        expect(resolveInitialSource({ last, ...ids })).toEqual({ type: "playlist", id: "p1" })
    })
    test("sin playlists, cae a la library General (o a la primera)", () => {
        expect(resolveInitialSource({ last: null, playlists: [], libraries: ["songs", "general"] })).toEqual({ type: "library", id: "general" })
        expect(resolveInitialSource({ last: null, playlists: [], libraries: ["songs"] })).toEqual({ type: "library", id: "songs" })
    })
    test("sin nada devuelve null", () => {
        expect(resolveInitialSource({ last: null, playlists: [], libraries: [] })).toBeNull()
    })
})

describe("filterShows", () => {
    const shows = [{ id: "1", name: "Canción de cuna" }, { id: "2", name: "Sublime gracia" }, { id: "3" }]
    test("ignora mayúsculas y acentos", () => {
        expect(filterShows(shows, "CANCION").map((s) => s.id)).toEqual(["1"])
    })
    test("consulta vacía devuelve todo", () => {
        expect(filterShows(shows, "  ")).toHaveLength(3)
    })
    test("sin coincidencias devuelve lista vacía", () => {
        expect(filterShows(shows, "zzz")).toEqual([])
    })
})

describe("toggleId", () => {
    test("agrega al final y quita si ya estaba, conservando el orden", () => {
        expect(toggleId(["a", "b"], "c")).toEqual(["a", "b", "c"])
        expect(toggleId(["a", "b", "c"], "b")).toEqual(["a", "c"])
    })
})

describe("appendShowRefs", () => {
    test("agrega los shows al final sin tocar los existentes y permite repetidos", () => {
        const current = [{ id: "x", type: "show" as const }]
        const result = appendShowRefs(current, ["a", "x"])
        expect(result).toEqual([
            { id: "x", type: "show" },
            { id: "a", type: "show" },
            { id: "x", type: "show" }
        ])
        expect(current).toHaveLength(1)
    })
})

describe("showsOfLibrary", () => {
    const categories = { general: {}, songs: {} }
    const shows = [
        { id: "1", category: "general" },
        { id: "2", category: "songs" },
        { id: "3", category: null },
        { id: "4", category: "borrada" },
        { id: "5", category: "general", private: true }
    ]
    const ids = (list: { id: string }[]) => list.map((show) => show.id)

    test("lista los shows de esa biblioteca y deja afuera los privados", () => {
        expect(ids(showsOfLibrary(shows, "general", categories, {}))).toEqual(["1"])
    })
    test('"unlabeled" junta los shows sin categoría o con una categoría que ya no existe', () => {
        expect(ids(showsOfLibrary(shows, "unlabeled", categories, {}))).toEqual(["3", "4"])
    })
    test("una biblioteca sin acceso no lista nada", () => {
        expect(showsOfLibrary(shows, "general", categories, { general: "none" })).toEqual([])
    })
    test("una biblioteca vacía devuelve lista vacía", () => {
        expect(showsOfLibrary(shows, "vacia", { ...categories, vacia: {} }, {})).toEqual([])
    })
})

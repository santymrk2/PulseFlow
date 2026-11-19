import { describe, expect, test } from "vitest"
import { getBreadcrumbs } from "./breadcrumb"

const data = {
    categories: { cat1: { name: "Sermones" } },
    mediaFolders: { img1: { name: "Fotos" } },
    audioFolders: { aud1: { name: "Música" } },
    audioPlaylists: { pl1: { name: "Alabanzas" } },
    overlayCategories: { ov1: { name: "Lower thirds" } },
    templateCategories: { tp1: { name: "Serie" } },
    scriptures: { kjv: { name: "King James" } }
}

describe("getBreadcrumbs", () => {
    test("sin categoría seleccionada devuelve sólo la pestaña", () => {
        expect(getBreadcrumbs("media", undefined, data)).toEqual([{ key: "tabs.media" }])
    })

    test("categoría guardada se resuelve con su nombre", () => {
        expect(getBreadcrumbs("media", "img1", data)).toEqual([{ key: "tabs.media" }, { name: "Fotos" }])
        expect(getBreadcrumbs("shows", "cat1", data)).toEqual([{ key: "tabs.shows" }, { name: "Sermones" }])
    })

    test("ids especiales devuelven clave de idioma", () => {
        expect(getBreadcrumbs("media", "all", data)).toEqual([{ key: "tabs.media" }, { key: "category.all" }])
        expect(getBreadcrumbs("media", "online", data)).toEqual([{ key: "tabs.media" }, { key: "media.online" }])
        expect(getBreadcrumbs("audio", "metronome", data)).toEqual([{ key: "tabs.audio" }, { key: "audio.metronome" }])
        expect(getBreadcrumbs("shows", "favourites", data)).toEqual([{ key: "tabs.shows" }, { key: "category.favourites" }])
    })

    test("audio busca en carpetas y también en playlists", () => {
        expect(getBreadcrumbs("audio", "aud1", data)).toEqual([{ key: "tabs.audio" }, { name: "Música" }])
        expect(getBreadcrumbs("audio", "pl1", data)).toEqual([{ key: "tabs.audio" }, { name: "Alabanzas" }])
    })

    test("id desconocido devuelve sólo la pestaña", () => {
        expect(getBreadcrumbs("templates", "nope", data)).toEqual([{ key: "tabs.templates" }])
        expect(getBreadcrumbs("scripture", "kjv", data)).toEqual([{ key: "tabs.scripture" }, { name: "King James" }])
    })
})

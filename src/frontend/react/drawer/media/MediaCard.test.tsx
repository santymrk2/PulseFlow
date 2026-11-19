// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeShow, media, mediaOptions, mediaTags, outLocked, outputs, styles as stylesStore } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { MediaCard } from "./MediaCard"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("./MediaLoader", () => ({ MediaLoader: (props: Record<string, unknown>) => <span data-view="MediaLoader" data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))} /> }))
vi.mock("../../../shared/utils/helpers/media", async () => {
    const actual = await vi.importActual<typeof import("../../../shared/utils/helpers/media")>("../../../shared/utils/helpers/media")
    return { ...actual, loadThumbnail: vi.fn(() => Promise.resolve("")) }
})

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([storeEntry(media, {}), storeEntry(mediaOptions, { columns: 4, mode: "grid" }), storeEntry(outputs, {}), storeEntry(stylesStore, {}), storeEntry(activeShow, null), storeEntry(mediaTags, {}), storeEntry(outLocked, false)])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("MediaCard", () => {
    it("muestra_el_nombre_sin_la_extension", () => {
        render(<MediaCard name="foto.jpg" path="/media/foto.jpg" type="image" active={null} />)
        expect(screen.getByText("foto")).toBeTruthy()
    })

    it("pasa_la_ruta_al_select", () => {
        const { container } = render(<MediaCard name="foto.jpg" path="/media/foto.jpg" type="image" active={null} />)
        expect(container.querySelector("[data-item*='/media/foto.jpg']")).not.toBeNull()
    })

    it("muestra_el_nombre_del_tag_cuando_hay_uno_solo", () => {
        media.set({ "/media/foto.jpg": { tags: ["t1"] } } as never)
        mediaTags.set({ t1: { name: "Favoritos" } } as never)
        render(<MediaCard name="foto.jpg" path="/media/foto.jpg" type="image" active={null} />)
        expect(screen.getByText("Favoritos")).toBeTruthy()
    })
})

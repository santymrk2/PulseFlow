// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react"
import type { CSSProperties } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { audioChannelsData, currentWindow, media as mediaStore, outputs, styles } from "../../../shared/core/stores"
import { videoSync } from "../../../components/media/video/videoSync"
import { getCropState } from "../../../shared/utils/helpers/cropping"
import { looseEntry, setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { MediaItem } from "./MediaItem"

vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../drawer/media/Image", () => ({
    Image: ({ src, style }: { src: string; style?: CSSProperties | string }) => (
        <img
            data-testid="island"
            data-src={src}
            data-style={
                typeof style === "string"
                    ? style
                    : Object.entries(style || {})
                          .map(([key, value]) => `${key}: ${String(value)}`)
                          .join(";")
            }
        />
    )
}))
vi.mock("../../../shared/utils/helpers/media", () => ({
    encodeFilePath: (path: string) => `file://${path}`,
    getExtension: (path: string) => path.split(".").pop() || "",
    getMedia: vi.fn(async (path: string) => ({ path, thumbnail: `${path}_thumb` })),
    getMediaType: (ext: string) => (ext === "mp4" ? "video" : "image"),
    getThumbnailPath: (path: string) => `${path}_thumb`,
    mediaSize: { slideSize: 1920 }
}))
vi.mock("../../../shared/utils/helpers/cropping", () => ({
    getCropState: vi.fn(() => ({ showCropOverflowPreview: false, mediaCropGeometry: "", mediaContainerStyle: "" }))
}))
vi.mock("../../../shared/utils/helpers/output", () => ({ defaultLayers: ["background", "slide", "overlays"] }))
vi.mock("../../../shared/utils/helpers/shows", () => ({
    _show: vi.fn(() => ({
        layouts: () => ({ ref: () => [[{ data: { background: "bg1" } }]] }),
        get: () => ({ media: { bg1: { path: "/bg.mp4" } } })
    }))
}))
vi.mock("../../../components/media/video/softLoop", () => ({
    SoftLoopSync: class {
        update = vi.fn(() => 0.5)
        destroy = vi.fn()
    }
}))
vi.mock("../../../components/media/video/videoSync", () => ({
    videoSync: vi.fn(() => vi.fn()),
    syncVideoToAudio: vi.fn()
}))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(audioChannelsData, { main: { volume: 0.7 } }), storeEntry(currentWindow, null), looseEntry(mediaStore, {}), looseEntry(outputs, {}), looseEntry(styles, {})])
    vi.mocked(getCropState).mockReturnValue({ showCropOverflowPreview: false, mediaCropGeometry: "", mediaContainerStyle: "" } as never)
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

const item = (extra: Record<string, unknown> = {}) => ({ type: "media", src: "/image.jpg", ...extra }) as unknown as Item

describe("MediaItem", () => {
    it("carga_el_media_y_muestra_la_imagen", async () => {
        const { container } = render(<MediaItem item={item()} />)
        await waitFor(() => expect(container.querySelectorAll("[data-testid='island']").length).toBe(1))
        expect(container.querySelector("[data-testid='island']")?.getAttribute("data-src")).toBe("/image.jpg_thumb")
    })

    it("usa_el_thumbnail_en_mini_preview", async () => {
        const { container } = render(<MediaItem item={item()} miniPreview />)
        await waitFor(() => expect(container.querySelector("[data-testid='island']")?.getAttribute("data-src")).toBe("/image.jpg_thumb"))
    })

    it("en_ventana_de_salida_usa_la_ruta_completa", async () => {
        restore = setStoresForTest([looseEntry(audioChannelsData, {}), storeEntry(currentWindow, "output"), looseEntry(mediaStore, {}), looseEntry(outputs, {}), looseEntry(styles, {})])
        const { container } = render(<MediaItem item={item()} preview />)
        await waitFor(() => expect(container.querySelector("[data-testid='island']")?.getAttribute("data-src")).toBe("/image.jpg"))
    })

    it("con_fit_blur_muestra_la_imagen_difuminada_y_la_principal", async () => {
        const { container } = render(<MediaItem item={item({ fit: "blur" })} />)
        await waitFor(() => expect(container.querySelectorAll("[data-testid='island']").length).toBe(2))
        expect(container.querySelectorAll("[data-testid='island']")[0].getAttribute("data-style")).toContain("blur(6px)")
    })

    it("con_video_muestra_los_elementos_video_y_el_track", async () => {
        const { container } = render(<MediaItem item={item({ src: "/clip.mp4" })} preview />)
        await waitFor(() => expect(container.querySelectorAll("video").length).toBe(1))
        expect(container.querySelector("video")?.getAttribute("src")).toBe("file:///clip.mp4")
        expect(container.querySelector("track")?.getAttribute("kind")).toBe("captions")
    })

    it("con_crop_overflow_muestra_una_imagen_adicional", async () => {
        vi.mocked(getCropState).mockReturnValue({ showCropOverflowPreview: true, mediaCropGeometry: "", mediaContainerStyle: "" } as never)
        const { container } = render(<MediaItem item={item()} />)
        await waitFor(() => expect(container.querySelectorAll("[data-testid='island']").length).toBe(2))
    })

    it("si_no_hay_src_usa_el_fondo_de_la_diapositiva_cuando_la_capa_no_esta_activa", async () => {
        restore = setStoresForTest([looseEntry(audioChannelsData, {}), storeEntry(currentWindow, null), looseEntry(mediaStore, {}), looseEntry(outputs, { out1: { style: "st1" } }), looseEntry(styles, { st1: { layers: ["slide"] } })])
        const { container } = render(<MediaItem item={{ type: "media", src: { id: "bg" } } as unknown as Item} outputId="out1" slideRef={{ showId: "s1", layoutId: "l1", slideIndex: 0 }} />)
        await waitFor(() => expect(container.querySelector("video")?.getAttribute("src")).toBe("file:///bg.mp4"))
    })

    it("sin_media_no_renderiza_nada", () => {
        const { container } = render(<MediaItem item={{ type: "media" } as Item} />)
        expect(container.firstElementChild).toBeNull()
    })

    it("registra_el_video_sync_y_limpia_al_desmontar", async () => {
        const unsubscribe = vi.fn()
        vi.mocked(videoSync).mockReturnValue(unsubscribe)
        const { unmount } = render(<MediaItem item={item({ src: "/clip.mp4" })} outputId="out1" />)
        expect(videoSync).toHaveBeenCalledWith("/clip.mp4", "out1", expect.any(Function))
        unmount()
        expect(unsubscribe).toHaveBeenCalled()
    })
})

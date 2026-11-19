// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { clearSlide } from "../../../components/output/clear"
import { getMedia } from "../../../components/helpers/media"
import { setOutput } from "../../../components/helpers/output"
import { activeShow, media, outLocked, outputs, styles } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { MediaPreview } from "./MediaPreview"

vi.mock("../../../components/helpers/media", () => ({
    getMedia: vi.fn(async () => ({ path: "/media/image.png" })),
    getMediaLayerType: vi.fn(() => "background"),
    getMediaStyle: vi.fn(() => ({ fit: "contain" }))
}))
vi.mock("../../../components/helpers/output", () => ({
    getActiveOutputs: vi.fn(() => ["out1"]),
    getCurrentStyle: vi.fn(() => ({})),
    setOutput: vi.fn()
}))
vi.mock("../../../components/output/clear", () => ({ clearSlide: vi.fn() }))
vi.mock("../../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../drawer/media/Image", () => ({ Image: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock("../../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../system/Center", () => ({ Center: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock("../../system/HoverPlay", () => ({ HoverPlay: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <div onClick={onClick}>{children}</div> }))
vi.mock("../VideoShow", () => ({ VideoShow: ({ mediaPath }: { mediaPath: string }) => <div data-video={mediaPath} /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores(locked = false) {
    restore = setStoresForTest([looseEntry(activeShow, { id: "show1", name: "Show" }), looseEntry(media, {}), looseEntry(outLocked, locked), looseEntry(outputs, { out1: {} }), looseEntry(styles, {})])
}

describe("MediaPreview", () => {
    it("carga el archivo y muestra la imagen", async () => {
        setStores()
        const { container } = render(<MediaPreview />)
        const image = await screen.findByAltText("Show")
        expect(image.getAttribute("src")).toBe("/media/image.png")
        expect(container.querySelector("#\\/media\\/image\\.png")).toBeTruthy()
    })

    it("muestra el error cuando no existe el archivo", async () => {
        vi.mocked(getMedia).mockResolvedValueOnce(null)
        setStores()
        const { container } = render(<MediaPreview projectShow={{ id: "show1", name: "Show", type: "image" } as never} />)
        await waitFor(() => expect(document.querySelector("[data-title='error.media: show1']")).toBeTruthy())
        expect(container.querySelector("[data-icon='close']")).toBeTruthy()
    })

    it("usa VideoShow para videos", async () => {
        setStores()
        const { container } = render(<MediaPreview projectShow={{ id: "show1", type: "video" } as never} />)
        await waitFor(() => expect(container.querySelector("[data-video]")).toBeTruthy())
    })

    it("pone el archivo en vivo al hacer click", async () => {
        setStores()
        render(<MediaPreview projectShow={{ id: "show1", name: "Show", type: "image" } as never} />)
        const image = await screen.findByAltText("Show")
        image.parentElement?.click()
        expect(clearSlide).not.toHaveBeenCalled()
        expect(setOutput).toHaveBeenCalledWith("background", { path: "/media/image.png", fit: "contain" })
    })

    it("respeta el bloqueo de salidas", async () => {
        setStores(true)
        render(<MediaPreview projectShow={{ id: "show1", name: "Show", type: "image" } as never} />)
        const image = await screen.findByAltText("Show")
        image.parentElement?.click()
        expect(setOutput).not.toHaveBeenCalled()
    })
})

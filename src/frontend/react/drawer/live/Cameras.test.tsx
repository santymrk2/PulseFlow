// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { media } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { commonMock } from "../../../shared/test/mockCommon"
import { Cameras } from "./Cameras"

const mocks = vi.hoisted(() => ({ list: vi.fn(), clearBad: vi.fn() }))
vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../features/media/logic/cameraManager", () => ({ cameraManager: { getCamerasList: mocks.list, clearBadCamera: mocks.clearBad } }))
vi.mock("./Cam", () => ({
    Cam: ({ cam, style, onClick }: { cam: { id: string; name: string }; style: string; onClick?: (e: MouseEvent<HTMLButtonElement>) => void }) => (
        <button data-style={style} onClick={onClick}>
            {cam.name}
        </button>
    )
}))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue([
        { id: "cam2", name: "Cámara 2", group: "g" },
        { id: "cam1", name: "Cámara 1", group: "g" }
    ])
    restaurar = setStoresForTest([looseEntry(media, {})])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("Cameras", () => {
    it("ordena las cámaras por nombre y avisa al hacer click", async () => {
        const onClick = vi.fn()
        render(<Cameras onClick={onClick} />)
        const names = await Promise.all([screen.findByText("Cámara 1"), screen.findByText("Cámara 2")])
        expect(names.map((n) => n.textContent)).toEqual(["Cámara 1", "Cámara 2"])
        fireEvent.click(names[0])
        expect(mocks.clearBad).toHaveBeenCalledWith("cam1")
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ cam: expect.objectContaining({ id: "cam1" }) }))
    })

    it("aplica el estilo del media store", async () => {
        media.set({ cam1: { flipped: true, fit: "cover" } } as never)
        render(<Cameras showPlayOnHover={false} />)
        const button = await screen.findByText("Cámara 1")
        expect(button.getAttribute("data-style")).toContain("scale(-1, 1)")
        expect(button.getAttribute("data-style")).toContain("object-fit: cover")
    })

    it("muestra empty sin cámaras", async () => {
        mocks.list.mockResolvedValue([])
        render(<Cameras />)
        expect(await screen.findByText("[empty.general]")).toBeTruthy()
    })
})

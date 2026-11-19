// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent, ReactNode } from "react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { media, os, outputs, special } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { commonMock } from "../../../shared/test/mockCommon"
import { Cam } from "./Cam"

const mocks = vi.hoisted(() => ({
    attach: vi.fn(() => Promise.resolve({})),
    detach: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    startup: vi.fn(() => [] as string[]),
    setStartup: vi.fn()
}))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../features/media/logic/cameraManager", () => ({ cameraManager: { attachCamera: mocks.attach, detachCamera: mocks.detach, play: mocks.play, pause: mocks.pause, getStartupCameras: mocks.startup, setStartupCameras: mocks.setStartup } }))
vi.mock("../../../shared/ui/helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../../shared/ui/system/SelectElem", () => ({ SelectElem: ({ children }: { children: ReactNode }) => <div data-testid="select">{children}</div> }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({
    Button: ({ title, onClick, children }: { title?: string; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; children?: ReactNode }) => (
        <button data-title={title} onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("../Card", () => ({
    Card: ({ label, onClick, children, onMouseEnter, onMouseLeave }: { label: string; onClick?: (e: MouseEvent<HTMLDivElement>) => void; children?: ReactNode; onMouseEnter?: () => void; onMouseLeave?: () => void }) => (
        <div role="button" onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            {label}
            {children}
        </div>
    )
}))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    mocks.attach.mockResolvedValue({})
    mocks.startup.mockReturnValue([])
    restaurar = setStoresForTest([looseEntry(media, {}), looseEntry(outputs, {}), looseEntry(special, {}), looseEntry(os, { platform: "darwin" })])
})
afterEach(() => {
    cleanup()
    restaurar()
})

const CAM = { id: "cam1", name: "Cámara 1", group: "g1" }

describe("Cam", () => {
    it("muestra un icono con disablePreview en modo item", () => {
        const { container } = render(<Cam cam={CAM} item disablePreview />)
        expect(container.querySelector("[data-icon='camera']")).toBeTruthy()
        expect(mocks.attach).not.toHaveBeenCalled()
    })

    it("adjunta la cámara al montar, muted por hover y reenvía el click", async () => {
        const onClick = vi.fn()
        render(<Cam cam={CAM} onClick={onClick} />)
        await act(async () => {})
        expect(mocks.attach).toHaveBeenCalledWith(expect.any(HTMLVideoElement), "cam1", expect.objectContaining({ groupId: "g1", preview: true }))
        fireEvent.click(screen.getByText("Cámara 1"))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("muestra el error saneado como HTML cuando attachCamera falla", async () => {
        // En darwin el port reintenta a los 5 s; acá queremos verificar sólo el render del error.
        os.set({ platform: "win32" } as never)
        mocks.attach.mockResolvedValue("<b>Sin permisos</b>")
        const { container } = render(<Cam cam={CAM} />)
        await act(async () => {})
        expect(container.querySelector("b")?.textContent).toBe("Sin permisos")
        expect(container.querySelector("video")).toBeNull()
        // Sin ciclo de remontado: la cámara se adjunta una sola vez.
        expect(mocks.attach).toHaveBeenCalledTimes(1)
    })

    it("permite quitar el filtro y la cámara de arranque", async () => {
        mocks.startup.mockReturnValue(["cam1"])
        media.set({ cam1: { filter: "blur(2px)" } } as never)
        render(<Cam cam={CAM} />)
        await act(async () => {})
        const buttons = [...document.querySelectorAll("button[data-title]")].filter((b) => b.getAttribute("data-title") === "actions.remove")
        expect(buttons).toHaveLength(2)
        fireEvent.click(buttons[0])
        expect(mocks.setStartup).toHaveBeenCalledWith([])
        fireEvent.click(buttons[1])
        expect(get(media).cam1?.filter).toBeUndefined()
    })
})

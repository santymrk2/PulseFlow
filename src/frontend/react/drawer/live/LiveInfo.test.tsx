// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeRecording, currentRecordingStream, drawerTabsData, special } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { commonMock } from "../../test/mockCommon"
import { LiveInfo } from "./LiveInfo"

const mocks = vi.hoisted(() => ({ paused: vi.fn(() => false), toggle: vi.fn(() => true), stop: vi.fn() }))
vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../components/drawer/live/recorder", () => ({ mediaRecorderIsPaused: mocks.paused, toggleMediaRecorder: mocks.toggle, stopMediaRecorder: mocks.stop }))
vi.mock("../../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../ui/button/Button", () => ({ Button: ({ onClick, children }: { onClick?: () => void; children?: ReactNode }) => <button onClick={onClick}>{children}</button> }))
vi.mock("../../ui/text-field/TextField", () => ({ TextField: ({ label, value, onChange }: { label: string; value: string; onChange?: (v: string | null) => void }) => <input data-label={label} value={value} onChange={(e) => onChange?.(e.target.value)} /> }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(activeRecording, false), looseEntry(currentRecordingStream, null), looseEntry(drawerTabsData, {}), looseEntry(special, {})])
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", { configurable: true, writable: true, value: null })
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("LiveInfo", () => {
    it("puede pausar y exportar una grabación activa", () => {
        activeRecording.set(true)
        currentRecordingStream.set({} as MediaStream)
        render(<LiveInfo optionsOpen={false} />)
        expect(screen.getByText("[media.pause]")).toBeTruthy()
        fireEvent.click(screen.getByText("[media.pause]"))
        expect(mocks.toggle).toHaveBeenCalledTimes(1)
        expect(screen.getByText("[popup.continue]")).toBeTruthy()
        fireEvent.click(screen.getByText("[actions.export_recording]"))
        expect(mocks.stop).toHaveBeenCalledTimes(1)
        expect(mocks.paused).toHaveBeenCalled()
    })

    it("avisa de que no se puede grabar en pantallas", () => {
        drawerTabsData.set({ media: { openedSubSubTab: { inputs: "screens" } } } as never)
        render(<LiveInfo optionsOpen={false} />)
        expect(screen.getByText("[empty.recording]")).toBeTruthy()
    })

    it("edita los grupos NDI cuando están las opciones abiertas", () => {
        drawerTabsData.set({ media: { openedSubSubTab: { inputs: "ndi" } } } as never)
        const { container } = render(<LiveInfo optionsOpen />)
        const input = container.querySelector("input") as HTMLInputElement
        expect(input).toBeTruthy()
        fireEvent.change(input, { target: { value: "public,private" } })
        expect(get(special).ndiInputGroups).toBe("public,private")
        fireEvent.change(input, { target: { value: "" } })
        expect(get(special).ndiInputGroups).toBeUndefined()
    })

    it("no muestra nada para NDI sin opciones", () => {
        drawerTabsData.set({ media: { openedSubSubTab: { inputs: "ndi" } } } as never)
        const { container } = render(<LiveInfo optionsOpen={false} />)
        expect(container.innerHTML).toBe("")
    })
})

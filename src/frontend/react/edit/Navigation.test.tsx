// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activeShow, editHistory, editMode, effects, focusMode, labelsDisabled, overlays, refreshEditSlide, scenes, shows, templates } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Navigation } from "./Navigation"

vi.mock("../../shared/ui/helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../shared/ui/helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))
vi.mock("../../shared/ui/system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../shared/ui/kit/button/Button", () => ({
    Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("../../shared/ui/kit/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("@soundtouchjs/audio-worklet", () => ({ SoundTouchNode: class {} }))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: { getAnalyser: () => null } }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioPlayer", () => ({}))
vi.mock("../../shared/utils/profile", () => ({ getAccess: () => ({ global: "full" }) }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: <T,>(v: T): T => JSON.parse(JSON.stringify(v)) }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/historyHelpers", () => ({ historyHelpers: {}, projectReplacers: [] }))
vi.mock("../../components/actions/apiHelper", () => ({}))
vi.mock("../../shared/utils/helpers/media", () => ({ getExtension: () => "", getFileName: (id: string) => id, getMediaType: () => "image" }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [] }))
vi.mock("../../shared/utils/helpers/shows", () => ({ _show: () => ({ get: () => "" }) }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("Navigation", () => {
    it("muestra estado vacío cuando no hay show", () => {
        restore = setStoresForTest([looseEntry(activeEdit, { items: [] }), looseEntry(activePage, "edit"), looseEntry(activeShow, null), looseEntry(editHistory, []), looseEntry(editMode, "default"), looseEntry(effects, {}), looseEntry(focusMode, false), looseEntry(labelsDisabled, false), looseEntry(overlays, {}), looseEntry(refreshEditSlide, false), looseEntry(scenes, {}), looseEntry(shows, {}), looseEntry(templates, {})])
        render(<Navigation />)
        expect(screen.getByText("empty.show")).toBeTruthy()
    })
})

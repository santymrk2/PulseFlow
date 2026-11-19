// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { actions, activeEdit, activePage, activeStage, outputs, special, timers } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { EditValues } from "./EditValues"

vi.mock("@soundtouchjs/audio-worklet", () => ({ SoundTouchNode: class {} }))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: { getAnalyser: () => null } }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioPlayer", () => ({}))
vi.mock("../../../shared/utils/common", () => ({ throttle: (_id: string, value: unknown, cb: (v: unknown) => void) => cb(value) }))
vi.mock("../../../shared/utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../../shared/core/values/extensions", () => ({ mediaExtensions: [], audioExtensions: [], videoExtensions: [], imageExtensions: [], presentationExtensions: [] }))
vi.mock("../../../features/drawer/logic/timers/timers", () => ({ getSortedTimers: () => [] }))
vi.mock("../../../shared/utils/helpers/style", () => ({ getFilters: () => ({}), getStyles: () => ({}) }))
vi.mock("../../../components/main/popups/localization/translation", () => ({ getIsoLanguages: () => [] }))
vi.mock("../../../features/timeline/logic/SlideTimeline", () => ({ SlideTimeline: { hasActionWithKey: () => false, hasActionAtTime: () => false, addKeyframe: vi.fn() } }))
vi.mock("../../../components/edit/scripts/edit", () => ({ parseShadowValue: () => [] }))
vi.mock("../../../components/edit/scripts/itemClipboard", () => ({ filterItemStyle: (s: string) => s || "", mergeWithStyle: (v: string) => v }))
vi.mock("../../../components/edit/scripts/shapeOutside", () => ({ getShapeOutsideStyle: () => "", parseShapeOutsideValue: () => [] }))
vi.mock("../../../components/edit/values/captionLanguages", () => ({ captionLanguages: [], captionTranslateLanguages: [] }))
vi.mock("../../../shared/ui/form/FormInput", () => ({ FormInput: () => <div data-island="form-input" /> }))
vi.mock("../../../shared/ui/helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({
    Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("../../../shared/ui/kit/file-field/FileField", () => ({ FileField: () => <div /> }))
vi.mock("../../../shared/ui/kit/font-field/FontField", () => ({ FontField: () => <div /> }))
vi.mock("../../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../shared/ui/kit/popup-field/PopupField", () => ({ PopupField: () => <div /> }))
vi.mock("../../../shared/ui/kit/textarea-field/TextareaField", () => ({ TextareaField: () => <div /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("EditValues", () => {
    it("renderiza secciones vacías sin fallar", () => {
        restore = setStoresForTest([looseEntry(actions, {}), looseEntry(activeEdit, { items: [] }), looseEntry(activePage, "edit"), looseEntry(activeStage, { id: null }), looseEntry(outputs, {}), looseEntry(special, {}), looseEntry(timers, {})])
        const { container } = render(<EditValues sections={{}} />)
        expect(container).toBeTruthy()
    })
})

// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePopup, activeShow, alertMessage, categories, styles as outputStyles, overlays, selected, shownTips, showsCache, special, templates, theme, themes, timers } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { BoxStyle } from "./BoxStyle"

vi.mock("../../../utils/shortcuts", () => ({ getNormalizedKey: (e: KeyboardEvent) => e.key, isFormattingKey: () => false }))
vi.mock("../../../utils/common", () => ({ newToast: vi.fn() }))
vi.mock("../../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../components/helpers/media", () => ({ getExtension: () => "", getMediaType: () => "image" }))
vi.mock("../../../components/helpers/output", () => ({ getAllEnabledOutputs: () => [] }))
vi.mock("../../../components/helpers/show", () => ({ getCustomMetadata: () => ({}), getLayoutRef: () => [], initializeMetadata: (v: unknown) => v }))
vi.mock("../../../components/helpers/shows", () => ({ _show: () => ({ slides: () => ({ get: () => [] }) }) }))
vi.mock("../../../components/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../../components/edit/scripts/autosize", () => ({ MAX_FONT_SIZE: 800 }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ addFilterString: () => "", addStyle: (_r: unknown, i: unknown) => i, addStyleString: () => "", getItemStyleAtPos: () => "", getItemText: () => "", getLastLineAlign: () => "", getLineText: () => "", getSelectionRange: () => [] }))
vi.mock("../../../components/edit/scripts/itemClipboard", () => ({ getBoxStyle: () => ({}), getFilterStyle: () => ({}), getItemStyle: () => ({}), getSlideStyle: () => ({}), setBoxStyle: vi.fn(), setFilterStyle: vi.fn(), setItemStyle: vi.fn(), setSlideStyle: vi.fn() }))
vi.mock("../../../components/edit/values/boxes", () => ({ itemBoxes: { text: { sections: {} } }, setBoxInputValue: vi.fn() }))
vi.mock("./EditValues", () => ({ EditValues: () => <div data-comp="edit-values" /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("BoxStyle", () => {
    it("renderiza el editor de estilo de caja", () => {
        restore = setStoresForTest([
            looseEntry(activeEdit, { items: [], slide: 0, type: "show" }),
            looseEntry(activePopup, null),
            looseEntry(activeShow, { id: "s1" }),
            looseEntry(alertMessage, ""),
            looseEntry(categories, {}),
            looseEntry(outputStyles, {}),
            looseEntry(overlays, {}),
            looseEntry(selected, { id: null, data: [] }),
            looseEntry(shownTips, []),
            looseEntry(showsCache, { s1: { slides: {}, settings: {} } }),
            looseEntry(special, {}),
            looseEntry(templates, {}),
            looseEntry(theme, ""),
            looseEntry(themes, {}),
            looseEntry(timers, {})
        ])
        const { container } = render(<BoxStyle id={"text" as never} allSlideItems={[]} item={null} />)
        expect(container).toBeTruthy()
    })
})

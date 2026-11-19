// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePopup, overlays, popupData, templates } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { TemplateStyle } from "./TemplateStyle"

vi.mock("../../../shared/utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../../shared/core/values/extensions", () => ({ mediaExtensions: [] }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/ui/helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button> }))
vi.mock("../../../shared/ui/kit/color-field/ColorField", () => ({ ColorField: () => <div /> }))
vi.mock("../../../shared/ui/kit/file-field/FileField", () => ({ FileField: () => <div /> }))
vi.mock("../../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../shared/ui/kit/number-field/NumberField", () => ({ NumberField: () => <div /> }))
vi.mock("../../../shared/ui/kit/popup-field/PopupField", () => ({ PopupField: () => <div /> }))
vi.mock("../../../shared/ui/kit/select-field/SelectField", () => ({ SelectField: () => <div /> }))
vi.mock("../../../shared/ui/kit/toggle-field/ToggleField", () => ({ ToggleField: () => <div /> }))
vi.mock("./ItemsList", () => ({ ItemsList: () => <div data-items="list" /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("TemplateStyle", () => {
    it("renderiza las opciones de plantilla", () => {
        restore = setStoresForTest([looseEntry(activeEdit, { id: "t1" }), looseEntry(templates, { t1: { settings: {} } }), looseEntry(overlays, {}), looseEntry(activePopup, null), looseEntry(popupData, {})])
        const { container } = render(<TemplateStyle allSlideItems={[]} />)
        expect(container.querySelector('[data-items="list"]')).toBeTruthy()
    })
})

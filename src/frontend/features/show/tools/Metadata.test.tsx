// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, customMetadata, dictionary, showsCache } from "../../../shared/core/stores"
import { history } from "../../../shared/utils/helpers/history"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { Metadata } from "./Metadata"

vi.mock("../../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/utils/helpers/show", () => ({ getCustomMetadata: () => ({ number: "", title: "" }), initializeMetadata: () => ({ number: "", title: "" }) }))
vi.mock("../../../app/main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../../../shared/test/islandMock")>("../../../shared/test/islandMock")).makePortMock("Tip") }))
vi.mock("../../../shared/ui/kit/text-field/TextField", () => ({ TextField: ({ label, value }: { label: string; value: string }) => <label data-field={label}>{value}</label> }))
vi.mock("../../../shared/ui/kit/number-field/NumberField", () => ({ NumberField: ({ label }: { label: string }) => <label data-field={label} /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("Metadata", () => {
    it("muestra los campos personalizados y el de duración", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "show1", type: "show" }), looseEntry(showsCache, { show1: { name: "1 Intro", meta: { title: "Intro" }, quickAccess: { duration: 5 } } }), looseEntry(customMetadata, {}), looseEntry(dictionary, {})])
        const { container } = render(<Metadata />)
        expect(container.querySelector("[data-field='title']")).toBeTruthy()
        expect(container.querySelector("[data-isla='Tip']")).toBeTruthy()
        expect(container.querySelector("[data-field='transition.duration (s)']")).toBeTruthy()
    })

    it("guarda la duración en quickAccess", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "show1" }), looseEntry(showsCache, { show1: { name: "Show", quickAccess: {} } }), looseEntry(customMetadata, {}), looseEntry(dictionary, {})])
        render(<Metadata />)
        expect(history).not.toHaveBeenCalled()
    })
})

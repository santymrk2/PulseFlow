// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { EditboxPlain } from "./EditboxPlain"

vi.mock("../../bridge/SvelteIsland", () => ({
    SvelteIsland: (props: { props?: { active?: boolean; onlyCorners?: boolean } }) => <section className="hideFromAutosize" data-testid="movebox" />
}))

vi.mock("../../../stores", () => ({
    activeEdit: {
        subscribe: (run: (v: unknown) => void) => {
            run({ items: [0], slide: 0, type: "show" })
            return () => {}
        }
    },
    activeShow: {
        subscribe: (run: (v: unknown) => void) => {
            run({ id: "show1" })
            return () => {}
        }
    },
    outputs: {
        subscribe: (run: (v: unknown) => void) => {
            run({})
            return () => {}
        }
    },
    overlays: {
        subscribe: (run: (v: unknown) => void) => {
            run({})
            return () => {}
        }
    },
    templates: {
        subscribe: (run: (v: unknown) => void) => {
            run({})
            return () => {}
        }
    }
}))
vi.mock("../../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../../components/context/menuClick", () => ({ menuClick: vi.fn() }))
vi.mock("../../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../components/helpers/show", () => ({ getLayoutRef: () => [{ id: "s1" }] }))
vi.mock("../../../components/helpers/shows", () => ({ _show: () => ({ get: () => ({ s1: { items: [] } }) }) }))
vi.mock("../../../components/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../../components/main/popups/localization/isoLanguages", () => ({ isoLanguages: [] }))
vi.mock("../../../components/edit/scripts/itemHelpers", () => ({ isConditionMet: () => false }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ getItemText: () => "" }))

afterEach(cleanup)

describe("EditboxPlain", () => {
    it("renderiza Movebox cuando no está oculto", () => {
        const item: Item = { type: "text", style: "", lines: [{ align: "", text: [{ value: "", style: "" }] }] }
        const { container } = render(<EditboxPlain item={item} index={0} ratio={1} />)
        expect(container.querySelector("section")).toBeTruthy()
    })

    it("oculta Movebox cuando hideMovebox es true", () => {
        const item: Item = { type: "text", style: "", lines: [{ align: "", text: [{ value: "", style: "" }] }] }
        const { container } = render(<EditboxPlain item={item} index={0} ratio={1} hideMovebox />)
        expect(container.querySelector("section.hideFromAutosize")).toBeNull()
    })
})

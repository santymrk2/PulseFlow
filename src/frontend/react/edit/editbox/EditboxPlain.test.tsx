// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EditboxPlain } from "./EditboxPlain"

vi.mock("../../../shared/core/stores", () => ({
    activeEdit: {
        subscribe: (r: any) => {
            r({ items: [0] })
            return () => {}
        }
    },
    activeShow: {
        subscribe: (r: any) => {
            r({ id: "s1" })
            return () => {}
        }
    },
    outputs: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    overlays: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    templates: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    }
}))
vi.mock("../../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../../components/context/menuClick", () => ({ menuClick: vi.fn() }))
vi.mock("../../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../components/helpers/show", () => ({ getLayoutRef: () => [{ id: "sl1" }] }))
vi.mock("../../../components/helpers/shows", () => ({ _show: () => ({ get: () => ({}) }) }))
vi.mock("../../../components/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../../components/main/popups/localization/isoLanguages", () => ({ isoLanguages: [] }))
vi.mock("../../../components/edit/scripts/itemHelpers", () => ({ isConditionMet: () => false }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ getItemText: () => "" }))
vi.mock("../../system/Movebox", () => ({ Movebox: () => <div data-testid="movebox" /> }))
vi.mock("../../ui/button/Button", () => ({ Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }))
vi.mock("../../helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../../helpers/T", () => ({ T: () => <span /> }))

afterEach(cleanup)

describe("EditboxPlain", () => {
    it("renderiza Movebox cuando no está oculto", () => {
        const { getByTestId } = render(<EditboxPlain item={{ type: "text" } as any} index={0} ratio={1} />)
        expect(getByTestId("movebox")).toBeTruthy()
    })

    it("oculta Movebox cuando hideMovebox es true", () => {
        const { queryByTestId } = render(<EditboxPlain item={{ type: "text" } as any} index={0} ratio={1} hideMovebox />)
        expect(queryByTestId("movebox")).toBeNull()
    })
})

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
vi.mock("../../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../../shared/ui/context/logic/menuClick", () => ({ menuClick: vi.fn() }))
vi.mock("../../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [{ id: "sl1" }] }))
vi.mock("../../../shared/utils/helpers/shows", () => ({ _show: () => ({ get: () => ({}) }) }))
vi.mock("../../../shared/utils/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../../components/main/popups/localization/isoLanguages", () => ({ isoLanguages: [] }))
vi.mock("../../../components/edit/scripts/itemHelpers", () => ({ isConditionMet: () => false }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ getItemText: () => "" }))
vi.mock("../../../shared/ui/system/Movebox", () => ({ Movebox: () => <div data-testid="movebox" /> }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({ Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }))
vi.mock("../../../shared/ui/helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../../../shared/ui/helpers/T", () => ({ T: () => <span /> }))

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

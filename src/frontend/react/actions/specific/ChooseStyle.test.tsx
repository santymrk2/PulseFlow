// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../hooks/useStore", () => ({
    useStore: (store: unknown) => {
        // outputs or styles store
        if (store === outputsStore) return { out1: { id: "out1", name: "Main" } }
        if (store === stylesStore) return { st1: { id: "st1", name: "Style 1" } }
        return {}
    }
}))
vi.mock("../../../shared/core/stores", () => ({ outputs: { id: "outputs" }, styles: { id: "styles" } }))
vi.mock("../../../shared/utils/common", () => ({ newToast: vi.fn() }))
vi.mock("../../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../../shared/utils/helpers/array", () => ({ keysToID: (o: Record<string, unknown>) => Object.keys(o || {}).map((id) => ({ ...(o[id] || {}), id })), sortByName: (a: unknown[]) => a }))
vi.mock("../../ui/select-field/SelectField", () => ({ SelectField: ({ label }: { label?: string }) => <div data-testid="select">{label}</div> }))

import { outputs as outputsStore, styles as stylesStore } from "../../../shared/core/stores"
import { ChooseStyle } from "./ChooseStyle"

describe("ChooseStyle", () => {
    afterEach(() => cleanup())

    it("renderiza selector de estilos de salida", () => {
        const { getAllByTestId } = render(<ChooseStyle value={{ outputStyle: "", styleOutputs: { type: "active" } } as unknown as never} />)
        expect(getAllByTestId("select").length).toBeGreaterThan(0)
    })
})

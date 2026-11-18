// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../hooks/useStore", () => ({ useStore: () => "ltr" }))
vi.mock("../../components/context/loadItems", () => ({ loadItems: () => [] }))
vi.mock("../../components/context/contextMenus", () => ({
    contextMenuItems: { copy: { label: "actions.copy", icon: "copy", shortcut: "Ctrl+C" } }
}))
vi.mock("./ContextItem", () => ({ ContextItem: () => <div data-testid="context-item" /> }))

import { ContextChild } from "./ContextChild"

describe("ContextChild", () => {
    afterEach(() => cleanup())

    it("renderiza un elemento de submenú", () => {
        const { container } = render(<ContextChild id="copy" contextElem={null} />)
        expect(container.firstChild).toBeTruthy()
    })
})

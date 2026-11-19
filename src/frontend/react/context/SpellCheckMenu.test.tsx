// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mockSpellcheck = { misspelled: "holaa", suggestions: ["hola"] }
vi.mock("../hooks/useStore", () => ({ useStore: () => mockSpellcheck }))
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../utils/shortcuts", () => ({ closeContextMenu: vi.fn() }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))

import { SpellCheckMenu } from "./SpellCheckMenu"

describe("SpellCheckMenu", () => {
    afterEach(() => cleanup())

    it("muestra sugerencias cuando hay palabra mal escrita", () => {
        const { container } = render(<SpellCheckMenu />)
        expect(container.textContent).toContain("hola")
        expect(container.textContent).toContain("holaa")
    })
})

// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import OutputOverlay from "./OutputOverlay"

vi.mock("../../components/edit/scripts/itemHelpers", () => ({ shouldItemBeShown: () => true }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("../slide/Textbox", () => ({ Textbox: () => <div data-testid="textbox" /> }))
vi.mock("./SlideItemTransition", () => ({ SlideItemTransition: ({ children }: { children: (args: { customItem: { id: string } }) => React.ReactNode }) => <div>{children({ customItem: { id: "i1" } })}</div> }))

afterEach(cleanup)

describe("OutputOverlay", () => {
    it("renderiza", () => {
        const { container } = render(<OutputOverlay outputId="o1" overlay={{ items: [] }} transition={{ type: "none", duration: 0 } as unknown as Parameters<typeof OutputOverlay>[0]["transition"]} />)
        expect(container).toBeTruthy()
    })
})

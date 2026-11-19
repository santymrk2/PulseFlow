// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Template } from "../../../../types/Show"
import { TemplateSlide } from "./TemplateSlide"

vi.mock("../../../shared/core/stores", () => ({
    activeEdit: {
        subscribe: (r: any) => {
            r({ items: [] })
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
    previewOutputId: {
        subscribe: (r: any) => {
            r("")
            return () => {}
        }
    },
    styles: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    }
}))
vi.mock("../../../shared/utils/helpers/media", () => ({ getMedia: vi.fn(async () => null), getThumbnailPath: () => "", mediaSize: { slideSize: "slideSize" } }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getResolution: () => ({ width: 1920, height: 1080 }) }))
vi.mock("../../slide/logic/getStyleResolution", () => ({ getStyleResolution: () => "" }))
vi.mock("../../edit/editbox/Editbox", () => ({ Editbox: () => <div data-testid="editbox" /> }))
vi.mock("../media/MediaLoader", () => ({ MediaLoader: () => <div data-testid="media" /> }))
vi.mock("../../slide/Zoomed", () => ({ Zoomed: ({ children }: any) => <div data-testid="zoomed">{children}</div> }))
vi.mock("../../slide/Textbox", () => ({ Textbox: () => <div data-testid="textbox" /> }))
vi.mock("../../../shared/ui/system/Snaplines", () => ({ Snaplines: () => <div data-testid="snaplines" /> }))

afterEach(cleanup)

describe("TemplateSlide", () => {
    it("renderiza en modo edición con snaplines y editboxes", () => {
        const template: Template = { name: "t", color: null, category: null, items: [{ type: "text", lines: [] } as any] }
        const { getByTestId } = render(<TemplateSlide templateId="t1" template={template} edit />)
        expect(getByTestId("zoomed")).toBeTruthy()
        expect(getByTestId("snaplines")).toBeTruthy()
        expect(getByTestId("editbox")).toBeTruthy()
    })

    it("renderiza preview con textboxes cuando no edita", () => {
        const template: Template = { name: "t", color: null, category: null, items: [{ type: "text", lines: [] } as any] }
        const { getByTestId, queryByTestId } = render(<TemplateSlide templateId="t1" template={template} />)
        expect(getByTestId("textbox")).toBeTruthy()
        expect(queryByTestId("snaplines")).toBeNull()
    })
})

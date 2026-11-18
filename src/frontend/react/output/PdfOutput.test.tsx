// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import PdfOutput from "./PdfOutput"

vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: { workerSrc: "" }, getDocument: () => ({ promise: Promise.resolve({ getPage: async () => ({ getViewport: () => ({ width: 100, height: 100 }), render: () => ({ promise: Promise.resolve() }) }) }), destroy: () => {} }) }))
vi.mock("./OutputTransition", () => ({ OutputTransition: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }))
vi.mock("../../components/helpers/media", () => ({ encodeFilePath: (p: string) => p, locateMediaFile: async () => null }))

afterEach(cleanup)

describe("PdfOutput", () => {
    it("renderiza canvas", () => {
        const { container } = render(<PdfOutput slide={{ id: "file.pdf", page: 0 }} currentStyle={{}} transition={{ type: "none", duration: 0 } as unknown as never} />)
        expect(container.querySelector("canvas")).toBeTruthy()
    })
})

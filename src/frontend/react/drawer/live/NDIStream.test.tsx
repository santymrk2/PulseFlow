// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NDI } from "../../../../types/Channels"
import { NDIStream } from "./NDIStream"

vi.mock("./StreamFrame", () => ({ StreamFrame: (props: object) => <div data-props={JSON.stringify(props)} /> }))

afterEach(() => cleanup())

describe("NDIStream", () => {
    it("usa el canal NDI, el icono ndi y el id ndi", () => {
        const { container } = render(<NDIStream screen={{ id: "n1", name: "NDI" }} background mirror outputId="out" style="width: 50%;" />)
        const props = JSON.parse(container.firstElementChild!.getAttribute("data-props")!)
        expect(props).toMatchObject({ channel: NDI, selectId: "ndi", icon: "ndi", background: true, mirror: true, outputId: "out", style: "width: 50%;" })
    })
})

// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OMT } from "../../../../types/Channels"
import { OMTStream } from "./OMTStream"

vi.mock("./StreamFrame", () => ({ StreamFrame: (props: object) => <div data-props={JSON.stringify(props)} /> }))

afterEach(() => cleanup())

describe("OMTStream", () => {
    it("usa el canal OMT, el icono omt y el id omt", () => {
        const { container } = render(<OMTStream screen={{ id: "o1", name: "OMT" }} background />)
        const props = JSON.parse(container.firstElementChild!.getAttribute("data-props")!)
        expect(props).toMatchObject({ channel: OMT, selectId: "omt", icon: "omt", background: true })
    })
})

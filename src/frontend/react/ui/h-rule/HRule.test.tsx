// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { HRule } from "./HRule"

vi.mock("../../../utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("HRule", () => {
    it("renderiza_el_titulo_traducido", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { menu: { shows: "Shows" } })])
        render(<HRule title="menu.shows" />)
        expect(screen.getByText("Shows")).toBeTruthy()
    })

    it("sin_title_no_renderiza_texto", () => {
        const { container } = render(<HRule />)
        expect(container.querySelector("span")).toBeNull()
        expect(container.firstElementChild?.childNodes.length).toBe(0)
    })
})

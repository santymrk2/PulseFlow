// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary, popupData } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ChooseStyle } from "./ChooseStyle"

vi.mock("../../utils/common", () => commonMock())

let restaurar: () => void = () => {}
function montar() {
    restaurar = setStoresForTest([storeEntry(popupData, {}), storeEntry(dictionary, { settings: { normal: "Normal" }, tabs: { live: "En vivo" } })] as never)
    render(<ChooseStyle />)
}
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ChooseStyle", () => {
    it("renderiza_normal_y_en_vivo", () => {
        montar()
        expect(screen.getByText("Normal")).toBeTruthy()
        expect(screen.getByText("En vivo")).toBeTruthy()
    })

    it("elegir_deja_id_y_value_en_popupData", () => {
        montar()
        fireEvent.click(screen.getByText("En vivo"))
        expect(get(popupData)).toEqual({ id: "choose_style", value: "live" })
        fireEvent.click(screen.getByText("Normal"))
        expect(get(popupData)).toEqual({ id: "choose_style", value: "normal" })
    })
})

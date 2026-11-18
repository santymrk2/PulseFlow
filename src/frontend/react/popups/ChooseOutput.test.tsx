// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary, popupData } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ChooseOutput } from "./ChooseOutput"

vi.mock("../../utils/common", () => commonMock())

let restaurar: () => void = () => {}
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ChooseOutput", () => {
    it("renderiza_normal_y_escenario", () => {
        restaurar = setStoresForTest([storeEntry(popupData, {}), storeEntry(dictionary, { settings: { normal: "Normal" }, menu: { stage: "Escenario" } })] as never)
        render(<ChooseOutput />)
        expect(screen.getByText("Normal")).toBeTruthy()
        expect(screen.getByText("Escenario")).toBeTruthy()
    })

    it("elegir_deja_id_y_value_en_popupData", () => {
        restaurar = setStoresForTest([storeEntry(popupData, {}), storeEntry(dictionary, { settings: { normal: "Normal" }, menu: { stage: "Escenario" } })] as never)
        render(<ChooseOutput />)
        fireEvent.click(screen.getByText("Escenario"))
        expect(get(popupData)).toEqual({ id: "choose_output_input", value: "stage" })
        fireEvent.click(screen.getByText("Normal"))
        expect(get(popupData)).toEqual({ id: "choose_output_input", value: "normal" })
    })
})

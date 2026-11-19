// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activePopup } from "../../shared/core/stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { OtherButtons } from "./OtherButtons"

vi.mock("../../shared/utils/common", () => commonMock())

let restaurar: () => void = () => {}
afterEach(() => {
    cleanup()
    restaurar()
})

describe("OtherButtons", () => {
    it("renderiza_lo_principal", () => {
        restaurar = setStoresForTest([storeEntry(activePopup, null)])
        render(<OtherButtons />)
        const boton = screen.getByRole("button")
        expect(boton.textContent).toBe("settings.reset_all")
        expect(boton.style.width).toBe("100%")
        // happy-dom no conserva el shorthand con var(): se mira el color del borde superior
        expect(boton.style.borderTopColor).toBe("var(--primary-lighter)")
        expect(boton.style.padding).toBe("15px")
    })

    it("click_abre_el_popup_reset_all", () => {
        restaurar = setStoresForTest([storeEntry(activePopup, null)])
        render(<OtherButtons />)
        fireEvent.click(screen.getByRole("button"))
        expect(get(activePopup)).toBe("reset_all")
    })
})

// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SystemDisplays } from "./SystemDisplays"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))

afterEach(cleanup)

describe("SystemDisplays", () => {
    it("renderiza_lo_principal_con_aviso_si_no_hay_monitores", () => {
        render(<SystemDisplays displays={[]} />)
        expect(screen.getByText("screen_config.no_monitors")).toBeTruthy()
        expect(screen.getByText("screen_config.refresh")).toBeTruthy()
        expect(screen.getByText("screen_config.identify")).toBeTruthy()
    })

    it("con_monitores_no_muestra_el_aviso", () => {
        render(<SystemDisplays displays={[{ id: "a" }]} />)
        expect(screen.queryByText("screen_config.no_monitors")).toBeNull()
    })

    it("refrescar_llama_a_onRefresh_sin_argumentos", () => {
        const onRefresh = vi.fn()
        render(<SystemDisplays onRefresh={onRefresh} />)
        fireEvent.click(screen.getByText("screen_config.refresh"))
        expect(onRefresh).toHaveBeenCalledWith()
    })

    it("identificar_llama_a_onIdentify_sin_argumentos", () => {
        const onIdentify = vi.fn()
        render(<SystemDisplays onIdentify={onIdentify} />)
        fireEvent.click(screen.getByText("screen_config.identify"))
        expect(onIdentify).toHaveBeenCalledWith()
    })
})

// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { defaultColors } from "../../shared/utils/helpers/color"
import { special } from "../../shared/core/stores"
import styles from "../../shared/ui/kit/color-field/ColorField.module.css"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { ManageColors } from "./ManageColors"

// Con el ColorField REAL (en editMode): el store se muta en el lugar, así que la lista tiene que refrescarse sola
vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../components/edit/scripts/edit", () => ({ getGradientOpacity: () => 1, addOpacityToGradient: vi.fn() }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../react/main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Tip") }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let restaurar: () => void = () => {}
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ManageColors con ColorField real", () => {
    it("clic_en_un_color_por_defecto_lo_marca_disabled_y_otro_clic_lo_desmarca", () => {
        restaurar = setStoresForTest([looseEntry(special, {})])
        Object.defineProperty(navigator, "clipboard", { value: { readText: () => Promise.resolve("") }, configurable: true })
        const { container } = render(<ManageColors />)
        const color = defaultColors[0].value
        const swatch = () => container.querySelector(`[data-value="${color}"]`) as HTMLElement

        expect(swatch().classList.contains(styles.disabled)).toBe(false)
        fireEvent.click(swatch())
        expect(swatch().classList.contains(styles.disabled)).toBe(true)
        fireEvent.click(swatch())
        expect(swatch().classList.contains(styles.disabled)).toBe(false)
    })

    it("un_color_propio_agregado_aparece_en_la_lista", () => {
        restaurar = setStoresForTest([looseEntry(special, { customColors: ["#123456"] })])
        Object.defineProperty(navigator, "clipboard", { value: { readText: () => Promise.resolve("") }, configurable: true })
        const { container } = render(<ManageColors />)
        expect(container.querySelector('[data-value="#123456"]')).toBeTruthy()
        fireEvent.click(container.querySelector('[data-value="#123456"]') as HTMLElement)
        expect(container.querySelector('[data-value="#123456"]')).toBeNull()
    })
})

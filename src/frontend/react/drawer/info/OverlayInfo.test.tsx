// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { drawerTabsData } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { OverlayInfo } from "./OverlayInfo"
import styles from "./OverlayInfo.module.css"

let restaurar: () => void = () => {}
afterEach(() => {
    cleanup()
    restaurar()
})

describe("OverlayInfo", () => {
    it("muestra EffectsInfo en la pestaña effects", () => {
        restaurar = setStoresForTest([looseEntry(drawerTabsData, { overlays: { activeSubTab: "effects" } })])
        const { container } = render(<OverlayInfo />)
        expect(container.querySelector("[class*='scroll']")).toBeTruthy()
        expect(container.querySelector(`.${styles.scroll}`)).toBeNull()
    })

    it("deja el panel vacío en el resto de pestañas", () => {
        restaurar = setStoresForTest([looseEntry(drawerTabsData, { overlays: { activeSubTab: "other" } })])
        const { container } = render(<OverlayInfo />)
        expect(container.querySelector(`.${styles.scroll}`)).toBeTruthy()
    })
})

// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { EffectsInfo } from "./EffectsInfo"
import styles from "./EffectsInfo.module.css"

afterEach(cleanup)

describe("EffectsInfo", () => {
    it("renderiza el contenedor con scroll", () => {
        const { container } = render(<EffectsInfo />)
        expect(container.firstElementChild?.classList.contains(styles.scroll)).toBe(true)
    })
})

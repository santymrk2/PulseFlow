// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../stores"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import iconStyles from "../../helpers/Icon.module.css"
import { Title } from "./Title"
import styles from "./Title.module.css"

// Corta el ciclo utils/language → utils/common → … → historyHelpers (ver Button.test.tsx)
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false }))

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Title", () => {
    it("renderiza_icono_y_label_traducido", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { menu: { shows: "Shows" } })])
        const { container } = render(<Title label="menu.shows" icon="export" />)
        expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("Shows")
        expect(container.querySelector("svg")?.classList.contains(iconStyles.white)).toBe(true)
    })

    it("data_title_se_traduce", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { menu: { shows: "Shows" } })])
        render(<Title label="menu.shows" icon="export" title="menu.shows" />)
        expect(screen.getByRole("heading", { level: 3 }).getAttribute("data-title")).toBe("Shows")
    })

    it("variantes_center", () => {
        const { unmount } = render(<Title label="x" icon="export" center />)
        expect(screen.getByRole("heading", { level: 3 }).classList.contains(styles.center)).toBe(true)
        unmount()
        render(<Title label="x" icon="export" />)
        expect(screen.getByRole("heading", { level: 3 }).classList.contains(styles.center)).toBe(false)
    })
})

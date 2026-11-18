// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dictionary, mediaOptions } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { clearIslands, islands } from "../test/islandMock"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Card } from "./Card"
import styles from "./Card.module.css"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Loader") }))

let restaurar: () => void = () => {}
const principal = (container: HTMLElement) => container.firstElementChild as HTMLElement
const over = (container: HTMLElement) => container.querySelector(`.${styles.over}`) as HTMLElement
const card = (container: HTMLElement) => container.querySelector(`.${styles.card}`) as HTMLElement

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    restaurar = setStoresForTest([storeEntry(mediaOptions, { columns: 4, mode: "grid" }), storeEntry(dictionary, { media: { play: "Reproducir" }, clear: { general: "Quitar" } })])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Card", () => {
    it("renderiza_el_label_el_count_y_los_hijos_con_la_relacion_de_aspecto", () => {
        const { container } = render(
            <Card label="Mi media" count={3} resolution={{ width: 16, height: 9 }}>
                <span>contenido</span>
            </Card>
        )
        expect(screen.getByText("Mi media")).toBeTruthy()
        expect(screen.getByText("3")).toBeTruthy()
        expect(screen.getByText("contenido")).toBeTruthy()
        expect(card(container).style.aspectRatio).toBe("16 / 9")
        expect(card(container).getAttribute("data-title")).toBe("")
    })

    it("className_checkered_y_style_se_aplican_al_div_card", () => {
        const { container } = render(<Card label="X" resolution={{ width: 1, height: 1 }} className="context #screen_card" checkered style={{ opacity: 0.5 }} />)
        expect(card(container).classList.contains("context")).toBe(true)
        expect(card(container).classList.contains("#screen_card")).toBe(true)
        expect(card(container).classList.contains("checkered")).toBe(true)
        expect(card(container).style.opacity).toBe("0.5")
    })

    it("outline_y_ancho: width explicito, columnas del store y modo lista", () => {
        const { container } = render(<Card label="X" resolution={{ width: 1, height: 1 }} outlineColor="red" width={25} />)
        expect(principal(container).style.outline).toBe("red solid 2px")
        expect(principal(container).style.width).toBe("25%")

        cleanup()
        const { container: sinAncho } = render(<Card label="X" resolution={{ width: 1, height: 1 }} />)
        expect(principal(sinAncho).style.width).toBe("25%") // 100 / 4 columnas
        expect(principal(sinAncho).style.flexDirection).toBe("column")

        cleanup()
        const { container: lista } = render(<Card label="X" resolution={{ width: 1, height: 1 }} mode="list" />)
        expect(principal(lista).style.width).toBe("100%")
        expect(principal(lista).style.flexDirection).toBe("row")
    })

    it("preview_y_active_ponen_sus_clases_y_cambian_el_overlay", () => {
        const { container } = render(<Card label="X" resolution={{ width: 1, height: 1 }} preview active />)
        expect(principal(container).classList.contains(styles.preview)).toBe(true)
        expect(principal(container).classList.contains(styles.active)).toBe(true)
        const overlay = container.querySelector(`.${styles.overlay}`) as HTMLElement
        expect(overlay.classList.contains(styles.hover)).toBe(false)
    })

    it("reenvia_los_eventos_del_over_y_del_card", () => {
        const eventos = { onMouseDown: vi.fn(), onClick: vi.fn(), onDblClick: vi.fn(), onMouseEnter: vi.fn(), onMouseLeave: vi.fn(), onMouseMove: vi.fn() }
        const { container } = render(<Card label="X" resolution={{ width: 1, height: 1 }} {...eventos} />)
        fireEvent.mouseDown(over(container))
        fireEvent.click(over(container))
        fireEvent.doubleClick(over(container))
        fireEvent.mouseEnter(card(container))
        fireEvent.mouseLeave(card(container))
        fireEvent.mouseMove(card(container))
        for (const callback of Object.values(eventos)) expect(callback).toHaveBeenCalledTimes(1)
    })

    it("Enter_sobre_el_over_dispara_el_click_local", () => {
        const onClick = vi.fn()
        const { container } = render(<Card label="X" resolution={{ width: 1, height: 1 }} onClick={onClick} />)
        fireEvent.keyDown(over(container), { key: "Enter" })
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("showPlayOnHover_muestra_play_y_el_titulo_segun_active", () => {
        const { container } = render(<Card label="X" resolution={{ width: 1, height: 1 }} showPlayOnHover />)
        expect(card(container).getAttribute("data-title")).toBe("Reproducir")
        expect(card(container).querySelector("svg")).not.toBeNull()

        cleanup()
        const { container: activa } = render(<Card label="X" resolution={{ width: 1, height: 1 }} showPlayOnHover active />)
        expect(card(activa).getAttribute("data-title")).toBe("Quitar")
    })

    it("showApplyOnHover_solo_muestra_export_cuando_no_esta_activa", () => {
        const { container } = render(<Card label="X" resolution={{ width: 1, height: 1 }} showApplyOnHover />)
        expect(card(container).querySelector("svg")).not.toBeNull()
        cleanup()
        const { container: activa } = render(<Card label="X" resolution={{ width: 1, height: 1 }} showApplyOnHover active />)
        expect(card(activa).querySelector("svg")).toBeNull()
    })

    it("loaded_false_monta_el_Loader_como_isla", () => {
        const { container } = render(<Card label="X" resolution={{ width: 1, height: 1 }} loaded={false} />)
        expect(islands.Loader).toBeDefined()
        expect(container.querySelector("[data-isla='Loader']")).toBeTruthy()
    })
})

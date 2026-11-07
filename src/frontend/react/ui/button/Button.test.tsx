// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../stores"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import iconStyles from "../../helpers/Icon.module.css"
import { Button } from "./Button"
import styles from "./Button.module.css"

// Corta el ciclo utils/language → utils/common → … → historyHelpers, que llama translateText al cargar (antes de que
// language termine). language usa isMainWindow sólo dentro de setLanguage, así que el mock no cambia lo probado.
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false }))

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Button", () => {
    it("renderiza_lo_principal", () => {
        render(<Button>Guardar</Button>)
        expect(screen.getByRole("button", { name: "Guardar" })).toBeTruthy()
    })

    it("traduce_el_title_en_data_title", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { new: { slide: "Nueva diapositiva" } })])
        render(<Button title="new.slide" />)
        expect(screen.getByRole("button").getAttribute("data-title")).toBe("Nueva diapositiva")
    })

    it("click_llama_a_onClick_con_el_detail_y_el_evento", () => {
        const onClick = vi.fn()
        render(<Button onClick={onClick}>Ok</Button>)
        const btn = screen.getByRole("button")
        fireEvent.click(btn)
        expect(onClick).toHaveBeenCalledTimes(1)
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ ctrl: false, shift: false, alt: false, doubleClick: false, target: btn }), expect.anything())
    })

    it("click_con_ctrl_o_meta_y_shift_marca_los_modificadores", () => {
        const onClick = vi.fn()
        render(<Button onClick={onClick}>Ok</Button>)
        fireEvent.click(screen.getByRole("button"), { metaKey: true, shiftKey: true })
        expect(onClick.mock.calls[0][0]).toEqual(expect.objectContaining({ ctrl: true, shift: true, alt: false }))
    })

    it("doble_click_llama_a_onDblClick_y_no_a_onClick", () => {
        const onClick = vi.fn()
        const onDblClick = vi.fn()
        render(
            <Button onClick={onClick} onDblClick={onDblClick}>
                Ok
            </Button>
        )
        fireEvent.doubleClick(screen.getByRole("button"))
        expect(onDblClick).toHaveBeenCalledTimes(1)
        expect(onClick).not.toHaveBeenCalled()
    })

    it("enter_y_espacio_disparan_onClick_por_teclado", () => {
        const onClick = vi.fn()
        render(<Button onClick={onClick}>Ok</Button>)
        const btn = screen.getByRole("button")
        fireEvent.keyDown(btn, { key: "Enter" })
        fireEvent.keyDown(btn, { key: " " })
        expect(onClick).toHaveBeenCalledTimes(2)
    })

    it("deshabilitado_no_dispara_por_teclado", () => {
        const onClick = vi.fn()
        render(
            <Button disabled onClick={onClick}>
                Ok
            </Button>
        )
        fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" })
        expect(onClick).not.toHaveBeenCalled()
    })

    it("variantes_y_tamanos", () => {
        const casos: [Parameters<typeof Button>[0], string[]][] = [
            [{ variant: "default", size: "md" }, [styles.default, styles.md]],
            [{ variant: "outline", size: "xs" }, [styles.outlined, styles.xs]],
            [{ variant: "live", size: "icon" }, [styles.live, styles.icon]],
            [{ variant: "destructive", size: "icon-sm" }, [styles.destructive, styles["icon-sm"]]],
            [{ variant: "link" }, [styles.link]],
            [{ variant: "secondary", isActive: true }, [styles.secondary, styles.isActive]],
            [{ red: true, redHover: true, bold: true }, [styles.red, styles.redHover, styles.bold]],
            [{ tab: true, showOutline: true, align: "start" }, [styles.tab, styles.showOutline, styles.start]]
        ]
        for (const [props, clases] of casos) {
            const { unmount } = render(<Button {...props}>x</Button>)
            const btn = screen.getByRole("button")
            for (const clase of clases) expect(btn.classList.contains(clase)).toBe(true)
            unmount()
        }
    })

    it("outline_no_usa_la_clase_outline_de_tailwind", () => {
        render(<Button variant="outline">x</Button>)
        expect(screen.getByRole("button").classList.contains("outline")).toBe(false)
    })

    it("sin_children_con_icon_es_solo_icono_blanco", () => {
        const { container } = render(<Button icon="add" />)
        const btn = screen.getByRole("button")
        expect(btn.classList.contains(styles.iconOnly)).toBe(true)
        expect(container.querySelector("svg")?.classList.contains(iconStyles.white)).toBe(true)
    })

    it("info_se_muestra_en_un_span", () => {
        render(<Button info="Ctrl+K">Buscar</Button>)
        expect(screen.getByText("Ctrl+K").classList.contains(styles.info)).toBe(true)
    })
})

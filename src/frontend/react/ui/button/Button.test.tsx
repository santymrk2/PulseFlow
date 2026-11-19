// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../shared/core/stores"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { commonMock } from "../../test/mockCommon"
import iconStyles from "../../helpers/Icon.module.css"
import { BUTTON_SIZE, BUTTON_VARIANT, Button, type ButtonProps, type ButtonVariant } from "./Button"
import styles from "./Button.module.css"

vi.mock("../../../utils/common", () => commonMock())

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
        const claseDe = (variante: ButtonVariant) => (variante === "outline" ? styles.outlined : styles[variante])
        for (const variante of Object.values(BUTTON_VARIANT)) {
            for (const tamano of Object.values(BUTTON_SIZE)) {
                const { unmount } = render(
                    <Button variant={variante} size={tamano}>
                        x
                    </Button>
                )
                const btn = screen.getByRole("button")
                expect(btn.classList.contains(claseDe(variante))).toBe(true)
                for (const otra of Object.values(BUTTON_VARIANT)) if (otra !== variante) expect(btn.classList.contains(claseDe(otra))).toBe(false)
                // `sm` no tiene regla CSS: el módulo no la exporta y el botón no lleva clase de tamaño
                if (tamano !== "sm") expect(btn.classList.contains(styles[tamano])).toBe(true)
                for (const otro of Object.values(BUTTON_SIZE)) if (otro !== tamano && otro !== "sm") expect(btn.classList.contains(styles[otro])).toBe(false)
                unmount()
            }
        }
    })

    it("por_defecto_es_ghost_y_sm", () => {
        render(<Button>x</Button>)
        const btn = screen.getByRole("button")
        expect(btn.classList.contains(styles.ghost)).toBe(true)
        expect(btn.classList.contains(styles.md)).toBe(false)
        expect(btn.classList.contains(styles.xs)).toBe(false)
        expect(btn.classList.contains(styles.icon)).toBe(false)
    })

    it("banderas_de_estado_y_forma", () => {
        const casos: [ButtonProps, string[]][] = [
            [{ isActive: true }, [styles.isActive, "isActive"]], // "isActive" sin módulo: el CSS global de FloatingBar/InputRow apunta a button.isActive
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

    it("onNativeClick_va_antes_que_onClick_fuera_de_edit", () => {
        const orden: string[] = []
        render(
            <Button onNativeClick={() => orden.push("nativo")} onClick={() => orden.push("on:click")}>
                Ok
            </Button>
        )
        fireEvent.click(screen.getByRole("button"))
        expect(orden).toEqual(["nativo", "on:click"])
    })

    it("dentro_de_edit_onNativeClick_se_llama_y_onClick_no", () => {
        const onNativeClick = vi.fn()
        const onClick = vi.fn()
        render(
            <div className="edit">
                <Button onNativeClick={onNativeClick} onClick={onClick}>
                    Ok
                </Button>
            </div>
        )
        fireEvent.click(screen.getByRole("button"))
        expect(onNativeClick).toHaveBeenCalledTimes(1)
        expect(onClick).not.toHaveBeenCalled()
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

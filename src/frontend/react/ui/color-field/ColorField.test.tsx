// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { defaultColors, defaultGradients, getContrast } from "../../../components/helpers/color"
import { activePopup, popupData, special } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { ColorField } from "./ColorField"
import styles from "./ColorField.module.css"
import tabsStyles from "../../main/Tabs.module.css"

vi.mock("../../../utils/common", () => commonMock())
// edit.ts arrastra medio frontend; ColorField sólo usa dos funciones puras de gradientes: se mockea el borde
vi.mock("../../../components/edit/scripts/edit", () => ({
    getGradientOpacity: (value: string) => (value.includes("alpha") ? 0.4 : 1),
    addOpacityToGradient: vi.fn((value: string, alpha: number) => `${value}@${alpha}`)
}))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
// Vitest corre en node y Svelte resuelve su build de servidor (mount no existe); acá se fuerza el de cliente
vi.mock("svelte", async () => vi.importActual("../../../../../node_modules/svelte/src/index-client.js"))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
    vi.restoreAllMocks()
})

const raiz = () => document.querySelector(".textfield") as HTMLElement
const display = () => document.querySelector(`.${styles.colorDisplay}`) as HTMLElement
const picker = () => document.querySelector(`.${styles.picker}`) as HTMLElement | null
const swatches = () => Array.from(document.querySelectorAll(".pickColor")) as HTMLElement[]
const colorInput = () => document.querySelector("input.colorpicker") as HTMLInputElement
const tabsButtons = () => Array.from(document.querySelectorAll(`.${tabsStyles.tabs} button`)) as HTMLElement[]
const abrir = () => fireEvent.click(display())
const limpiar = () => (restaurar = setStoresForTest([storeEntry(special, {}), storeEntry(activePopup, null), storeEntry(popupData, {})]))
const hex = (n: number) => defaultColors[n].value

// Registra change e input en orden, leyendo el valor dentro del handler
const registrar = () => {
    const eventos: { tipo: string; valor: string }[] = []
    return { eventos, onChange: (v: string) => eventos.push({ tipo: "change", valor: v }), onInput: (v: string) => eventos.push({ tipo: "input", valor: v }) }
}

describe("ColorField", () => {
    it("renderiza_lo_principal", () => {
        limpiar()
        render(<ColorField label="Fondo" value="#336699" />)
        expect(raiz().id.startsWith("picker_")).toBe(true)
        expect(raiz().getAttribute("tabindex")).toBe("0")
        expect(raiz().getAttribute("aria-disabled")).toBe("false")
        expect(raiz().style.getPropertyValue("--outline-color")).toBe(getContrast("#336699"))
        expect(display().style.background).toBe("#336699")
        expect(display().getAttribute("data-title")).toBe("<i>#336699</i>")
        expect(screen.getByText("Fondo")).toBeTruthy()
        expect(picker()).toBeNull()
    })

    it("noLabel_pone_la_etiqueta_en_el_titulo_y_la_oculta_salvo_sin_value", () => {
        limpiar()
        const { rerender } = render(<ColorField label="Fondo" value="#336699" noLabel />)
        expect(document.querySelector("label")).toBeNull()
        expect(display().getAttribute("data-title")).toBe("Fondo: <i>#336699</i>")
        expect(display().style.marginLeft).toBe("var(--margin)")
        rerender(<ColorField label="Fondo" value="" noLabel />)
        expect(document.querySelector("label")?.textContent).toBe("Fondo")
        expect(display().getAttribute("data-title")).toBe("Fondo<i></i>")
    })

    it("click_en_el_color_o_en_el_fondo_abre_y_cierra_el_selector", () => {
        limpiar()
        render(<ColorField label="x" value="#336699" />)
        abrir()
        expect(picker()).toBeTruthy()
        fireEvent.click(document.querySelector(`.${styles.background}`) as HTMLElement)
        expect(picker()).toBeNull()
    })

    it("elegir_un_color_despacha_change_y_luego_input_y_cierra", () => {
        limpiar()
        const { eventos, onChange, onInput } = registrar()
        render(<ColorField label="x" value="#336699" onChange={onChange} onInput={onInput} />)
        abrir()
        expect(swatches().length).toBe(defaultColors.length)
        fireEvent.click(swatches()[3])
        expect(eventos).toEqual([
            { tipo: "change", valor: hex(3) },
            { tipo: "input", valor: hex(3) }
        ])
        expect(picker()).toBeNull()
    })

    it("marca_el_color_activo_sin_distinguir_mayusculas", () => {
        limpiar()
        render(<ColorField label="x" value={hex(3).toLowerCase()} />)
        abrir()
        const activos = swatches().filter((s) => s.classList.contains(styles.active))
        expect(activos.length).toBe(1)
        expect(activos[0].getAttribute("data-value")).toBe(hex(3))
        expect(activos[0].getAttribute("data-title")).toBe(defaultColors[3].name)
    })

    it("un_value_rgb_se_muestra_como_hex_y_su_alpha_como_opacidad", () => {
        limpiar()
        render(<ColorField label="x" value="rgb(255 0 0 / 0.5)" allowOpacity />)
        abrir()
        expect((document.querySelector("input.colorpicker") as HTMLInputElement).value).toBe("#ff0000")
        expect((document.querySelector(".textfield input[type='text']") as HTMLInputElement).value).toBe("50")
    })

    it("con_allowOpacity_y_opacidad_menor_a_100_el_color_elegido_sale_en_rgb_con_alpha", () => {
        limpiar()
        const { eventos, onChange, onInput } = registrar()
        render(<ColorField label="x" value="rgb(10 20 30 / 0.5)" allowOpacity onChange={onChange} onInput={onInput} />)
        abrir()
        fireEvent.click(swatches()[3]) // #FF4136
        expect(eventos[0]).toEqual({ tipo: "change", valor: "rgb(255 65 54 / 0.5)" })
        expect(eventos[1]).toEqual({ tipo: "input", valor: "rgb(255 65 54 / 0.5)" })
    })

    it("sin_allowOpacity_el_color_sale_tal_cual", () => {
        limpiar()
        const { eventos, onChange } = registrar()
        render(<ColorField label="x" value="rgb(10 20 30 / 0.5)" onChange={onChange} />)
        abrir()
        fireEvent.click(swatches()[3])
        expect(eventos[0].valor).toBe(hex(3))
    })

    it("la_opacidad_en_0_se_restablece_a_100_al_hacer_click_en_un_color", () => {
        limpiar()
        const { eventos, onChange } = registrar()
        render(<ColorField label="x" value="rgb(10 20 30 / 0)" allowOpacity onChange={onChange} />)
        abrir()
        fireEvent.click(swatches()[3])
        expect(eventos[0].valor).toBe(hex(3))
    })

    it("el_campo_de_opacidad_reenvia_el_cambio_con_demora_de_50ms_y_sin_cerrar", () => {
        limpiar()
        vi.useFakeTimers()
        const { eventos, onChange, onInput } = registrar()
        render(<ColorField label="x" value="#ff0000" allowOpacity onChange={onChange} onInput={onInput} />)
        act(() => {
            vi.advanceTimersByTime(1)
        })
        abrir()
        const opacidad = document.querySelector(".textfield input[type='text']") as HTMLInputElement
        fireEvent.change(opacidad, { target: { value: "50" } })
        expect(eventos).toEqual([])
        act(() => {
            vi.advanceTimersByTime(50)
        })
        expect(eventos).toEqual([
            { tipo: "change", valor: "rgb(255 0 0 / 0.5)" },
            { tipo: "input", valor: "rgb(255 0 0 / 0.5)" }
        ])
        expect(picker()).toBeTruthy()
    })

    it("un_cambio_de_value_del_padre_suprime_el_reenvio_de_opacidad_hasta_el_proximo_tick", () => {
        limpiar()
        vi.useFakeTimers()
        const { eventos, onChange } = registrar()
        const { rerender } = render(<ColorField label="x" value="rgb(255 0 0 / 0.5)" allowOpacity onChange={onChange} />)
        act(() => {
            vi.advanceTimersByTime(1)
        })
        rerender(<ColorField label="x" value="rgb(0 255 0 / 0.25)" allowOpacity onChange={onChange} />)
        act(() => {
            vi.advanceTimersByTime(100)
        })
        expect(eventos).toEqual([])
    })

    it("allowEmpty_agrega_la_opcion_sin_color_que_despacha_cadena_vacia", () => {
        limpiar()
        const { eventos, onChange } = registrar()
        render(<ColorField label="x" value="#336699" allowEmpty onChange={onChange} />)
        abrir()
        const sinColor = document.querySelector(".noColor") as HTMLElement
        expect(sinColor.getAttribute("data-value")).toBe("")
        expect(sinColor.getAttribute("data-title")).toBe("settings.remove")
        fireEvent.click(sinColor)
        expect(eventos[0]).toEqual({ tipo: "change", valor: "" })
        expect(picker()).toBeNull()
    })

    it("alwaysVisible_no_tiene_barra_y_muestra_el_selector_que_no_se_cierra", () => {
        limpiar()
        render(<ColorField label="x" value="#336699" alwaysVisible />)
        expect(display()).toBeNull()
        expect(picker()?.classList.contains(styles.alwaysVisible)).toBe(true)
        expect(picker()?.classList.contains("alwaysVisible")).toBe(false)
        fireEvent.click(swatches()[0])
        expect(picker()).toBeTruthy()
    })

    it("Enter_y_espacio_alternan_el_selector_y_Escape_lo_cierra_y_devuelve_el_foco", () => {
        limpiar()
        vi.useFakeTimers()
        render(<ColorField label="x" value="#336699" />)
        fireEvent.keyDown(raiz(), { key: "Enter" })
        expect(picker()).toBeTruthy()
        fireEvent.keyDown(raiz(), { key: " " })
        expect(picker()).toBeNull()
        fireEvent.keyDown(raiz(), { key: "Escape" })
        expect(picker()).toBeNull()
        fireEvent.keyDown(raiz(), { key: "Enter" })
        expect(fireEvent.keyDown(raiz(), { key: "Escape" })).toBe(false)
        expect(picker()).toBeNull()
        act(() => {
            vi.runAllTimers()
        })
        expect(document.activeElement).toBe(raiz())
    })

    it("Enter_sobre_un_color_lo_elige_y_Enter_dentro_del_selector_nativo_no_alterna", () => {
        limpiar()
        const { eventos, onChange } = registrar()
        render(<ColorField label="x" value="#336699" onChange={onChange} />)
        abrir()
        fireEvent.keyDown(colorInput(), { key: "Enter" })
        expect(picker()).toBeTruthy()
        fireEvent.keyDown(swatches()[4], { key: "Enter" })
        expect(eventos[0]).toEqual({ tipo: "change", valor: hex(4) })
    })

    it("mousedown_fuera_cierra_y_dentro_del_componente_no", () => {
        limpiar()
        render(<ColorField label="x" value="#336699" />)
        abrir()
        fireEvent.mouseDown(swatches()[0])
        expect(picker()).toBeTruthy()
        fireEvent.mouseDown(document.body)
        expect(picker()).toBeNull()
    })

    it("el_selector_nativo_despacha_input_por_tecla_y_change_nativo", () => {
        limpiar()
        const { eventos, onChange, onInput } = registrar()
        render(<ColorField label="x" value="#336699" onChange={onChange} onInput={onInput} />)
        abrir()
        fireEvent.input(colorInput(), { target: { value: "#112233" } })
        expect(eventos).toEqual([{ tipo: "input", valor: "#112233" }])
        fireEvent.change(colorInput(), { target: { value: "#445566" } })
        expect(eventos.at(-1)).toEqual({ tipo: "change", valor: "#445566" })
        expect(display().style.background).toBe("#336699") // el display muestra la prop value
    })

    it("height_y_width_dimensionan_el_selector_nativo", () => {
        limpiar()
        render(<ColorField label="x" value="#336699" height={30} width={60} />)
        abrir()
        expect(colorInput().style.height).toBe("30px")
        expect(colorInput().style.width).toBe("60px")
    })

    it("editMode_no_transforma_el_valor_y_agrega_los_personalizados_tras_un_BREAK", () => {
        restaurar = setStoresForTest([storeEntry(special, { customColors: ["#123456"], disabledColors: [hex(0)] }), storeEntry(activePopup, null), storeEntry(popupData, {})])
        const { eventos, onChange } = registrar()
        render(<ColorField label="x" value="#336699" editMode onChange={onChange} />)
        abrir()
        // editMode: no se filtran los deshabilitados y los personalizados van después del corte
        expect(swatches().length).toBe(defaultColors.length + 1)
        expect(swatches().every((s) => !s.classList.contains(styles.active))).toBe(true)
        expect(swatches()[0].classList.contains(styles.disabled)).toBe(true)
        expect(document.querySelectorAll(`.${styles.hover}`).length).toBe(defaultColors.length + 1)
        fireEvent.click(swatches()[defaultColors.length])
        expect(eventos[0]).toEqual({ tipo: "change", valor: "#123456" })
    })

    it("fuera_de_editMode_se_ocultan_los_deshabilitados_y_se_suman_los_personalizados", () => {
        restaurar = setStoresForTest([storeEntry(special, { customColors: ["#123456"], disabledColors: [hex(0), hex(1)] }), storeEntry(activePopup, null), storeEntry(popupData, {})])
        render(<ColorField label="x" value="#336699" />)
        abrir()
        expect(swatches().length).toBe(defaultColors.length - 2 + 1)
        expect(swatches()[0].getAttribute("data-value")).toBe(hex(2))
        expect(document.querySelectorAll(`.${styles.hover}`).length).toBe(0)
    })

    it("disabled_aplica_la_clase_y_no_abre_ni_responde_al_teclado", () => {
        limpiar()
        render(<ColorField label="x" value="#336699" disabled />)
        expect(raiz().classList.contains(styles.disabled)).toBe(true)
        expect(raiz().getAttribute("tabindex")).toBe("-1")
        expect(raiz().getAttribute("aria-disabled")).toBe("true")
        abrir()
        fireEvent.keyDown(raiz(), { key: "Enter" })
        expect(picker()).toBeNull()
    })

    it("reset_elige_el_defaultValue_y_deshacer_devuelve_el_anterior_hasta_3s", () => {
        limpiar()
        vi.useFakeTimers()
        const { eventos, onChange } = registrar()
        const { rerender } = render(<ColorField label="x" value="#336699" defaultValue="#112233" onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.reset"]') as HTMLElement)
        expect(eventos[0]).toEqual({ tipo: "change", valor: "#112233" })

        rerender(<ColorField label="x" value="#112233" defaultValue="#112233" onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.undo"]') as HTMLElement)
        expect(eventos.at(-1)).toEqual({ tipo: "change", valor: "#336699" })

        rerender(<ColorField label="x" value="#336699" defaultValue="#336699" onChange={onChange} />)
        expect(document.querySelector('[data-title="actions.undo"]')).toBeNull()
    })

    it("el_selector_se_corre_a_la_derecha_si_no_entra_en_la_ventana", () => {
        limpiar()
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: window.innerWidth + 1000 } as DOMRect)
        render(<ColorField label="x" value="#336699" />)
        abrir()
        expect(picker()?.classList.contains(styles.isOverflowing)).toBe(true)
    })

    it("noLabel_sin_desborde_alinea_el_selector_a_la_izquierda", () => {
        limpiar()
        render(<ColorField label="x" value="#336699" noLabel />)
        abrir()
        expect(picker()?.style.left).toBe("0px")
        expect(picker()?.style.transform).toBe("initial")
    })

    describe("degradados", () => {
        const degradado = defaultGradients[1].value

        it("allowGradients_muestra_las_pestañas_y_el_modo_sale_del_value", async () => {
            limpiar()
            render(<ColorField label="x" value={degradado} allowGradients />)
            abrir()
            await waitFor(() => expect(tabsButtons().length).toBe(2))
            expect(swatches().length).toBe(defaultGradients.length)
            expect(swatches().filter((s) => s.classList.contains(styles.active)).length).toBe(1)
            expect(swatches()[0].getAttribute("aria-label")).toContain("Select gradient")
        })

        it("sin_allowGradients_ni_editMode_no_hay_pestañas_y_se_ve_el_modo_normal", () => {
            limpiar()
            render(<ColorField label="x" value={degradado} />)
            abrir()
            expect(document.querySelector(`.${tabsStyles.tabs}`)).toBeNull()
            expect(swatches().length).toBe(defaultColors.length)
        })

        it("cambiar_de_pestaña_cambia_la_lista_y_un_value_nuevo_la_recalcula", async () => {
            limpiar()
            const { rerender } = render(<ColorField label="x" value="#336699" allowGradients />)
            abrir()
            await waitFor(() => expect(tabsButtons().length).toBe(2))
            expect(swatches().length).toBe(defaultColors.length)
            fireEvent.click(tabsButtons()[1])
            await waitFor(() => expect(swatches().length).toBe(defaultGradients.length))
            rerender(<ColorField label="x" value="#445566" allowGradients />)
            await waitFor(() => expect(swatches().length).toBe(defaultColors.length))
        })

        it("elegir_un_degradado_despacha_change_y_input_con_su_valor", () => {
            limpiar()
            const { eventos, onChange, onInput } = registrar()
            render(<ColorField label="x" value={degradado} allowGradients onChange={onChange} onInput={onInput} />)
            abrir()
            fireEvent.click(swatches()[2])
            expect(eventos).toEqual([
                { tipo: "change", valor: defaultGradients[2].value },
                { tipo: "input", valor: defaultGradients[2].value }
            ])
        })

        it("la_opacidad_de_un_degradado_sale_del_valor_y_se_aplica_con_addOpacityToGradient", () => {
            limpiar()
            const { eventos, onChange } = registrar()
            render(<ColorField label="x" value={`${degradado} alpha`} allowGradients allowOpacity onChange={onChange} />)
            abrir()
            expect((document.querySelector(".textfield input[type='text']") as HTMLInputElement).value).toBe("40")
            fireEvent.click(swatches()[2])
            expect(eventos[0].valor).toBe(`${defaultGradients[2].value}@0.4`)
        })

        it("el_boton_de_color_personalizado_abre_color_gradient_con_el_valor_y_un_trigger", () => {
            limpiar()
            const { eventos, onChange } = registrar()
            render(<ColorField label="x" value={degradado} allowGradients onChange={onChange} />)
            abrir()
            const boton = document.querySelector(`.${styles.customButton}`) as HTMLElement
            expect(boton.textContent).toBe("actions.choose_custom")
            fireEvent.click(boton)
            expect(get(activePopup)).toBe("color_gradient")
            const data = get(popupData)
            expect(data.value).toBe(degradado)
            data.trigger("linear-gradient(red, blue)")
            expect(eventos[0]).toEqual({ tipo: "change", valor: "linear-gradient(red, blue)" })
        })

        it("en_editMode_el_trigger_vuelve_a_manage_colors_en_el_siguiente_tick", () => {
            limpiar()
            vi.useFakeTimers()
            render(<ColorField label="x" value={degradado} editMode allowGradients />)
            abrir()
            const boton = document.querySelector(`.${styles.customButton}`) as HTMLElement
            expect(boton.textContent).toBe("actions.add_color")
            fireEvent.click(boton)
            get(popupData).trigger("linear-gradient(red, blue)")
            expect(get(activePopup)).toBe("color_gradient")
            act(() => {
                vi.runAllTimers()
            })
            expect(get(activePopup)).toBe("manage_colors")
        })
    })
})

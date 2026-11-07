// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { selected } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { dictionary } from "../../../stores"
import { Tabs } from "./Tabs"
import styles from "./Tabs.module.css"

vi.mock("../../../utils/common", () => commonMock())
// SelectElem arrastra (vía helpers) el módulo de audio, que necesita AudioContext/AudioWorkletNode (no existen en happy-dom)
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

const perfiles = [{ id: "" }, { id: "a" }, { id: "b", stageOutput: true }]
const pestanas = () => Array.from(document.querySelectorAll("button.tab")) as HTMLButtonElement[]

describe("Tabs", () => {
    it("renderiza_lo_principal", async () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { settings: { add: "Agregar" } })])
        render(
            <Tabs id="profile" tabs={perfiles} value="a">
                {(tab) => <span>pestana-{tab.id || "admin"}</span>}
            </Tabs>
        )
        expect(screen.getByText("pestana-admin")).toBeTruthy()
        expect(screen.getByText("pestana-a")).toBeTruthy()
        expect(pestanas()).toHaveLength(3)
        expect(pestanas().map((b) => b.classList.contains(styles.active))).toEqual([false, true, false])
        // cada pestaña vive dentro del SelectElem
        expect(pestanas()[0].parentElement?.classList.contains("selectElem")).toBe(true)
        // con más de una pestaña el botón de crear es un "+" chico, sin texto
        expect(screen.queryByText("Agregar")).toBeNull()
    })

    it("con_una_sola_pestana_o_ninguna_muestra_solo_el_boton_con_texto", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { settings: { add: "Agregar" } })])
        render(<Tabs id="profile" tabs={[{ id: "a" }]} value="a" />)
        expect(pestanas()).toHaveLength(0)
        expect(screen.getByText("Agregar")).toBeTruthy()
    })

    it("newLabel_se_traduce", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { new: { profile: "Nuevo perfil" } })])
        render(<Tabs id="profile" tabs={[]} value="" newLabel="new.profile" />)
        expect(screen.getByText("Nuevo perfil")).toBeTruthy()
    })

    it("click_en_una_pestana_despacha_onOpen_con_su_id", async () => {
        const onOpen = vi.fn()
        render(
            <Tabs id="profile" tabs={perfiles} value="a" onOpen={onOpen}>
                {(tab) => <span>p-{tab.id}</span>}
            </Tabs>
        )
        await screen.findByText("p-a")
        fireEvent.click(screen.getByText("p-b"))
        expect(onOpen).toHaveBeenCalledWith("b")
        fireEvent.click(screen.getByText("p-"))
        expect(onOpen).toHaveBeenLastCalledWith("")
    })

    it("clic_derecho_en_una_pestana_la_selecciona_via_SelectElem", async () => {
        restaurar = setStoresForTest([storeEntry(selected, { id: null, data: [] })])
        render(
            <Tabs id="profile" tabs={perfiles} value="a">
                {(tab) => <span>p-{tab.id}</span>}
            </Tabs>
        )
        fireEvent.mouseDown(await screen.findByText("p-b"), { button: 2 })
        let actual: unknown
        selected.subscribe((s) => (actual = s))()
        expect(actual).toEqual({ id: "profile", data: [{ id: "b" }] })
    })

    it("crear_despacha_onCreate_con_el_detail_del_boton", () => {
        vi.useFakeTimers()
        const onCreate = vi.fn()
        render(<Tabs id="profile" tabs={perfiles} value="a" onCreate={onCreate} />)
        const crear = document.querySelector("button.small_add") as HTMLButtonElement
        fireEvent.click(crear, { ctrlKey: true })
        expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ ctrl: true, shift: false, alt: false, doubleClick: false, target: crear }))
        act(() => {
            vi.advanceTimersByTime(110)
        })
    })

    it("el_boton_de_crear_es_small_add_solo_con_mas_de_una_pestana", () => {
        const { rerender } = render(<Tabs id="profile" tabs={perfiles} value="a" />)
        expect(document.querySelector("button.small_add")).toBeTruthy()
        rerender(<Tabs id="profile" tabs={[]} value="a" />)
        expect(document.querySelector("button.small_add")).toBeNull()
    })

    it("la_clase_del_padre_llega_a_cada_pestana_con_los_sufijos_de_perfil_admin_y_stage_output", async () => {
        const { rerender } = render(
            <Tabs id="profile" tabs={perfiles} value="a" className="context #profile_tab">
                {(tab) => <span>p-{tab.id}</span>}
            </Tabs>
        )
        await screen.findByText("p-a")
        expect(pestanas().map((b) => b.classList.contains("context"))).toEqual([true, true, true])
        expect(pestanas()[0].classList.contains("#profile_tab_admin")).toBe(true)
        expect(pestanas()[1].classList.contains("#profile_tab")).toBe(true)
        rerender(
            <Tabs id="stage" tabs={perfiles} value="a" className="output">
                {(tab) => <span>p-{tab.id}</span>}
            </Tabs>
        )
        expect(pestanas().map((b) => b.classList.contains("output_stage"))).toEqual([false, false, true])
    })

    it("conserva_la_clase_tab_global", async () => {
        render(<Tabs id="profile" tabs={perfiles} value="a" />)
        await screen.findAllByRole("button")
        expect(pestanas().every((b) => b.classList.contains("tab"))).toBe(true)
    })

    it("al_montar_mide_el_scroll_cuando_los_botones_ya_existen", async () => {
        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth")
        Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
            configurable: true,
            get(this: HTMLElement) {
                // sólo hay overflow cuando los botones de las pestañas ya existen
                return this.querySelector("button.tab") ? 500 : 0
            }
        })
        Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 100 })
        try {
            const { container } = render(
                <Tabs id="profile" tabs={perfiles} value="a">
                    {(tab) => <span>p-{tab.id}</span>}
                </Tabs>
            )
            await screen.findByText("p-a")
            expect(container.querySelector(`.${styles.tabs}`)?.classList.contains(styles.isScrollable)).toBe(true)
        } finally {
            if (original) Object.defineProperty(HTMLElement.prototype, "scrollWidth", original)
            else delete (HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth
            delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth
        }
    })
})

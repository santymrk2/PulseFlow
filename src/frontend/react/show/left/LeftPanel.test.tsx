// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { LeftPanel } from "./LeftPanel"
import styles from "./LeftPanel.module.css"

afterEach(() => cleanup())

describe("LeftPanel", () => {
    it("renderiza_el_marco_con_titulo_contexto_contador_acciones_y_cuerpo", () => {
        const { container } = render(
            <LeftPanel title="BIBLIOTECAS" context="General" count={3} actions={<button>Acción</button>}>
                <p>Contenido</p>
            </LeftPanel>
        )

        const section = container.querySelector('[data-slot="left-panel"]') as HTMLElement
        expect(section.className).toContain(styles.root)
        const header = section.querySelector("header") as HTMLElement
        expect(header.className).toContain(styles.header)
        expect(screen.getByText("BIBLIOTECAS")).toBeTruthy()
        expect(screen.getByText("General").className).toContain(styles.context)
        expect(screen.getByText("3").className).toContain(styles.count)
        expect(screen.getByText("Acción")).toBeTruthy()
        expect(screen.getByText("Contenido")).toBeTruthy()
        expect((header.lastElementChild as HTMLElement).className).toContain(styles.actions)
    })

    it("oculta_la_pastilla_y_el_contador_cuando_no_hay_contexto_o_count", () => {
        const { container } = render(
            <LeftPanel title="ÍTEMS" count={null}>
                <span>Cuerpo</span>
            </LeftPanel>
        )
        const header = container.querySelector("header") as HTMLElement
        expect(header.querySelector(".bg-primary")).toBeNull()
        expect(header.querySelector(".text-muted-foreground")).toBeNull()
        expect(header.children).toHaveLength(1)
        expect(container.querySelector("section > div")?.className).toContain(styles.body)
    })

    it("muestra_el_contador_cero_pero_no_los_valores_undefined", () => {
        const { rerender } = render(<LeftPanel title="A" count={0} />)
        expect(screen.getByText("0")).toBeTruthy()
        rerender(<LeftPanel title="A" />)
        expect(screen.queryByText("0")).toBeNull()
    })

    it("inserta_los_slots_HTMLElement_en_sus_contenedores_y_los_retira_al_desmontar", () => {
        const actionsSlot = document.createElement("span")
        actionsSlot.textContent = "Acción Svelte"
        const childrenSlot = document.createElement("div")
        childrenSlot.textContent = "Cuerpo Svelte"

        const { container, unmount } = render(<LeftPanel title="Panel" actionsSlot={actionsSlot} childrenSlot={childrenSlot} />)
        const header = container.querySelector("header") as HTMLElement
        const actionsHost = header.lastElementChild as HTMLElement
        const body = container.querySelector("section > div") as HTMLElement

        expect(actionsHost.contains(actionsSlot)).toBe(true)
        expect(body.contains(childrenSlot)).toBe(true)
        expect(actionsHost.textContent).toBe("Acción Svelte")
        expect(body.textContent).toBe("Cuerpo Svelte")

        unmount()
        expect(actionsSlot.parentNode).toBeNull()
        expect(childrenSlot.parentNode).toBeNull()
    })

    it("permite_react_children_y_slots_a_la_vez", () => {
        const childrenSlot = document.createElement("i")
        childrenSlot.textContent = "Isla"
        const { container } = render(
            <LeftPanel title="Panel" actions={<b>React</b>} childrenSlot={childrenSlot}>
                <span>React body</span>
            </LeftPanel>
        )
        expect(container.textContent).toContain("React")
        expect(container.querySelector("section > div")?.contains(childrenSlot)).toBe(true)
    })
})

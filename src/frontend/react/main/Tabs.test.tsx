// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TabsObj } from "../../../types/Tabs"
import { activePage, dictionary, labelsDisabled, openToolsTab } from "../../shared/core/stores"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Tabs } from "./Tabs"

vi.mock("../../utils/language", () => ({ translateText: (id: string) => id }))

const tabs: TabsObj = {
    effect: { name: "items.effect", icon: "effects" },
    options: { name: "edit.options", icon: "options" },
    overflow: { name: "overflow.tab", icon: "options", overflow: true },
    hidden: { name: "hidden.tab", icon: "close", remove: true }
}

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    restore = () => {}
    vi.useRealTimers()
})

function setStores(page = "show") {
    restore = setStoresForTest([storeEntry(activePage, page), storeEntry(dictionary, {}), storeEntry(labelsDisabled, false), storeEntry(openToolsTab, "")])
}

describe("Tabs", () => {
    it("renderiza las pestañas visibles con labels y marca la activa", () => {
        setStores()
        render(<Tabs tabs={tabs} active="effect" />)
        expect(screen.getByText("items.effect")).toBeTruthy()
        expect(screen.queryByText("hidden.tab")).toBeNull()
        expect(screen.getByTitle("items.effect").classList.contains("isActive")).toBe(true)
        expect(screen.getByTitle("edit.options").classList.contains("isActive")).toBe(false)
    })

    it("labels={false} oculta los textos y onActiveChange devuelve el id pulsado", () => {
        setStores()
        const onActiveChange = vi.fn()
        render(<Tabs tabs={tabs} active="effect" onActiveChange={onActiveChange} labels={false} />)
        expect(screen.queryByText("items.effect")).toBeNull()
        fireEvent.click(screen.getByTitle("edit.options"))
        expect(onActiveChange).toHaveBeenCalledWith("options")
    })

    it("el botón de overflow revela la pestaña oculta y avisa del cambio", async () => {
        setStores()
        const onActiveChange = vi.fn()
        render(<Tabs tabs={tabs} active="effect" onActiveChange={onActiveChange} />)
        const overflowButton = screen.getByTitle("tooltipoptions")
        fireEvent.click(overflowButton)
        expect(onActiveChange).toHaveBeenCalledWith("overflow")
        await waitFor(() => expect(screen.getByTitle("overflow.tab")).toBeTruthy())
    })

    it("openToolsTab cambia la pestaña activa y limpia el store", async () => {
        setStores()
        const onActiveChange = vi.fn()
        render(<Tabs tabs={tabs} active="effect" onActiveChange={onActiveChange} />)
        act(() => {
            openToolsTab.set("options")
        })
        await waitFor(() => expect(onActiveChange).toHaveBeenCalledWith("options"))
        expect(get(openToolsTab)).toBe("")
    })

    it("style se aplica como estilo inline", () => {
        setStores()
        const { container } = render(<Tabs tabs={tabs} active="effect" style="font-weight: normal;" />)
        expect((container.firstElementChild as HTMLElement).style.fontWeight).toBe("normal")
    })
})

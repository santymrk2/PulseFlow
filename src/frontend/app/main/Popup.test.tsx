// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Popups } from "../../../types/Main"
import { get } from "../../shared/core/lib/store"
import { activePopup, popupData } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { storeEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Popup } from "./Popup"

vi.mock("../../shared/utils/common", () => ({ ...commonMock(), MENU_BAR_HEIGHT: 36 }))
vi.mock("../../shared/utils/popup", () => ({ clearPopupSubmit: vi.fn() }))
vi.mock("../wiring/shortcuts", () => ({ disablePopupClose: [] }))
vi.mock("../../shared/audio/effects/audioEffectsHelpers", () => ({ EFFECTS_LIST: [] }))
vi.mock("../../features/popups/registry", () => {
    const stub = (id: string) => () => createElement("div", { "data-testid": `react-${id}` }, id)
    return {
        reactPopups: {
            effect_items: stub("effect_items"),
            looks_roto: () => {
                throw new Error("popup roto")
            },
            add_shows: () => {
                throw new Error("modal roto")
            },
            kit_demo: stub("kit_demo"),
            looks: stub("looks"),
            screen_config: stub("screen_config")
        }
    }
})

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(activePopup, null), storeEntry(popupData, {})] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe("Popup", () => {
    it.each(["effect_items", "kit_demo", "looks", "screen_config"])("monta %s desde el registro React, sin isla Svelte", async (id) => {
        activePopup.set(id as Popups)
        render(<Popup />)
        await act(async () => {})

        expect(screen.getByTestId(`react-${id}`)).toBeTruthy()
        expect(readFileSync("src/frontend/app/main/Popup.tsx", "utf8")).not.toContain("SvelteIsland")
    })

    it("un popup que tira error muestra el panel dentro del popup y no tira el resto", () => {
        vi.spyOn(console, "error").mockImplementation(() => {})
        activePopup.set("looks_roto" as Popups)
        render(
            <>
                <div data-testid="hermano" />
                <Popup />
            </>
        )
        expect(screen.getByTestId("hermano")).toBeTruthy()
        expect(screen.getByRole("alert").textContent).toContain("popup roto")
        fireEvent.click(screen.getByText("Reintentar"))
        expect(get(activePopup)).toBeNull()
    })

    it.each([
        ["card", "looks_roto", "kit_demo"],
        ["modal", "add_shows", "looks"]
    ])("al pasar de un popup roto a otro (%s) sin cerrar, el segundo no hereda el error", async (_tipo, roto, sano) => {
        vi.useFakeTimers()
        vi.spyOn(console, "error").mockImplementation(() => {})
        activePopup.set(roto as Popups)
        render(<Popup />)
        await act(async () => {})
        expect(screen.getByRole("alert")).toBeTruthy()

        activePopup.set(sano as Popups)
        await act(async () => {
            vi.advanceTimersByTime(300)
        })
        expect(screen.getByTestId(`react-${sano}`)).toBeTruthy()
    })
})

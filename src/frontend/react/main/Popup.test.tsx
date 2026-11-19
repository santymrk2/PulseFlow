// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Popups } from "../../../types/Main"
import { activePopup, popupData } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { storeEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Popup } from "./Popup"

vi.mock("../../shared/utils/common", () => ({ ...commonMock(), MENU_BAR_HEIGHT: 36 }))
vi.mock("../../shared/utils/popup", () => ({ clearPopupSubmit: vi.fn() }))
vi.mock("../../app/wiring/shortcuts", () => ({ disablePopupClose: [] }))
vi.mock("../../shared/audio/effects/audioEffectsHelpers", () => ({ EFFECTS_LIST: [] }))
vi.mock("../../features/popups/registry", () => {
    const stub = (id: string) => () => createElement("div", { "data-testid": `react-${id}` }, id)
    return {
        reactPopups: {
            effect_items: stub("effect_items"),
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
})

describe("Popup", () => {
    it.each(["effect_items", "kit_demo", "looks", "screen_config"])("monta %s desde el registro React, sin isla Svelte", async (id) => {
        activePopup.set(id as Popups)
        render(<Popup />)
        await act(async () => {})

        expect(screen.getByTestId(`react-${id}`)).toBeTruthy()
        expect(readFileSync("src/frontend/react/main/Popup.tsx", "utf8")).not.toContain("SvelteIsland")
    })
})

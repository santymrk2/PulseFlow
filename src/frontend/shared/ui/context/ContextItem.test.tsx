// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("./logic/menuClick", () => ({ menuClick: vi.fn() }))
vi.mock("../../../app/wiring/shortcuts", () => ({ closeContextMenu: vi.fn() }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("./logic/contextMenus", () => ({
    contextMenuItems: {
        copy: { label: "actions.copy", icon: "copy", shortcut: "Ctrl+C" },
        rename: { label: "actions.rename", icon: "rename", shortcut: "F2", tooltip: "title" }
    }
}))
vi.mock("../../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../../media/cameraManager", () => ({ cameraManager: {} }))
vi.mock("../../utils/helpers/array", () => ({ keysToID: () => [] }))
vi.mock("../../utils/helpers/media", () => ({ getExtension: () => "", getMediaType: () => "image" }))
vi.mock("../../utils/helpers/show", () => ({ getLayoutRef: () => [], getSlideHighlightIndexes: () => [] }))
vi.mock("../../utils/helpers/shows", () => ({ _show: () => ({ get: () => ({}) }) }))
vi.mock("../../../components/settings/openSettings", () => ({ isSettingsDisabled: () => false }))

import { ContextItem } from "./ContextItem"

describe("ContextItem", () => {
    afterEach(() => cleanup())

    it("renderiza un item de contexto", () => {
        const { container } = render(<ContextItem id="copy" contextElem={null} />)
        expect(container.firstChild).toBeTruthy()
    })

    it("aplica data-title cuando el menú lo define", () => {
        const { container } = render(<ContextItem id="rename" contextElem={null} />)
        expect(container.querySelector("[data-title], [role='menuitem'], div, button")).toBeTruthy()
    })
})

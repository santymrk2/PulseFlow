// @vitest-environment happy-dom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { get } from "../../lib/store"

const mocks = vi.hoisted(() => {
    function writable<T>(value: T) {
        const subs = new Set<(v: T) => void>()
        return {
            subscribe(run: (v: T) => void) {
                run(value)
                subs.add(run)
                return () => subs.delete(run)
            },
            set(v: T) {
                value = v
                subs.forEach((fn) => fn(value))
            },
            update(fn: (v: T) => T) {
                value = fn(value)
                subs.forEach((sub) => sub(value))
            }
        }
    }
    return {
        contextActive: writable(false),
        activePage: writable("show"),
        activePopup: writable(null),
        contextData: writable({}),
        currentWindow: writable(null),
        dictionary: writable({}),
        localeDirection: writable("ltr"),
        os: writable({ platform: "darwin" }),
        serverData: writable({}),
        slideDeleteHighlight: writable(null),
        special: writable({}),
        spellcheck: writable(null),
        theme: writable("default"),
        themes: writable({ default: { colors: { primary: "#23232d", secondary: "#111827", text: "#ffffff" } } })
    }
})

vi.mock("../../stores", () => mocks)
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../utils/shortcuts", () => ({ closeContextMenu: () => mocks.contextActive.set(false) }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ getEditItems: () => [] }))
vi.mock("../../components/helpers/color", () => ({ hexToRgb: () => "0 0 0" }))
vi.mock("../../components/context/nativeMenu", () => ({ contextMenuMode: () => "app" }))
vi.mock("../../components/context/contextMenus", () => ({
    contextMenuGroups: {},
    contextMenuItems: { copy: { label: "actions.copy", icon: "copy" } },
    contextMenuLayouts: { default: ["copy"] }
}))
vi.mock("../../components/context/contextMenuSearch", () => ({
    flattenMenuItems: () => [],
    handleKeydown: () => false,
    searchMenuItems: () => ({ id: null, path: [] })
}))
vi.mock("../../components/context/loadItems", () => ({ quickLoadItems: () => {} }))
vi.mock("../../components/context/menuClick", () => ({ saveTextSelectionRange: () => {} }))
vi.mock("./ContextChild", () => ({ ContextChild: () => null }))
vi.mock("./ContextItem", () => ({ ContextItem: ({ id }: { id: string }) => <div>{id}</div> }))
vi.mock("./SpellCheckMenu", () => ({ SpellCheckMenu: () => null }))

import { ContextMenu } from "./ContextMenu"

describe("ContextMenu", () => {
    afterEach(() => {
        cleanup()
        mocks.contextActive.set(false)
    })

    it("abre con clic derecho sobre un elemento con clase context #…", async () => {
        render(<ContextMenu />)

        const target = document.createElement("div")
        target.className = "context #default"
        document.body.appendChild(target)

        fireEvent.contextMenu(target, { clientX: 20, clientY: 20 })

        await waitFor(() => {
            expect(get(mocks.contextActive as unknown as never)).toBe(true)
        })

        document.body.removeChild(target)
    })
})

// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

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
        quickSearchActive: writable(false),
        special: writable({ optimizedMode: false }),
        theme: writable("default"),
        themes: writable({ default: { colors: { primary: "#23232d" } } })
    }
})

vi.mock("../../shared/core/stores", () => ({
    quickSearchActive: mocks.quickSearchActive,
    special: mocks.special,
    theme: mocks.theme,
    themes: mocks.themes
}))
vi.mock("../../components/quicksearch/quicksearch", () => ({
    quicksearch: async () => [],
    quickSearchCategoryNames: {},
    selectQuicksearchValue: vi.fn()
}))
vi.mock("../../components/quicksearch/searchHighlight", () => ({ highlightText: (t: string) => t }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../app/wiring/shortcuts", () => ({ getNormalizedKey: (e: { key: string }) => e.key }))

import { QuickSearch } from "./QuickSearch"

describe("QuickSearch", () => {
    afterEach(() => cleanup())

    it("no renderiza nada cuando está inactivo", () => {
        const { container } = render(<QuickSearch />)
        expect(container.firstChild).toBeNull()
    })
})

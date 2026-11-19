// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DrawerTabIds } from "../../../types/Tabs"
import { Navigation } from "./Navigation"

vi.mock("../../shared/ui/system/DropArea", () => ({
    DropArea: ({ children, id, selectChildren }: { children: ReactNode; id: string; selectChildren?: boolean }) => (
        <div data-droparea={id} data-select={String(selectChildren)}>
            {children}
        </div>
    )
}))
vi.mock("./navigation/AudioTabs", () => ({ AudioTabs: () => <div data-tab="audio" /> }))
vi.mock("./navigation/CalendarTabs", () => ({ CalendarTabs: () => <div data-tab="calendar" /> }))
vi.mock("./navigation/FunctionsTabs", () => ({ FunctionsTabs: () => <div data-tab="functions" /> }))
vi.mock("./navigation/MediaTabs", () => ({ MediaTabs: () => <div data-tab="media" /> }))
vi.mock("./navigation/ScriptureTabs", () => ({ ScriptureTabs: () => <div data-tab="scripture" /> }))
vi.mock("./navigation/ShowsTabs", () => ({ ShowsTabs: () => <div data-tab="shows" /> }))

afterEach(cleanup)

const tab = () => document.querySelector("[data-tab]")?.getAttribute("data-tab") ?? null
const drop = () => document.querySelector("[data-droparea]")

describe("Navigation", () => {
    it("scripture, calendar y functions van directo, sin DropArea", () => {
        for (const id of ["scripture", "calendar", "functions"]) {
            const { unmount } = render(<Navigation id={id as DrawerTabIds} />)
            expect(tab()).toBe(id)
            expect(drop()).toBeNull()
            unmount()
        }
    })

    it("shows, media y audio van dentro del DropArea de navigation con selectChildren", () => {
        for (const id of ["shows", "media", "audio"]) {
            const { unmount } = render(<Navigation id={id as DrawerTabIds} />)
            expect(drop()?.getAttribute("data-droparea")).toBe("navigation")
            expect(drop()?.getAttribute("data-select")).toBe("true")
            expect(tab()).toBe(id)
            unmount()
        }
    })

    it("una pestaña sin tabs propias deja el DropArea vacío", () => {
        render(<Navigation id={"overlays" as DrawerTabIds} />)
        expect(drop()).toBeTruthy()
        expect(tab()).toBeNull()
    })

    it("conserva el contexto #category_<id>", () => {
        const { container } = render(<Navigation id="media" />)
        const categories = container.querySelector(".context") as HTMLElement
        expect(categories.className).toContain("#category_media")
    })
})

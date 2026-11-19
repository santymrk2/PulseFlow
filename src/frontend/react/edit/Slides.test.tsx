// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Slides } from "./Slides"

vi.mock("../../shared/core/stores", () => ({
    activeEdit: {
        subscribe: (r: any) => {
            r({ slide: 0, items: [], showId: "s1" })
            return () => {}
        },
        set: vi.fn()
    },
    activeShow: {
        subscribe: (r: any) => {
            r({ id: "s1" })
            return () => {}
        }
    },
    cachedShowsData: {
        subscribe: (r: any) => {
            r({ s1: { layout: [{ id: "l1" }] } })
            return () => {}
        }
    },
    editColumns: {
        subscribe: (r: any) => {
            r(2)
            return () => {}
        },
        set: vi.fn()
    },
    showsCache: {
        subscribe: (r: any) => {
            r({ s1: { slides: { l1: {} } } })
            return () => {}
        }
    }
}))
vi.mock("../../shared/ui/helpers/T", () => ({ T: ({ id }: any) => <span>{id}</span> }))
vi.mock("../../shared/utils/helpers/output", () => ({ findMatchingOut: () => null }))
vi.mock("../../shared/utils/helpers/show", () => ({ getShowCacheId: () => "s1" }))
vi.mock("../../features/slide/SkeletonSlide", () => ({ SkeletonSlide: () => <div data-testid="skeleton" /> }))
vi.mock("../../features/slide/Slide", () => ({ Slide: () => <div data-testid="slide" /> }))
vi.mock("../../shared/ui/system/Autoscroll", () => ({ Autoscroll: ({ children }: any) => <div>{children}</div> }))
vi.mock("../../shared/ui/system/Center", () => ({ Center: ({ children }: any) => <div>{children}</div> }))
vi.mock("../../shared/ui/system/DropArea", () => ({ DropArea: ({ children }: any) => <div>{children}</div> }))

afterEach(cleanup)

describe("Slides", () => {
    it("renderiza contenedor de slides de edición", () => {
        const { container } = render(<Slides />)
        expect(container.querySelector(".grid") || container.querySelector('[data-testid="slide"]') || container.querySelector('[data-testid="skeleton"]')).toBeTruthy()
    })
})

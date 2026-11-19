// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activeShow, dictionary, effects, mediaOptions, outputs, previewOutputId, styles } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Effects } from "./Effects"

const { addProjectItemMock, toggleEffectOutputMock, findMatchingOutMock } = vi.hoisted(() => ({
    addProjectItemMock: vi.fn(),
    toggleEffectOutputMock: vi.fn(),
    findMatchingOutMock: vi.fn((): string | null => null)
}))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getResolution: () => ({ width: 16, height: 9 }), findMatchingOut: findMatchingOutMock }))
vi.mock("../../../shared/utils/helpers/overlayOutput", () => ({ toggleEffectOutput: toggleEffectOutputMock }))
vi.mock("../../../converters/project", () => ({ addProjectItem: addProjectItemMock }))
vi.mock("../../output/Effect", async () => ({ Effect: (await vi.importActual<typeof import("../../../shared/test/islandMock")>("../../../shared/test/islandMock")).makePortMock("Effect") }))
vi.mock("../../slide/Zoomed", async () => {
    const { makePortMock } = await vi.importActual<typeof import("../../../shared/test/islandMock")>("../../../shared/test/islandMock")
    const Port = makePortMock("Zoomed")
    return {
        Zoomed: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => (
            <>
                {<Port {...props} />}
                {children}
            </>
        )
    }
})

const dict = { empty: { general: "Vacío", search: "Sin resultados" } }

const effect = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, color: null, items: [], style: "", background: "", ...extra })

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    findMatchingOutMock.mockReturnValue(null)
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(effects, { e1: effect("e1"), e2: effect("e2") } as never), storeEntry(outputs, {} as never), storeEntry(mediaOptions, { columns: 5, mode: "grid" }), storeEntry(activeShow, null), storeEntry(activeEdit, { items: [] } as never), storeEntry(activePage, "drawer"), storeEntry(styles, {}), storeEntry(previewOutputId, "")])
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

const islas = (name: string) => [...document.querySelectorAll(`[data-isla="${name}"]`)] as HTMLElement[]
const propsDe = (isla: HTMLElement) => JSON.parse(isla.getAttribute("data-props") ?? "{}") as Record<string, unknown>

describe("Effects", () => {
    it("lista los efectos ordenados y monta el efecto en el Zoomed", () => {
        vi.useFakeTimers()
        render(<Effects />)
        expect(screen.getByText("e1")).toBeTruthy()
        expect(screen.getByText("e2")).toBeTruthy()

        act(() => vi.runAllTimers())
        expect(islas("Zoomed")).toHaveLength(2)
        expect(islas("Effect")).toHaveLength(2)
        expect(propsDe(islas("Effect")[0]).preview).toBe(true)
    })

    it("sin efectos muestra el vacío", () => {
        act(() => effects.set({}))
        render(<Effects />)
        expect(screen.getByText("Vacío")).toBeTruthy()
    })

    it("al pasar el mouse el efecto se muestra en vivo", () => {
        vi.useFakeTimers()
        render(<Effects />)
        act(() => vi.runAllTimers())
        const tarjeta = document.querySelectorAll('[role="button"]')[0].children[1] as HTMLElement
        fireEvent.mouseEnter(tarjeta)
        const previews = islas("Effect").map((isla) => propsDe(isla).preview)
        expect(previews.filter((preview) => preview === true)).toHaveLength(1)

        fireEvent.mouseLeave(tarjeta)
        expect(islas("Effect").every((isla) => propsDe(isla).preview === true)).toBe(true)
    })

    it("un clic saca el efecto al aire", () => {
        vi.useFakeTimers()
        render(<Effects />)
        act(() => vi.runAllTimers())
        fireEvent.click(screen.getByText("e1"))
        expect(toggleEffectOutputMock).toHaveBeenCalledWith("e1")
    })

    it("con editOnClick abre el efecto en el editor", () => {
        vi.useFakeTimers()
        render(<Effects editOnClick />)
        act(() => vi.runAllTimers())
        fireEvent.click(screen.getByText("e2"))
        expect(get(activeEdit)).toEqual({ type: "effect", id: "e2", items: [] })
        expect(get(activePage)).toBe("edit")
        expect(toggleEffectOutputMock).not.toHaveBeenCalled()
    })

    it("el doble clic agrega el efecto al proyecto", () => {
        vi.useFakeTimers()
        render(<Effects />)
        act(() => vi.runAllTimers())
        fireEvent.doubleClick(screen.getByText("e1"))
        expect(addProjectItemMock).toHaveBeenCalledWith({ id: "e1", name: "e1", type: "effect" })
    })

    it("ignora ctrl y clicks en el editor o los iconos", () => {
        vi.useFakeTimers()
        render(<Effects />)
        act(() => vi.runAllTimers())
        const card = screen.getByText("e1")
        fireEvent.click(card, { ctrlKey: true })
        fireEvent.click(card, { metaKey: true })
        expect(toggleEffectOutputMock).not.toHaveBeenCalled()
    })

    it("marca como activo el efecto que ya está al aire", () => {
        findMatchingOutMock.mockReturnValue("out1")
        vi.useFakeTimers()
        const { container } = render(<Effects />)
        act(() => vi.runAllTimers())
        expect(container.querySelectorAll('[class*="active"]').length).toBeGreaterThan(0)
    })
})

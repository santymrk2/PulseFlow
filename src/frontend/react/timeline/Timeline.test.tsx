// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TimelineAction } from "../../../types/Show"
import { activeEdit, activePopup, activeShow, activeTriggerFunction, dictionary, resized, showsCache, special, timecode, timeline } from "../../shared/core/stores"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Timeline } from "./Timeline"

const { FakePlayback, FakeActions } = vi.hoisted(() => {
    class FakePlayback {
        static instances: FakePlayback[] = []
        callbacks: { play?: () => void; pause?: () => void; stop?: () => void; duration?: (time: number) => void; time?: (time: number) => void } = {}
        currentTime = 0
        isPlaying = false
        play = vi.fn(() => {
            this.isPlaying = true
            this.callbacks.play?.()
        })
        pause = vi.fn(() => {
            this.isPlaying = false
            this.callbacks.pause?.()
        })
        stop = vi.fn(() => {
            this.isPlaying = false
            this.setTime(0)
            this.callbacks.stop?.()
        })
        close = vi.fn()
        setTime = vi.fn((time: number) => {
            this.currentTime = time
            this.callbacks.time?.(time)
        })
        setActions = vi.fn()
        setLoopState = vi.fn()

        constructor(readonly type: string) {
            FakePlayback.instances.push(this)
        }
        onPlay(cb: () => void) {
            this.callbacks.play = cb
        }
        onPause(cb: () => void) {
            this.callbacks.pause = cb
        }
        onStop(cb: () => void) {
            this.callbacks.stop = cb
        }
        onDuration(cb: (time: number) => void) {
            this.callbacks.duration = cb
        }
        onTime(cb: (time: number) => void) {
            this.callbacks.time = cb
        }
    }

    class FakeActions {
        static instances: FakeActions[] = []
        callbacks: (() => void)[] = []
        updateAction = vi.fn()
        updateTimes = vi.fn()
        deleteActions = vi.fn()
        duplicateActions = vi.fn((ids: string[]) => ids.map((id) => `dup-${id}`))
        handleDrop = vi.fn()
        addAction = vi.fn()
        refreshActions = vi.fn()
        toggleLoop = vi.fn(() => true)
        close = vi.fn()

        constructor(
            readonly type: string,
            readonly callback: (actions: unknown[], data?: { shouldLoop: boolean }) => void
        ) {
            FakeActions.instances.push(this)
        }
        onUpdate(cb: () => void) {
            this.callbacks.push(cb)
        }
    }

    return { FakePlayback, FakeActions }
})

vi.mock("../../audio/audioWaveform", () => ({ createWaveform: vi.fn() }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/common", () => ({ ...commonMock(), DEFAULT_WIDTH: 290 }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../components/timeline/TimelinePlayback", () => ({
    TimelinePlayback: FakePlayback,
    getActiveTimelinePlayback: vi.fn(() => null)
}))
vi.mock("../../components/timeline/TimelineActions", () => ({ TimelineActions: FakeActions }))
vi.mock("../../components/timeline/ShowTimeline", () => ({
    ShowTimeline: { isRecordingActive: vi.fn(() => false), toggleRecording: vi.fn(() => true) }
}))
vi.mock("../../components/timeline/timeline", async () => {
    const actual = await vi.importActual<typeof import("../../components/timeline/timeline")>("../../components/timeline/timeline")
    return { ...actual, timelineZoom: vi.fn(async (_e: WheelEvent, zoom: number) => zoom * 1.1) }
})
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("uid", () => ({ uid: () => "nuevo-id" }))

const action = (id: string, time: number, type = "slide", extra: Partial<TimelineAction> = {}): TimelineAction => ({ id, time, name: `name.${id}`, type, data: { id: `slide-${id}`, index: 0 }, ...extra })
const showActions = [action("a1", 10000), action("a2", 20000)]
let restoreStores: () => void = () => {}

function sendActions(actions: TimelineAction[]) {
    act(() => FakeActions.instances[0].callback(actions, { shouldLoop: false }))
}

function renderTimeline(type: "show" | "slide" | "project" = "show", isClosed = false) {
    const result = render(<Timeline type={type} isClosed={isClosed} />)
    return { ...result, player: FakePlayback.instances[0], actions: FakeActions.instances[0] }
}

beforeEach(() => {
    FakePlayback.instances = []
    FakeActions.instances = []
    restoreStores = setStoresForTest([looseEntry(activeEdit, { items: [] }), looseEntry(activeShow, { id: "sh1" }), looseEntry(showsCache, {}), looseEntry(special, {}), looseEntry(timecode, {}), looseEntry(dictionary, {}), looseEntry(resized, {}), storeEntry(timeline, { startTime: 0 } as never), storeEntry(activeTriggerFunction, ""), storeEntry(activePopup, "")])
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 800 })
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 100, top: 100, right: 900, bottom: 400, width: 800, height: 300, x: 100, y: 100, toJSON: () => ({}) } as DOMRect)
})
afterEach(() => {
    cleanup()
    restoreStores()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.useRealTimers()
})

describe("Timeline", () => {
    it("muestra la vista cerrada con controles, tiempo, clips y marcadores", () => {
        const { container } = renderTimeline("show", true)
        sendActions([action("clip", 0, "audio", { duration: 2, name: "audio.clip" }), ...showActions])

        expect(container.querySelector('[data-title="media.play"]')).toBeTruthy()
        expect(container.querySelector('[data-title="media.stop"]')).toBeTruthy()
        expect(container.querySelectorAll(".action-clip")).toHaveLength(1)
        expect(container.querySelectorAll(".action-marker")).toHaveLength(2)
        expect(container.querySelector(".action-clip")?.getAttribute("data-title")).toBe("audio.clip")
        expect(container.querySelector(".time-display")?.textContent).toBe("00:00:00;00")
        expect(container.querySelector(".playhead")?.getAttribute("style")).toContain("left: 0px")
    })

    it("alterna play y pausa desde el botón de la vista cerrada", () => {
        const { container, player } = renderTimeline("show", true)
        fireEvent.click(container.querySelector('[data-title="media.play"]')!)
        expect(player.play).toHaveBeenCalledTimes(1)

        act(() => player.callbacks.play?.())
        expect(container.querySelector('[data-title="media.pause"]')).toBeTruthy()
        fireEvent.click(container.querySelector('[data-title="media.pause"]')!)
        expect(player.pause).toHaveBeenCalledTimes(1)

        act(() => player.callbacks.pause?.())
        expect(container.querySelector('[data-title="media.play"]')).toBeTruthy()
    })

    it("dibuja la regla, las cabeceras de sección y los marcadores en la vista abierta", () => {
        const { container } = renderTimeline()
        sendActions(showActions)

        expect(container.querySelectorAll(".ruler .tick:not(.minor)")).toHaveLength(9)
        expect(container.querySelectorAll(".grid .grid-line:not(.minor)")).toHaveLength(9)
        expect(container.querySelectorAll(".track-header")).toHaveLength(4)
        expect(container.querySelectorAll(".action-marker")).toHaveLength(2)
        expect(container.querySelector(".action-marker")?.getAttribute("data-title")).toBe("00:00:10;00: name.a1")
        expect(container.querySelector(".timeline-track")?.getAttribute("style")).toContain("width: 3000px")
        expect(container.querySelectorAll('[data-title="popup.timecode"]')).toHaveLength(0)
    })

    it("hace scrub en la regla con snap de acuerdo al zoom", () => {
        const { container, player } = renderTimeline()
        fireEvent.mouseDown(container.querySelector(".ruler-container")!, { button: 0, clientX: 250 })
        expect(player.setTime).toHaveBeenCalledWith(15000, true)
        fireEvent.mouseUp(window)
    })

    it("selecciona todas las acciones con el trigger global", () => {
        const { container } = renderTimeline()
        sendActions(showActions)
        act(() => activeTriggerFunction.set("timeline_selectAll"))
        expect(container.querySelectorAll(".action-marker.selected")).toHaveLength(2)
    })

    it("selecciona por arrastre y respeta la tecla Ctrl como selección acumulativa", () => {
        const { container } = renderTimeline()
        sendActions(showActions)
        const track = container.querySelector(".timeline-track")!

        fireEvent.mouseDown(track, { button: 0, clientX: 190, clientY: 135 })
        fireEvent.mouseMove(window, { clientX: 400, clientY: 135 })
        expect(container.querySelectorAll(".action-marker.selected")).toHaveLength(2)
        expect(container.querySelector(".selection-box")?.getAttribute("style")).toContain("width: 210px")
        fireEvent.mouseUp(window)
        expect(container.querySelector(".selection-box")).toBeNull()

        fireEvent.mouseDown(track, { button: 0, clientX: 250, clientY: 135, ctrlKey: true })
        expect(container.querySelectorAll(".action-marker.selected")).toHaveLength(2)
        fireEvent.mouseUp(window)
    })

    it("mueve las acciones seleccionadas al arrastrar un marcador", () => {
        const { container, actions: timelineActions } = renderTimeline()
        sendActions(showActions)
        act(() => activeTriggerFunction.set("timeline_selectAll"))

        fireEvent.mouseDown(container.querySelectorAll(".action-marker")[0], { button: 0, clientX: 250 })
        fireEvent.mouseMove(window, { clientX: 300 })
        expect(timelineActions.updateTimes).toHaveBeenCalled()
        const initialTimes = timelineActions.updateTimes.mock.calls[0][0] as Map<string, number>
        expect([...initialTimes.keys()]).toEqual(["a1", "a2"])
        expect(timelineActions.updateTimes.mock.calls[0][1]).toBeCloseTo(5000)
        fireEvent.mouseUp(window)
    })

    it("el input de tiempo y el teclado controlan el tiempo y la reproducción", () => {
        const { container, player } = renderTimeline()
        const input = container.querySelector(".corner input") as HTMLInputElement
        fireEvent.change(input, { target: { value: "00:00:10;00" } })
        expect(player.setTime).toHaveBeenCalledWith(10000)
        expect(input.value).toBe("00:00:10;00")

        fireEvent.keyDown(window, { key: " " })
        expect(player.play).toHaveBeenCalledTimes(1)
        act(() => player.callbacks.play?.())
        fireEvent.keyDown(window, { key: " " })
        expect(player.pause).toHaveBeenCalledTimes(1)
        fireEvent.keyDown(window, { key: "ArrowRight" })
    })

    it("borra la selección con Delete y delega el drop en TimelineActions", () => {
        const { container, actions: timelineActions } = renderTimeline()
        sendActions(showActions)
        act(() => activeTriggerFunction.set("timeline_selectAll"))

        fireEvent.keyDown(window, { key: "Delete" })
        expect(timelineActions.deleteActions).toHaveBeenCalledWith(["a1", "a2"])
        expect(container.querySelectorAll(".action-marker.selected")).toHaveLength(0)

        fireEvent(container.querySelector(".timeline-track-wrapper")!, new MouseEvent("drop", { clientX: 400, bubbles: true }))
        expect(timelineActions.handleDrop).toHaveBeenCalledWith(expect.anything(), 30000)
    })

    it("hace zoom con Ctrl+wheel y mantiene el tiempo bajo el cursor", async () => {
        const { container } = renderTimeline()
        const track = container.querySelector(".timeline-track-wrapper")!
        const wheel = new MouseEvent("wheel", { ctrlKey: true, clientX: 250, bubbles: true })
        Object.defineProperty(wheel, "deltaY", { value: -100 })
        fireEvent(track, wheel)
        await act(async () => {})
        expect(container.querySelector(".timeline-track")?.getAttribute("style")).toContain("width: 3300px")
        expect(track.scrollLeft).toBeCloseTo(15)
    })

    it("muestra el editor de curvas y oculta la barra flotante en slide", () => {
        const { container } = renderTimeline("slide")
        sendActions([action("style1", 0, "style", { data: { type: "item", key: "opacity", value: 0, indexes: [1] } })])
        expect(container.querySelector('[data-title="timeline.toggle_curve_editor"]')).toBeTruthy()
        expect(container.querySelector(".action-marker.faded")).toBeTruthy()

        fireEvent.click(container.querySelector('[data-title="timeline.toggle_curve_editor"]')!)
        expect(container.querySelector(".easing")).toBeTruthy()
        expect([...container.querySelectorAll("button")].some((button) => (button.getAttribute("data-title") || "").includes("media._loop"))).toBe(false)
    })

    it("alterna el loop de slide y abre los popups de project", () => {
        const { container, actions: timelineActions } = renderTimeline("slide")
        sendActions([])
        const loop = [...container.querySelectorAll("button")].find((button) => (button.getAttribute("data-title") || "").includes("media._loop"))!
        fireEvent.click(loop)
        expect(timelineActions.toggleLoop).toHaveBeenCalledTimes(1)

        cleanup()
        const project = renderTimeline("project")
        expect(project.container.querySelector('[data-title="popup.timecode"]')).toBeTruthy()
        expect(project.container.querySelector('[data-title="popup.timeline"]')).toBeTruthy()
        fireEvent.click(project.container.querySelector('[data-title="popup.timecode"]')!)
        expect(get(activePopup)).toBe("timecode")
    })

    it("deshabilita la reproducción en project con timecode receive", () => {
        act(() => timecode.set({ type: "receive" }))
        const { container } = renderTimeline("project")
        expect(container.querySelector('[data-title="media.play"]')).toBeTruthy()
        expect(container.querySelector('[data-title="media.pause"]')).toBeNull()
        expect(container.querySelectorAll('[data-title="popup.timecode"]')).toHaveLength(1)
    })

    it("limpia los listeners globales al desmontar", () => {
        const { player, unmount } = renderTimeline()
        unmount()
        fireEvent.keyDown(window, { key: " " })
        expect(player.play).not.toHaveBeenCalled()
    })
})

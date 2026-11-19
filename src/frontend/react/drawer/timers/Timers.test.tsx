// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, activeProfile, activeTimerTagFilter, activeTimers, dictionary, disableDragging, labelsDisabled, profiles, timers } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Timers } from "./Timers"

const { openDrawerMock, customActionActivationMock } = vi.hoisted(() => ({ openDrawerMock: vi.fn(), customActionActivationMock: vi.fn() }))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../components/actions/actions", () => ({ customActionActivation: customActionActivationMock, runActionId: vi.fn() }))
vi.mock("../../../components/edit/scripts/edit", () => ({ openDrawer: openDrawerMock }))
vi.mock("../../../features/slide/views/Timer", async () => ({ Timer: (await vi.importActual<typeof import("../../../shared/test/islandMock")>("../../../shared/test/islandMock")).makePortMock("Timer") }))

const dict = {
    empty: { timers: "Sin temporizadores" },
    media: { play: "Reproducir", pause: "Pausar", stop: "Detener" },
    main: { unnamed: "Sin nombre" },
    timer: { from_to: "Contador", to_time: "Reloj", to_event: "Evento" },
    new: { timer: "Nuevo temporizador" },
    remote: { project: "En el proyecto" }
}

const timer = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, type: "counter", start: 0, end: 60, ...extra })

let restaurar: () => void = () => {}

function montar(extra: Parameters<typeof setStoresForTest>[0] = []) {
    restaurar()
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(timers, { c1: timer("c1", { name: "Alfa" }), c2: timer("c2", { name: "Beta" }) } as never), storeEntry(activeTimers, [] as never), storeEntry(activeTimerTagFilter, []), storeEntry(activeProfile, null), storeEntry(profiles, {} as never), storeEntry(disableDragging, false), storeEntry(labelsDisabled, false), storeEntry(activePopup, null), ...extra])
}

beforeEach(() => {
    vi.clearAllMocks()
    montar()
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

const islas = (name: string) => [...document.querySelectorAll(`[data-isla="${name}"]`)] as HTMLElement[]
const porTitulo = (title: string) => document.querySelector(`button[data-title="${title}"]`) as HTMLButtonElement | null

describe("Timers", () => {
    it("ordena por tipo (contador, reloj, evento) y muestra el encabezado de cada grupo", () => {
        act(() =>
            timers.set({
                zeta: timer("zeta", { name: "Zeta" }),
                alfa: timer("alfa", { name: "Alfa", type: "clock", time: "10:00" }),
                beta: timer("beta", { name: "Beta", type: "event" })
            } as never)
        )
        render(<Timers />)
        const nombres = [...document.querySelectorAll("p[data-title]")].map((element) => element.getAttribute("data-title"))
        expect(nombres).toEqual(["Zeta", "Alfa", "Beta"])
        expect(screen.getByText("Reloj")).toBeTruthy()
        expect(screen.getByText("Evento")).toBeTruthy()
        expect(screen.queryByText("Contador")).toBeNull()
    })

    it("onlyPlaying sólo lista contadores activos", () => {
        act(() =>
            timers.set({
                c1: timer("c1", { name: "Alfa" }),
                c2: timer("c2", { name: "Beta" }),
                cl: timer("cl", { name: "Reloj", type: "clock", time: "10:00" })
            } as never)
        )
        act(() => activeTimers.set([{ id: "c2", paused: false }] as never))
        render(<Timers onlyPlaying />)
        expect(islas("Timer")).toHaveLength(1)
        expect(JSON.parse(islas("Timer")[0].getAttribute("data-props") ?? "{}").id).toBe("c2")
    })

    it("sin temporizadores muestra el vacío", () => {
        act(() => timers.set({}))
        render(<Timers />)
        expect(screen.getByText("Sin temporizadores")).toBeTruthy()
    })

    it("play/pause agrega el contador a los activos", () => {
        render(<Timers />)
        fireEvent.click(porTitulo("Reproducir") as HTMLButtonElement)
        const activo = get(activeTimers).find((a) => a.id === "c1")
        expect(activo?.paused).toBe(false)
        expect(activo?.currentTime).toBe(0)
        expect(customActionActivationMock).toHaveBeenCalledWith("timer_start", "c1")
    })

    it("el slider actualiza el tiempo del temporizador activo", () => {
        act(() => activeTimers.set([{ id: "c1", paused: false, currentTime: 30 }] as never))
        const { container } = render(<Timers />)
        const slider = container.querySelector('input[type="range"]') as HTMLInputElement
        act(() => {
            slider.value = "45"
            fireEvent.input(slider)
        })
        expect(get(activeTimers)[0].currentTime).toBe(45)
    })

    it("ajusta el tiempo en saltos de 10 segundos y lo reinicia", () => {
        act(() => activeTimers.set([{ id: "c1", paused: false, currentTime: 30 }] as never))
        render(<Timers />)
        fireEvent.click(screen.getByText("-10s"))
        expect(get(activeTimers)[0].currentTime).toBe(40)
        fireEvent.click(screen.getByText("+10s"))
        expect(get(activeTimers)[0].currentTime).toBe(30)

        fireEvent.click(porTitulo("Detener") as HTMLButtonElement)
        expect(get(activeTimers)).toHaveLength(0)
    })

    it("en saltos de un minuto cuando pasó los 60 segundos", () => {
        act(() => {
            timers.set({ c1: timer("c1", { name: "Alfa", end: 300 }) } as never)
            activeTimers.set([{ id: "c1", paused: false, currentTime: 90 }] as never)
        })
        render(<Timers />)
        fireEvent.click(screen.getByText("-1m"))
        expect(get(activeTimers)[0].currentTime).toBe(150)
    })

    it("con perfil de sólo lectura deshabilita los controles", () => {
        act(() => {
            activeProfile.set("p1")
            profiles.set({ p1: { access: { timers: { global: "read" } } } } as never)
        })
        render(<Timers />)
        expect(porTitulo("Reproducir")?.disabled).toBe(true)
        expect(porTitulo("Nuevo temporizador")?.disabled).toBe(true)
    })

    it("filtra temporizadores con etiquetas sin acceso", () => {
        act(() => {
            timers.set({ c1: timer("c1", { name: "Alfa", tags: ["t1"] }), c2: timer("c2", { name: "Beta" }) } as never)
            activeProfile.set("p1")
            profiles.set({ p1: { access: { timers: { t1: "none" } } } } as never)
        })
        render(<Timers />)
        expect(screen.queryByText("Alfa")).toBeNull()
        expect(screen.getByText("Beta")).toBeTruthy()
    })

    it("muestra el nombre sin definir y el tiempo final", () => {
        act(() => timers.set({ c1: timer("c1", { name: "", end: 90 }) } as never))
        render(<Timers />)
        expect(screen.getByText("Sin nombre")).toBeTruthy()
        expect(screen.getByText("01:30")).toBeTruthy()
    })

    it("en onlyPlaying el valor abre el cajón de temporizadores", () => {
        act(() => activeTimers.set([{ id: "c1", paused: false, currentTime: 1 }] as never))
        render(<Timers onlyPlaying />)
        fireEvent.click(islas("Timer")[0].parentElement as HTMLElement)
        expect(openDrawerMock).toHaveBeenCalledWith("timer")
    })

    it("el botón nuevo abre el popup y respeta labelsDisabled", () => {
        act(() => labelsDisabled.set(true))
        render(<Timers />)
        const boton = porTitulo("Nuevo temporizador") as HTMLButtonElement
        expect(boton.textContent).toBe("")
        fireEvent.click(boton)
        expect(get(activePopup)).toBe("timer")
    })

    it("suelta el arrastre al soltar el mouse", () => {
        act(() => disableDragging.set(true))
        render(<Timers />)
        act(() => {
            window.dispatchEvent(new MouseEvent("mouseup"))
        })
        expect(get(disableDragging)).toBe(false)
    })
})

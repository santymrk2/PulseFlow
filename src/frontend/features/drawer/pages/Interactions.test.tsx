// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeInteractions, activePopup, activeRename, dictionary, interactions, labelsDisabled, openedInteractionId, popupData } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Interactions } from "./Interactions"

const { getInteractionMock, startInteractionMock, stopInteractionMock, gotoMock, nextMock, previousMock, setScoreMock, kickMock } = vi.hoisted(() => ({
    getInteractionMock: vi.fn(),
    startInteractionMock: vi.fn(),
    stopInteractionMock: vi.fn(),
    gotoMock: vi.fn(),
    nextMock: vi.fn(),
    previousMock: vi.fn(),
    setScoreMock: vi.fn(),
    kickMock: vi.fn()
}))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../logic/pages/interactions", () => ({
    getInteraction: getInteractionMock,
    initConnection: () => ({ id: "db1", secret: "sec1" }),
    startInteraction: startInteractionMock,
    stopInteraction: stopInteractionMock,
    formatTimeInteraction: (seconds: number) => `0:${String(seconds).padStart(2, "0")}`
}))
vi.mock("../../../components/edit/scripts/edit", () => ({ newDropdown: vi.fn() }))

const dict = {
    main: { unnamed: "Sin nombre" },
    actions: { back: "Volver", backward: "Subir", forward: "Bajar" },
    media: { stop: "Detener", next: "Siguiente", previous: "Anterior" },
    inputs: { start: "Iniciar" },
    interaction: {
        add_input: "Agregar entrada",
        kick: "Expulsar",
        reveal_answer: "Revelar",
        require_name: "Pedir nombre",
        random_names: "Nombres aleatorios",
        all_at_once: "Todo a la vez",
        max_time: "Tiempo máximo",
        score_system: "Sistema de puntos",
        points: "Puntos"
    },
    new: { interaction: "Nueva interacción" },
    settings: { connections: "Conexiones" },
    create_show: { more_options: "Más opciones" }
}

const interactionData = (extra: Record<string, unknown> = {}) => ({ name: "Sala", inputs: [], ...extra })

const activeInstance = () => ({
    dbid: "dbid1",
    onUpdate: (cb: (data: unknown) => void) => {
        cb({ answers: [{ c1: { value: "hola", time: 1000 } }], clients: { c1: { name: "Ana" } }, currentAnswer: "hola", inputIndex: 0, closed: false })
        return () => {}
    },
    onTick: (cb: (data: unknown) => void) => {
        cb({ seconds: 3, startTime: 1000, startTimes: { 0: 1000 }, closed: false })
        return () => {}
    },
    getClients: () => [{ id: "c1", name: "Ana", score: 2 }],
    goto: gotoMock,
    next: nextMock,
    previous: previousMock,
    setScore: setScoreMock,
    kick: kickMock
})

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    getInteractionMock.mockReturnValue(undefined)
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(interactions, { i1: interactionData() } as never), storeEntry(activeInteractions, []), storeEntry(openedInteractionId, ""), storeEntry(activeRename, null), storeEntry(popupData, {}), storeEntry(activePopup, null), storeEntry(labelsDisabled, false)])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Interactions", () => {
    it("lista las interacciones y abre una al hacer clic", () => {
        render(<Interactions />)
        expect(screen.getByText("Sala")).toBeTruthy()
        fireEvent.click(screen.getByText("Sala"))
        expect(get(openedInteractionId)).toBe("i1")
    })

    it("crea una interacción nueva con conexión y renombrado", () => {
        render(<Interactions />)
        fireEvent.click(document.querySelector('[data-title="Nueva interacción"]') as HTMLElement)
        const ids = Object.keys(get(interactions))
        expect(ids).toHaveLength(2)
        const nuevo = ids.find((id) => id !== "i1") as string
        expect(get(interactions)[nuevo].lastConnection).toEqual({ id: "db1", secret: "sec1" })
        expect(get(activeRename)).toBe(`interaction_${nuevo}`)
    })

    it("el botón volver cierra la interacción abierta", () => {
        act(() => openedInteractionId.set("i1"))
        render(<Interactions />)
        fireEvent.click(document.querySelector('[data-title="Volver"]') as HTMLElement)
        expect(get(openedInteractionId)).toBe("")
    })

    it("click en una entrada en edición abre el popup con su índice", () => {
        act(() => {
            interactions.set({ i1: interactionData({ inputs: [{ type: "text", inputType: "input", question: "Pregunta", answer: "hola" }] }) } as never)
            openedInteractionId.set("i1")
        })
        render(<Interactions />)
        fireEvent.click(screen.getByText("Pregunta"))
        expect(get(popupData)).toEqual({ id: "i1", inputIndex: 0 })
        expect(get(activePopup)).toBe("interaction_input")
    })

    it("arranca la interacción cuando hay entradas", () => {
        act(() => {
            interactions.set({ i1: interactionData({ inputs: [{ type: "text", inputType: "input", question: "Pregunta" }] }) } as never)
            openedInteractionId.set("i1")
        })
        render(<Interactions />)
        fireEvent.click(screen.getByText("Iniciar").closest("button") as HTMLElement)
        expect(startInteractionMock).toHaveBeenCalledWith("i1")
    })

    it("con la interacción activa muestra jugadores, respuestas y controles", () => {
        getInteractionMock.mockReturnValue(activeInstance())
        act(() => {
            interactions.set({
                i1: interactionData({
                    inputs: [
                        { type: "text", inputType: "input", question: "Pregunta", answer: "hola" },
                        { type: "text", inputType: "input", question: "Otra" }
                    ]
                })
            } as never)
            openedInteractionId.set("i1")
            activeInteractions.set(["i1"])
        })
        render(<Interactions />)
        expect(screen.getByText("0:03")).toBeTruthy()
        fireEvent.click(document.querySelector('[data-title="Siguiente"]') as HTMLElement)
        expect(nextMock).toHaveBeenCalled()
        fireEvent.click(screen.getByText("Detener").closest("button") as HTMLElement)
        expect(stopInteractionMock).toHaveBeenCalledWith("i1")
    })

    it("muestra el historial de una interacción terminada", () => {
        act(() => {
            interactions.set({
                i1: interactionData({
                    history: [{ time: 1700000000000, leaderboard: [{ name: "Ana", score: 5 }], inputs: [{ question: "Pregunta", answers: [{ name: "Ana", value: ["a", "b"] }] }] }]
                })
            } as never)
            openedInteractionId.set("i1")
        })
        render(<Interactions />)
        fireEvent.click(screen.getByText("1").closest("button") as HTMLElement)
        expect(screen.getByText("Leaderboard:")).toBeTruthy()
        expect(screen.getAllByText(/Ana/).length).toBeGreaterThan(0)
        expect(screen.getByText("a")).toBeTruthy()
    })

    it("las opciones cambian los ajustes de la interacción", () => {
        act(() => openedInteractionId.set("i1"))
        render(<Interactions />)
        fireEvent.click(document.querySelector('[data-title="Más opciones"]') as HTMLElement)
        fireEvent.click(screen.getByText("Pedir nombre"))
        expect(get(interactions).i1.options?.requireName).toBe(false)
    })
})

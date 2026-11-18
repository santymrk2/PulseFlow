// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeInteractions, dictionary, interactions, openedInteractionId, shows } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { InteractionsInfo } from "./InteractionsInfo"

const { generateSlideMock, getInteractionMock } = vi.hoisted(() => ({ generateSlideMock: vi.fn(), getInteractionMock: vi.fn() }))

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../components/drawer/pages/interactionSlides", () => ({ generateSlide: generateSlideMock }))
vi.mock("../../../components/drawer/pages/interactions", () => ({ getInteraction: getInteractionMock }))

let restaurar: () => void = () => {}

function montar(opened: string, active: string[] = [], showIds: string[] = []) {
    restaurar()
    restaurar = setStoresForTest([storeEntry(dictionary, { interaction: { generate_slide: "Generar slide" } }), storeEntry(interactions, { i1: { name: "Interacción", inputs: [{ type: "text", question: "¿?" }] } } as never), storeEntry(openedInteractionId, opened), storeEntry(activeInteractions, active), storeEntry(shows, Object.fromEntries(showIds.map((id) => [id, { id }])) as never)])
    return render(<InteractionsInfo />)
}

beforeEach(() => {
    vi.clearAllMocks()
    getInteractionMock.mockReturnValue(undefined)
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("InteractionsInfo", () => {
    it("sin interacción abierta no renderiza nada", () => {
        const { container } = montar("")
        expect(container.querySelectorAll("button").length).toBe(0)
        expect(container.querySelectorAll("a").length).toBe(0)
    })

    it("con inputs y sin conexión ofrece generar los cinco slides", () => {
        montar("i1")
        const botones = screen.getAllByRole("button")
        expect(botones.length).toBe(5)
        expect(screen.getAllByText(/Generar slide:/).length).toBe(5)
        fireEvent.click(botones[0])
        expect(generateSlideMock).toHaveBeenCalledWith("join")
    })

    it("muestra la URL de la interacción y el controlador cuando hay dbid/dbsecret", () => {
        getInteractionMock.mockReturnValue({ dbid: "123", dbsecret: "123-secret" })
        montar("i1", ["i1"], ["interaction-i1"])
        const links = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[]
        expect(links.length).toBe(2)
        expect(links[0].textContent).toContain("freeshow.net/interaction#id=123")
        expect(links[1].textContent).toContain("freeshow.net/interaction_controller#id=...")
        expect(screen.queryAllByRole("button").length).toBe(0)
    })

    it("si la interacción está activa pero el show no existe, igual ofrece generarlos", () => {
        getInteractionMock.mockReturnValue({ dbid: "123", dbsecret: "123-secret" })
        montar("i1", ["i1"], [])
        expect(screen.getAllByRole("button").length).toBe(5)
    })
})

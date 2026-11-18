// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { popupData } from "../../stores"
import { chooseTeam } from "../../utils/cloudSync"
import { commonMock } from "../test/mockCommon"
import { clearIslands, islands } from "../test/islandMock"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { CloudSync } from "./CloudSync"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../utils/cloudSync", () => ({ chooseTeam: vi.fn() }))
vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))

const teams = [
    { id: "t1", churchId: "ch", name: "Equipo A", icon: "people" },
    { id: "t2", churchId: "ch", name: "Equipo B", icon: "people" }
]
let restaurar: () => void = () => {}
function montar(data: object) {
    restaurar = setStoresForTest([storeEntry(popupData, data)] as never)
    return render(<CloudSync />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CloudSync", () => {
    it("con_choose_team_muestra_el_tip_y_los_equipos", () => {
        montar({ type: "choose_team", teams })
        expect(islands.Tip.props).toEqual({ type: "info", value: "Select a team where you want to sync the data.", bottom: 20 })
        expect(screen.getByText("Equipo A")).toBeTruthy()
        expect(screen.getByText("Equipo B")).toBeTruthy()
    })

    it("con_otro_tipo_no_muestra_nada", () => {
        const { container } = montar({ type: "otro", teams })
        expect(container.innerHTML).toBe("")
    })

    it("elegir_un_equipo_llama_chooseTeam_con_el_conteo_y_solo_una_vez", () => {
        montar({ type: "choose_team", teams })
        fireEvent.click(screen.getByText("Equipo B"))
        fireEvent.click(screen.getByText("Equipo A"))
        expect(chooseTeam).toHaveBeenCalledTimes(1)
        expect(chooseTeam).toHaveBeenCalledWith({ ...teams[1], count: 2 })
    })
})

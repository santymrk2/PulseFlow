import { afterEach, describe, expect, it, vi } from "vitest"
import { outLocked, special } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { clearAll } from "./clear"
import { clearToLogo } from "./clearToLogo"
import { getAllActiveOutputIds, setOutput } from "../../../shared/utils/helpers/output"

vi.mock("./clear", () => ({ clearAll: vi.fn() }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getAllActiveOutputIds: vi.fn(() => ["a", "b"]), setOutput: vi.fn() }))

let restore = () => {}
afterEach(() => {
    restore()
    vi.clearAllMocks()
})

describe("clearToLogo", () => {
    it("sin_logo_no_hace_nada", () => {
        restore = setStoresForTest([looseEntry(special, {}), looseEntry(outLocked, false)])
        clearToLogo()
        expect(clearAll).not.toHaveBeenCalled()
        expect(setOutput).not.toHaveBeenCalled()
    })

    it("con_logo_limpia_todo_y_pone_el_logo_de_fondo_en_las_salidas_activas", () => {
        restore = setStoresForTest([looseEntry(special, { outputLogo: "/img/logo.png" }), looseEntry(outLocked, false)])
        vi.mocked(getAllActiveOutputIds).mockReturnValue(["a", "b"])
        clearToLogo()
        expect(clearAll).toHaveBeenCalledWith(true)
        expect(setOutput).toHaveBeenCalledTimes(2)
        expect(setOutput).toHaveBeenCalledWith("background", expect.objectContaining({ path: "/img/logo.png", type: "image" }), false, "a")
        expect(setOutput).toHaveBeenCalledWith("background", expect.objectContaining({ path: "/img/logo.png" }), false, "b")
    })
})

// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getUrlTimestamp, getVimeoData, getYouTubeData } from "../../components/drawer/player/playerHelper"
import { addVideoMarker } from "../../shared/utils/helpers/media"
import { dictionary, playerVideos, popupData } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { clearFields, fields, fire } from "../../shared/test/kitMocks"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { CreatePlayer } from "./CreatePlayer"

vi.mock("uid", () => ({ uid: () => "nuevo" }))
vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../components/drawer/player/playerHelper", () => ({
    getUrlTimestamp: vi.fn(() => 0),
    getVimeoData: vi.fn(async () => ({ name: "Vimeo name" })),
    getYouTubeData: vi.fn(async () => ({ name: "YT name" })),
    trimPlayerId: vi.fn((id: string) => id.replace("https://y/", ""))
}))
vi.mock("../../shared/utils/helpers/media", () => ({ addVideoMarker: vi.fn(() => 2) }))
vi.mock("../../shared/utils/helpers/time", () => ({ joinTime: () => "1:00", secondsToTime: () => ({}) }))
vi.mock("../../shared/ui/kit/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(data: object, videos: object = {}) {
    restaurar = setStoresForTest([looseEntry(popupData, data), looseEntry(playerVideos, videos), storeEntry(dictionary, {})] as never)
    return render(<CreatePlayer />)
}
const flush = () => new Promise((r) => setTimeout(r, 0))
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CreatePlayer", () => {
    it("nuevo_muestra_id_y_nombre_vacíos_y_vacía_popupData", () => {
        montar({ active: "youtube" })
        expect(fields["inputs.video_id"]).toMatchObject({ value: "", disabled: false, autofocus: true, pasteBtn: true, placeholder: "e.g. X-AJdKty74M" })
        expect(fields["inputs.name"]).toMatchObject({ value: "", disabled: true })
        expect(get(popupData)).toEqual({})
    })

    it("editar_carga_el_video_bloquea_el_id_y_oculta_el_nombre", () => {
        montar({ active: "vimeo", id: "v1" }, { v1: { id: "abc", name: "N" } })
        expect(fields["inputs.video_id"]).toMatchObject({ value: "abc", disabled: true, autofocus: false, pasteBtn: false })
        expect(fields["inputs.name"]).toBeUndefined()
    })

    it("sin_active_no_vacía_popupData", () => {
        montar({ id: "v1" }, { v1: { id: "abc", name: "N" } })
        expect(get(popupData)).toEqual({ id: "v1" })
    })

    it("escribir_el_id_guarda_el_video_con_el_tipo_y_busca_el_nombre", async () => {
        montar({ active: "youtube" })
        fire("inputs.video_id", "onChange", "https://y/XYZ")
        await flush()
        expect(getYouTubeData).toHaveBeenCalledWith("XYZ")
        expect(get(playerVideos)).toEqual({ nuevo: { id: "XYZ", name: "YT name", type: "youtube" } })
    })

    it("vimeo_busca_el_nombre_en_vimeo", async () => {
        montar({ active: "vimeo" })
        fire("inputs.video_id", "onChange", "123")
        await flush()
        expect(getVimeoData).toHaveBeenCalledWith("123")
        expect(get(playerVideos).nuevo).toEqual({ id: "123", name: "Vimeo name", type: "vimeo" })
    })

    it("si_ya_hay_nombre_no_lo_busca", async () => {
        montar({ active: "youtube" })
        fire("inputs.name", "onChange", "Mío")
        fire("inputs.video_id", "onChange", "XYZ")
        await flush()
        expect(getYouTubeData).not.toHaveBeenCalled()
        expect(get(playerVideos).nuevo).toEqual({ id: "XYZ", name: "Mío", type: "youtube" })
    })

    it("un_link_con_tiempo_agrega_un_marcador_y_avisa", () => {
        vi.mocked(getUrlTimestamp).mockReturnValueOnce(60)
        montar({ active: "youtube" })
        fire("inputs.video_id", "onChange", "https://y/XYZ?t=60")
        expect(addVideoMarker).toHaveBeenCalledWith("nuevo", 60, "URL")
        expect(newToast).toHaveBeenCalledTimes(1)
    })

    it("editar_conserva_el_id_del_video_y_actualiza_el_nombre", () => {
        montar({ active: "youtube", id: "v1" }, { v1: { id: "abc", name: "N" } })
        fire("inputs.video_id", "onChange", "abc")
        expect(Object.keys(get(playerVideos))).toEqual(["v1"])
    })
})

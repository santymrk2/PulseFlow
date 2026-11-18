// @vitest-environment happy-dom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Media, Slide, SlideData } from "../../../types/Show"
import { AudioPlayer } from "../../audio/audioPlayer"
import { activeShow, activeTimers, outputs, shows } from "../../stores"
import { newToast } from "../../utils/common"
import { getAccess } from "../../utils/profile"
import { history } from "../../components/helpers/history"
import { _show } from "../../components/helpers/shows"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { Icons, type IconsProps } from "./Icons"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: { getDuration: vi.fn(async () => 95) } }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../utils/profile", () => ({ getAccess: vi.fn(() => ({ global: "edit" })) }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/shows", () => ({
    _show: vi.fn(() => ({
        get: () => ({ media: { a1: { path: "/audio/song.mp3" } } }),
        media: vi.fn(() => ({ set: vi.fn() }))
    }))
}))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))

const setMock = vi.fn()
const baseShow = () => ({
    s1: { locked: false, category: "p", media: { a1: { path: "/audio/song.mp3" } } }
})

let restore: () => void = () => {}
beforeEach(() => {
    setMock.mockClear()
    vi.mocked(_show).mockImplementation(
        () =>
            ({
                get: () => ({ media: { a1: { path: "/audio/song.mp3" } } }),
                media: () => ({ set: setMock })
            }) as never
    )
    restore = setStoresForTest([looseEntry(shows, baseShow()), looseEntry(activeShow, { id: "s1" }), looseEntry(outputs, { out1: { name: "Proyector" } }), looseEntry(activeTimers, [])])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

const slide = { settings: {} } as Slide
const layout = (extra: Partial<SlideData> = {}) => ({ id: "l1", ...extra }) as SlideData
const baseProps = (extra: Partial<IconsProps> = {}) => ({
    slide,
    timer: [],
    layoutSlide: layout(),
    background: null,
    duration: 0,
    columns: 4,
    index: 0,
    style: "",
    ...extra
})

describe("Icons", () => {
    it("aplica_el_zoom_y_el_style_recibido", () => {
        const { container } = render(<Icons {...baseProps({ columns: 2, style: "color: red;" })} />)
        const root = container.firstElementChild as HTMLElement
        expect(root.style.zoom).toBe("2")
        expect(root.style.color).toBe("red")
    })

    it("muestra_el_icono_de_deshabilitado_y_quita_la_clave", () => {
        const { container } = render(<Icons {...baseProps({ layoutSlide: layout({ disabled: true }) })} />)
        expect(container.querySelector("[data-icon='disable']")).toBeTruthy()
        fireEvent.click(container.querySelector("button")!)
        expect(history).toHaveBeenCalledWith({ id: "SHOW_LAYOUT", newData: { key: "disabled", indexes: [0] } })
    })

    it("muestra_el_contador_de_timers_y_al_quitarlos_filtra_activeTimers", () => {
        restore = setStoresForTest([looseEntry(shows, baseShow()), looseEntry(activeShow, { id: "s1" }), looseEntry(outputs, {}), looseEntry(activeTimers, [{}, {}, {}])])
        const { container } = render(<Icons {...baseProps({ timer: [0, 2] })} />)
        expect(container.textContent).toContain("2")
        fireEvent.click(container.querySelector("button")!)
        expect(get(activeTimers).length).toBe(1)
    })

    it("muestra_el_siguiente_temporizador_en_segundos_y_en_formato_reloj", () => {
        const { container } = render(<Icons {...baseProps({ layoutSlide: layout({ nextTimer: 30 }) })} />)
        expect(container.textContent).toContain("30s")
        cleanup()
        const { container: second } = render(<Icons {...baseProps({ layoutSlide: layout({ nextTimer: 90 }) })} />)
        expect(second.textContent).toContain("01:30")
    })

    it("muestra_el_nombre_del_binding_cuando_hay_uno", () => {
        const { container } = render(<Icons {...baseProps({ layoutSlide: layout({ bindings: ["out1"] }) })} />)
        expect(container.textContent).toContain("Proyector")
    })

    it("muestra_el_icono_de_video_y_su_duracion", () => {
        const background = { path: "/clip.mp4", type: "video" } as Media
        const { container } = render(<Icons {...baseProps({ background, duration: 95 })} />)
        expect(container.querySelector("[data-icon='image']")).toBeTruthy()
        expect(container.textContent).toContain("01:35")
    })

    it("muestra_el_icono_de_silenciado_para_un_video_y_lo_activa", () => {
        const background = { path: "/clip.mp4", muted: true } as Media
        const { container } = render(<Icons {...baseProps({ background })} />)
        const icons = container.querySelectorAll("[data-icon]")
        expect(Array.from(icons).some((icon) => icon.getAttribute("data-icon") === "muted")).toBe(true)
        fireEvent.click(
            Array.from(icons)
                .find((icon) => icon.getAttribute("data-icon") === "muted")!
                .closest("button")!
        )
        expect(setMock).toHaveBeenCalledWith({ key: "muted", value: false })
    })

    it("muestra_el_icono_de_loop_cuando_hay_varios fondos_y_lo_quita", () => {
        const background = { path: "/clip.mp4", loop: true } as Media
        const { container } = render(<Icons {...baseProps({ background, backgroundCount: 2 })} />)
        const icons = container.querySelectorAll("[data-icon]")
        expect(Array.from(icons).some((icon) => icon.getAttribute("data-icon") === "loop")).toBe(true)
        fireEvent.click(
            Array.from(icons)
                .find((icon) => icon.getAttribute("data-icon") === "loop")!
                .closest("button")!
        )
        expect(setMock).toHaveBeenCalledWith({ key: "loop", value: false })
    })

    it("muestra_la_duracion_y_el_nombre_del_audio", async () => {
        const { container } = render(<Icons {...baseProps({ layoutSlide: layout({ audio: ["a1"] }) })} />)
        await waitFor(() => expect(container.textContent).toContain("01:35"))
        expect(container.textContent).toContain("song")
    })

    it("muestra_la_cantidad_de_efectos_y_overlays", () => {
        const { container } = render(<Icons {...baseProps({ layoutSlide: layout({ effects: ["e1", "e2"], overlays: ["o1"] }) })} />)
        expect(container.textContent).toContain("2")
        expect(container.querySelector("[data-icon='overlays']")).toBeTruthy()
    })

    it("muestra_el_icono_de_plantilla_y_quita_la_setting", () => {
        const { container } = render(<Icons {...baseProps({ slide: { settings: { template: "t1" } } as Slide })} />)
        fireEvent.click(container.querySelector("button")!)
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ id: "slideStyle" }))
    })

    it("con_show_bloqueado_no_guarda_y_muestra_el_toast", () => {
        restore = setStoresForTest([looseEntry(shows, { s1: { locked: true } }), looseEntry(activeShow, { id: "s1" }), looseEntry(outputs, {}), looseEntry(activeTimers, [])])
        const { container } = render(<Icons {...baseProps({ layoutSlide: layout({ disabled: true }) })} />)
        fireEvent.click(container.querySelector("button")!)
        expect(newToast).toHaveBeenCalledWith("show.locked")
        expect(history).not.toHaveBeenCalled()
    })

    it("usa_la_duracion_de_AudioPlayer_para_el_audio", async () => {
        vi.mocked(AudioPlayer.getDuration).mockResolvedValueOnce(65)
        const { container } = render(<Icons {...baseProps({ layoutSlide: layout({ audio: ["a1"] }) })} />)
        await waitFor(() => expect(container.textContent).toContain("01:05"))
    })

    it("con_perfil_de_solo_lectura_no_guarda", () => {
        vi.mocked(getAccess).mockReturnValue({ global: "read" } as never)
        const { container } = render(<Icons {...baseProps({ layoutSlide: layout({ disabled: true }) })} />)
        fireEvent.click(container.querySelector("button")!)
        expect(newToast).toHaveBeenCalledWith("profile.locked")
        expect(history).not.toHaveBeenCalled()
    })
})

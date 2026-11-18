// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { drawerTabsData } from "../../stores"
import { clearIslands, islands } from "../test/islandMock"
import { setStoresForTest, type StoreEntry, storeEntry } from "../test/storeTestKit"
import { Content } from "./Content"

interface MediaPropsMock {
    active: string | null
    streams: MediaStream[]
}

interface AudioPropsMock {
    active: string | null
}

interface ShowsPropsMock {
    active: string | null
}

const { mediaProps, audioProps, showsProps } = vi.hoisted(() => ({
    mediaProps: { current: null as MediaPropsMock | null },
    audioProps: { current: null as AudioPropsMock | null },
    showsProps: { current: null as ShowsPropsMock | null }
}))

vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("../../components/drawer/bible/Scripture.svelte", () => ({ default: { isla: "Scripture" } }))
vi.mock("../../components/drawer/calendar/Calendar.svelte", () => ({ default: { isla: "Calendar" } }))
vi.mock("./audio/Audio", () => ({
    Audio: ({ active }: AudioPropsMock) => {
        audioProps.current = { active }
        return <div data-testid="audio-react" />
    }
}))
vi.mock("./media/Media", () => ({
    Media: ({ active, streams }: MediaPropsMock) => {
        mediaProps.current = { active, streams }
        return <div data-testid="media-react" />
    }
}))
vi.mock("./pages/Actions", () => ({ Actions: () => <div data-page="Actions" /> }))
vi.mock("./pages/Interactions", () => ({ Interactions: () => <div data-page="Interactions" /> }))
vi.mock("./pages/OBS", () => ({ OBS: () => <div data-page="OBS" /> }))
vi.mock("./pages/Scenes", () => ({ Scenes: () => <div data-page="Scenes" /> }))
vi.mock("./pages/Shows", () => ({
    Shows: ({ active }: { active: string | null }) => {
        showsProps.current = { active }
        return <div data-page="Shows" />
    }
}))
vi.mock("./pages/Variables", () => ({ Variables: () => <div data-page="Variables" /> }))
vi.mock("../../components/drawer/timers/Timers.svelte", () => ({ default: { isla: "Timers" } }))

let restaurar: () => void = () => {}
function montar(id: string, active: string | null = null, extra: StoreEntry[] = []) {
    restaurar()
    clearIslands() // el registro del mock es state compartido entre renders
    mediaProps.current = null
    audioProps.current = null
    showsProps.current = null
    restaurar = setStoresForTest([storeEntry(drawerTabsData, { [id]: { enabled: true, activeSubTab: active } } as never), ...extra])
    return render(<Content id={id} />)
}
afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    clearIslands()
})

const isla = () => document.querySelector("[data-isla]")?.getAttribute("data-isla") ?? null
const pagina = () => document.querySelector("[data-page]")?.getAttribute("data-page") ?? null

describe("Content", () => {
    it("shows monta la página React con el sub-tab activo", () => {
        montar("shows", "all")
        expect(pagina()).toBe("Shows")
        expect(showsProps.current?.active).toBe("all")
    })

    it("scripture y calendar siguen como islas con el sub-tab activo", () => {
        const casos: Record<string, string> = { scripture: "Scripture", calendar: "Calendar" }
        for (const [id, nombre] of Object.entries(casos)) {
            montar(id, "all")
            expect(isla()).toBe(nombre)
            expect(islands[nombre].props.active).toBe("all")
            cleanup()
        }
    })

    it("media monta el componente React con el sub-tab activo", () => {
        montar("media", "all")
        expect(document.querySelector("[data-testid='media-react']")).not.toBeNull()
        expect(mediaProps.current?.active).toBe("all")
    })

    it("audio monta el componente React con el sub-tab activo", () => {
        montar("audio", "all")
        expect(document.querySelector("[data-testid='audio-react']")).not.toBeNull()
        expect(audioProps.current?.active).toBe("all")
    })

    it("media recibe el array de streams estable", () => {
        montar("media")
        const streams = mediaProps.current?.streams
        expect(Array.isArray(streams)).toBe(true)
        expect(streams).toBe(mediaProps.current?.streams)
    })

    it("functions despacha cada sub-página", () => {
        const casos: Record<string, string> = { actions: "Actions", timer: "Timers", variables: "Variables", scenes: "Scenes", interactions: "Interactions", obs: "OBS" }
        for (const [active, nombre] of Object.entries(casos)) {
            montar("functions", active)
            expect(nombre === "Timers" ? isla() : pagina()).toBe(nombre)
            cleanup()
        }
    })

    it("functions con un sub-tab desconocido no monta nada", () => {
        montar("functions", "otro")
        expect(pagina()).toBeNull()
        expect(isla()).toBeNull()
    })

    it("al salir de media (o entrar a un sub-tab) detiene los streams", () => {
        const stop = vi.fn()
        const track = { enabled: true, stop }
        const stream = { getTracks: () => [track] } as unknown as MediaStream
        const { rerender } = montar("media")
        const streams = mediaProps.current?.streams as MediaStream[]
        streams.push(stream)

        rerender(<Content id="audio" />)
        expect(stop).toHaveBeenCalledTimes(1)
        expect(track.enabled).toBe(false)
    })

    it("media con sub-tab activo detiene los streams cuando cambia el sub-tab", () => {
        const stop = vi.fn()
        const track = { enabled: true, stop }
        const stream = { getTracks: () => [track] } as unknown as MediaStream
        montar("media")
        const streams = mediaProps.current?.streams as MediaStream[]
        streams.push(stream)

        act(() => drawerTabsData.update((a) => ({ ...a, media: { enabled: true, activeSubTab: "all" } })))
        expect(stop).toHaveBeenCalledTimes(1)
        expect(track.enabled).toBe(false)
    })
})

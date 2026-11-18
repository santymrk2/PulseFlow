// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activeScripture, drawerTabsData, scriptureSettings, templates } from "../../../stores"
import { clearIslands } from "../../test/islandMock"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { ScriptureInfo } from "./ScriptureInfo"

const mocks = vi.hoisted(() => ({
    content: [] as unknown[],
    slides: [[]] as unknown[],
    attribution: "",
    convert: vi.fn(),
    defaultTemplates: vi.fn(),
    confirm: vi.fn((_message: string) => Promise.resolve(true)),
    openSettings: vi.fn()
}))
vi.mock("../../../components/drawer/bible/scripture", () => ({
    getActiveScripturesContent: () => Promise.resolve(mocks.content),
    getScriptureSlidesNew: () => Promise.resolve({ slides: mocks.slides }),
    getMergedAttribution: () => mocks.attribution,
    textKeys: { verseNumbers: "$verse", showVersion: "$version" },
    useOldScriptureSystem: () => false,
    createScriptureShow: () => mocks.convert()
}))
vi.mock("../../../components/settings/openSettings", () => ({ openSettings: (id: string) => mocks.openSettings(id) }))
vi.mock("../../../utils/createData", () => ({ setDefaultScriptureTemplates: () => mocks.defaultTemplates() }))
vi.mock("../../../utils/popup", () => ({ confirmCustom: (message: string) => mocks.confirm(message) }))
vi.mock("../../../IPC/main", () => ({ sendMain: vi.fn(), receiveToMain: vi.fn(() => "listener"), destroyMain: vi.fn(), requestMain: vi.fn() }))
vi.mock("../../output/Media", () => ({ Media: ({ path }: { path?: string }) => <div data-testid="media" data-path={path} /> }))
vi.mock("../../slide/Textbox", () => ({ Textbox: ({ ref }: { ref?: { id?: string } }) => <div data-testid="textbox" data-ref-id={ref?.id} /> }))
vi.mock("../../slide/Zoomed", () => ({
    Zoomed: ({ background, children }: { background?: string; children?: React.ReactNode }) => (
        <div data-testid="zoomed" data-background={background}>
            {children}
        </div>
    )
}))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

const BIBLE = { chapters: [1], activeVerses: [[1]], verses: [{}] }
let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    mocks.content = [BIBLE]
    mocks.slides = [[{ id: "item1" }]]
    mocks.attribution = "Biblia de prueba"
    restaurar = setStoresForTest([looseEntry(activeScripture, {}), looseEntry(drawerTabsData, { scripture: { activeSubTab: "bible1" } }), looseEntry(scriptureSettings, { customText: "$verse" }), looseEntry(templates, { scripture: { name: "Scripture", settings: { backgroundColor: "#123456", backgroundPath: "/bg.jpg" } } })])
})
afterEach(() => {
    cleanup()
    restaurar()
    clearIslands()
})

async function montar(optionsOpen = false) {
    const resultado = render(<ScriptureInfo optionsOpen={optionsOpen} />)
    await act(async () => {
        await Promise.resolve()
    })
    return resultado
}

describe("ScriptureInfo", () => {
    it("monta el port Zoomed con el fondo y la vista previa React", async () => {
        const { getByTestId } = await montar()
        expect(getByTestId("zoomed").getAttribute("data-background")).toBe("#123456")
        expect(getByTestId("media").getAttribute("data-path")).toBe("/bg.jpg")
        expect(getByTestId("textbox").getAttribute("data-ref-id")).toBe("scripture")
        expect(screen.getByText("Biblia de prueba")).toBeTruthy()
    })

    it("escribe las opciones de escritura en scriptureSettings", async () => {
        await montar(true)
        fireEvent.click(document.querySelector('[data-title="scripture.verse_numbers"]') as HTMLElement)
        expect(get(scriptureSettings).verseNumbers).toBe(true)
    })

    it("abre el menú de versículos largos al activarlo", async () => {
        await montar(true)
        fireEvent.click(document.querySelector('[data-title="scripture.divide_long_verses"]') as HTMLElement)
        expect(get(scriptureSettings).splitLongVerses).toBe(true)
        expect(document.querySelector('[data-title="scripture.split_long_verses_suffix"]')).toBeTruthy()
    })

    it("permite convertir el show en un nuevo show de escritura", async () => {
        await montar()
        fireEvent.click(document.querySelector('[data-title="new.show_convert [Ctrl+N]"]') as HTMLElement)
        expect(mocks.convert).toHaveBeenCalled()
    })

    it("abre la edición de la plantilla cuando hay una sola salida", async () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(activeScripture, {}), looseEntry(drawerTabsData, { scripture: { activeSubTab: "bible1" } }), looseEntry(scriptureSettings, { customText: "$verse" }), looseEntry(templates, { scripture: { name: "Scripture", settings: {} } })])
        await montar()
        fireEvent.click(document.querySelector('[data-title="titlebar.edit"]') as HTMLElement)
        const edit = get(activeEdit) as { type?: string; id?: string }
        expect(edit.type).toBe("template")
        expect(get(activePage)).toBe("edit")
    })
})

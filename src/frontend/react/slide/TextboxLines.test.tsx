// @vitest-environment happy-dom
import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../types/Show"
import { outputs, slidesOptions, styles as stylesStore, variables } from "../../stores"
import { applyStyleOverrides } from "../../components/slide/wordOverride"
import { replaceDynamicValues } from "../../components/helpers/showActions"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { TextboxLines, type TextboxLinesProps } from "./TextboxLines"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/helpers/showActions", () => ({ replaceDynamicValues: vi.fn((value: string) => value) }))
vi.mock("../../components/slide/wordOverride", () => ({
    applyStyleOverrides: vi.fn((lines) => lines.map((line: { text?: unknown[] }) => ({ ...line, text: [{ value: "override", style: "color: green;" }] })))
}))

const ref = { type: "show" as const, id: "s1", showId: "sh1" }
const line = (value: string, style = "color: white; font-size: 60px;", extra: Record<string, unknown> = {}) => ({
    align: "",
    text: [{ value, style }],
    ...extra
})
const item = (lines: unknown[] = [line("Hola"), line("Mundo")], extra: Record<string, unknown> = {}) => ({ type: "text", lines, ...extra }) as unknown as Item
const renderLines = (props: Partial<TextboxLinesProps> = {}) => render(<TextboxLines item={item()} ref={ref} {...props} />).container

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(slidesOptions, { columns: 4, mode: "grid" }), looseEntry(stylesStore, {}), looseEntry(variables, {}), looseEntry(outputs, {})])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("TextboxLines", () => {
    it("renderiza las líneas y sus segmentos con el HTML del texto", () => {
        const container = renderLines()
        expect(container.querySelectorAll(".textContainer").length).toBe(2)
        expect(container.textContent).toContain("Hola")
        expect(container.textContent).toContain("Mundo")
    })

    it("convierte los saltos de línea del segmento en <br>", () => {
        const container = renderLines({ item: item([line("uno\ndos")]) })
        expect(container.querySelector(".textContainer br")).toBeTruthy()
    })

    it("aplica el estilo de la línea y el tamaño de fuente resuelto", () => {
        const container = renderLines({ item: item([line("Hola", "color: red; font-size: 50px;")]) })
        const segment = container.querySelector(".textContainer") as HTMLElement
        expect(segment.style.color).toBe("red")
        expect(segment.style.fontSize).toBe("50px")
        expect(segment.style.getPropertyValue("--base-font-size")).toBe("50px")
    })

    it("aplica el ratio de fontSize del estilo de salida", () => {
        const container = renderLines({ outputStyle: { aspectRatio: { fontSizeRatio: 200 } } as never })
        const segment = container.querySelector(".textContainer") as HTMLElement
        expect(segment.style.fontSize).toBe("120px")
    })

    it("respeta --base-font-size y font-size: calc sin reemplazar la fuente", () => {
        const container = renderLines({ item: item([line("Hola", "font-size: calc(1em + 2px); --base-font-size: 30px;")]) })
        const segment = container.querySelector(".textContainer") as HTMLElement
        expect(segment.style.fontSize).toBe("calc(1em + 2px)")
        expect(segment.style.getPropertyValue("--base-font-size")).toBe("12px")
    })

    it("aplica el gradiente de texto y quita la sombra por defecto", () => {
        const container = renderLines({
            item: item([line("Hola", "color: linear-gradient(red, blue); text-shadow: 2px 2px 10px #000000;")])
        })
        const segment = container.querySelector(".textContainer") as HTMLElement
        expect(segment.style.backgroundImage).toContain("linear-gradient")
        expect(segment.getAttribute("style")).toContain("transparent")
        expect(segment.style.textShadow).toBe("none")
    })

    it("convierte los colores a alpha cuando key está activo", () => {
        const container = renderLines({ alphaKey: true, item: item([line("Hola", "background-color: #ff0000; color: #80808080;")]) })
        const segment = container.querySelector(".textContainer") as HTMLElement
        expect(segment.style.backgroundColor).toBe("rgb(255 255 255 / 1)")
        expect(segment.style.color).toBe("rgb(255 255 255 / 0.5019607843137255)")
    })

    it("filtra y reajusta las líneas cuando hay linesStart y linesEnd", () => {
        const container = renderLines({
            item: item([line("a"), line("b"), line("c"), line("d")]),
            linesStart: 99,
            linesEnd: 101
        })
        expect(container.querySelectorAll(".textContainer").length).toBe(2)
    })

    it("oculta las líneas fuera de maxLines y las muestra atenuadas con showAsFaded", () => {
        const container = renderLines({
            item: item([line("a"), line("b"), line("c")]),
            maxLines: 1
        })
        expect(container.querySelectorAll(".textContainer").length).toBe(1)
        const faded = renderLines({
            item: item([line("a"), line("b")]),
            maxLines: 1,
            outputStyle: { showAsFaded: true, lineOpacity: 20 } as never
        })
        expect(faded.querySelectorAll(".textContainer").length).toBe(2)
        expect((faded.querySelectorAll(".break")[1] as HTMLElement).style.opacity).toBe("0.2")
    })

    it("aplica las clases de estado normalWrap, reveal y smallFontSize", () => {
        const container = renderLines({
            item: item([line("Hola", "", { align: "justify" }), line("Mundo")], { lineReveal: true }),
            centerPreview: true,
            revealed: -1,
            smallFontSize: true
        })
        const breaks = container.querySelectorAll(".break")
        expect(breaks[0].className).toContain("normalWrap")
        expect(breaks[1].className).not.toContain("normalWrap")
        expect(breaks[0].className).toContain("reveal")
        expect(breaks[0].className).toContain("smallFontSize")
        expect((container.querySelector(".lines") as HTMLElement).style.getPropertyValue("--font-size")).toBe("28px")
    })

    it("dibuja los recuadros de highlightedLines", () => {
        const container = renderLines({
            item: item([line("a"), line("b"), line("c")]),
            highlighedLines: [{ from: 1, to: 3, color: "red" }]
        })
        expect(container.querySelectorAll(".break > div").length).toBe(2)
        expect((container.querySelector(".break > div") as HTMLElement).style.borderLeft).toContain("red")
    })

    it("aplica el list-style cuando la lista está activa", () => {
        const container = renderLines({ item: item([line("Hola")], { list: { enabled: true, style: "circle" } }) })
        const breakElem = container.querySelector(".break") as HTMLElement
        expect(breakElem.style.display).toBe("list-item")
        expect(breakElem.style.listStyle).toContain("circle")
    })

    it("aplica el shape-outside y el float calculado", () => {
        renderLines({ item: item([], { style: "shape-outside: inset(10% 40% 10% 0%);" }) })
        const lines = document.querySelector(".lines") as HTMLElement
        const float = document.querySelector(".shape-outside-float") as HTMLElement
        expect(lines.className).toContain("hasShapeOutside")
        expect(float.style.shapeOutside).toContain("inset")
        expect(float.getAttribute("style")).toContain("left")
    })

    it("aplica los estilos de salida de acordes", async () => {
        const container = renderLines({
            item: item([line("Hola", "", { chords: [{ pos: 0, key: "C" }] })], { chords: { size: 100, color: "orange" } }),
            chords: true,
            fontSize: 40
        })
        await waitFor(() => expect(container.querySelector(".chords")).toBeTruthy())
        expect(container.querySelector(".chords")?.innerHTML).toContain("chord")
        expect((container.querySelector(".lines") as HTMLElement).style.getPropertyValue("--chord-color")).toBe("orange")
    })

    it("aplica las líneas de acordes sin texto como chordOnly", async () => {
        const container = renderLines({
            item: item([{ align: "", text: [{ value: "", style: "" }], chords: [{ pos: 1, key: "Am" }] }], { chords: { size: 50 } }),
            chords: true
        })
        await waitFor(() => expect(container.querySelector(".chordOnly")).toBeTruthy())
        expect(container.querySelector(".chordOnly")?.textContent).toContain("Am")
    })

    it("usa applyStyleOverrides cuando hay sobreescrituras", () => {
        const container = renderLines({ styleOverrides: [{ pattern: "Hola" }] as never })
        expect(applyStyleOverrides).toHaveBeenCalled()
        expect(container.textContent).toContain("override")
    })

    it("reemplaza los valores dinámicos y notifica el autosize tras varias actualizaciones", async () => {
        vi.useFakeTimers()
        vi.mocked(replaceDynamicValues).mockImplementation((_value, _ref, updater) => (updater === 0 ? "12:34" : "12:35"))
        const onUpdateAutoSize = vi.fn()
        render(<TextboxLines item={item([line("{time_}")])} ref={ref} onUpdateAutoSize={onUpdateAutoSize} />)
        act(() => vi.advanceTimersByTime(4000))
        expect(replaceDynamicValues).toHaveBeenCalled()
        expect(document.querySelector(".textContainer")?.textContent).toContain("12:35")
        expect(onUpdateAutoSize).toHaveBeenCalled()
        vi.useRealTimers()
    })

    it("no reemplaza los valores dinámicos cuando dynamicValues es falso", () => {
        render(<TextboxLines item={item([line("{time_}")])} ref={ref} dynamicValues={false} />)
        expect(replaceDynamicValues).not.toHaveBeenCalled()
        expect(document.querySelector(".textContainer")?.textContent).toContain("{time_}")
    })

    it("duplica las líneas en el scrolling continuo", () => {
        vi.stubGlobal(
            "ResizeObserver",
            class {
                constructor(private callback: ResizeObserverCallback) {}
                observe(target: Element) {
                    this.callback([{ target, contentRect: { width: 100, height: 50 } } as ResizeObserverEntry], this as never)
                }
                disconnect() {}
            }
        )
        const container = renderLines({ item: item([], { scrolling: { type: "left_right", gap: 10, speed: 20 } }) })
        expect(container.querySelectorAll(".lines").length).toBeGreaterThanOrEqual(2)
        expect((container.querySelector(".align") as HTMLElement).style.getPropertyValue("--scrollSpeed")).toBe("30s")
        vi.unstubAllGlobals()
    })

    it("oculta el contenido cuando hideContent está activo", () => {
        const container = renderLines({ hideContent: true })
        expect((container.firstElementChild as HTMLElement).className).toContain("hidden")
    })
})

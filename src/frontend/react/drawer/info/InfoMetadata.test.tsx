// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InfoMetadata } from "./InfoMetadata"

// Evita el ciclo language → common → save → apiHelper → historyHelpers (projectReplacers llama translateText al cargar).
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

afterEach(cleanup)

describe("InfoMetadata", () => {
    it("muestra el título y traduce las etiquetas", () => {
        render(<InfoMetadata title="Mi show" info={[{ label: "info.size", value: 10 }]} />)
        expect(screen.getByText("Mi show").getAttribute("data-title")).toBe("Mi show")
        expect(screen.getByText("info.size")).toBeTruthy()
        expect(screen.getByText("10")).toBeTruthy()
    })

    it("usa el texto de 'sin nombre' cuando no hay título", () => {
        render(<InfoMetadata info={[]} />)
        expect(screen.getByText("main.unnamed")).toBeTruthy()
    })

    it("recorta query y barra final en las URLs", () => {
        render(<InfoMetadata info={[{ label: "inputs.url", value: "https://canva.com/design/abc/view/?x=1", type: "url" }]} />)
        expect(screen.getByText("canva.com/design/abc/view")).toBeTruthy()
    })

    it("muestra una raya para los valores vacíos y formatea las fechas", () => {
        render(
            <InfoMetadata
                info={[
                    { label: "info.codecs", value: null },
                    { label: "info.created", value: 1700000000000, type: "date" }
                ]}
            />
        )
        expect(screen.getByText("—")).toBeTruthy()
        expect(screen.getByText(/2023/)).toBeTruthy()
    })

    it("marca como traducibles los valores con punto", () => {
        const { container } = render(<InfoMetadata info={[{ label: "info.category", value: "main.none" }]} />)
        expect(container.querySelector("[class*='default']")?.textContent).toBe("main.none")
    })
})

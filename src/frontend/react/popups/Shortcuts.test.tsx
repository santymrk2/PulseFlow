// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dictionary, os } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Shortcuts } from "./Shortcuts"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

let restaurar: () => void = () => {}
function montar(platform = "darwin") {
    restaurar = setStoresForTest([storeEntry(os, { platform, name: "", arch: "" }), storeEntry(dictionary, { actions: { selectAll: "Seleccionar todo", copy: "Copiar", fullscreen: "Pantalla completa" }, popup: { history: "Historial" }, main: { search: "Buscar" } })] as never)
    return render(<Shortcuts />)
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("Shortcuts", () => {
    it("en macOS muestra cmd y option y no la fila de fullscreen", () => {
        montar("darwin")
        expect(screen.getByText("Seleccionar todo").nextElementSibling?.textContent).toBe("cmd + a")
        expect(screen.getByText("Copiar").nextElementSibling?.textContent).toBe("cmd + c")
        expect(screen.getByText(/Show Import from Clipboard/).nextElementSibling?.textContent).toBe("cmd + option + i")
        expect(screen.queryByText("Pantalla completa")).toBeNull()
    })

    it("en Windows muestra ctrl y alt y la fila de fullscreen con f11", () => {
        montar("win32")
        expect(screen.getByText("Seleccionar todo").nextElementSibling?.textContent).toBe("ctrl + a")
        expect(screen.getByText(/Show Import from Clipboard/).nextElementSibling?.textContent).toBe("ctrl + alt + i")
        expect(screen.getByText("Pantalla completa").nextElementSibling?.textContent).toBe("f11")
    })

    it("renderiza todas las filas y las claves sin traducción se muestran tal cual", () => {
        montar()
        expect(screen.getByText("Historial").nextElementSibling?.textContent).toBe("cmd + ?")
        expect(screen.getByText("Buscar").nextElementSibling?.textContent).toBe("cmd + f")
        expect(screen.getByText("media.play").nextElementSibling?.textContent).toBe("cmd + Enter")
        expect(screen.getByText("clear.all").nextElementSibling?.textContent).toBe("esc")
    })
})

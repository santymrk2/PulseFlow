// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, dictionary, saved } from "../../shared/core/stores"
import { closeApp, save, saveComplete } from "../../app/wiring/save"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { Unsaved } from "./Unsaved"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/language", () => ({ translateText: (value: string) => value }))
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../app/wiring/save", () => ({ closeApp: vi.fn(), save: vi.fn(), saveComplete: vi.fn() }))

let restaurar: () => void = () => {}
function montar(savedValue = false) {
    restaurar = setStoresForTest([storeEntry(saved, savedValue), storeEntry(activePopup, "unsaved"), looseEntry(dictionary, { popup: { cancel: "Cancelar", quit: "Salir", save_quit: "Guardar y salir" }, main: { quit: "Salir" } })] as never)
    return render(<Unsaved />)
}
const boton = (texto: string) => screen.getByText(texto).closest("button") as HTMLElement

beforeEach(() => {
    vi.clearAllMocks()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("Unsaved", () => {
    it("sin guardar muestra cancelar, salir y guardar y salir", () => {
        montar(false)
        expect(screen.getByText("Cancelar")).toBeTruthy()
        expect(screen.getByText("Salir")).toBeTruthy()
        expect(screen.getByText("Guardar y salir")).toBeTruthy()
    })

    it("ya guardado muestra cancelar y guardar y salir (sin salir)", () => {
        montar(true)
        expect(screen.getByText("Cancelar")).toBeTruthy()
        expect(screen.queryByText("Salir")).toBeNull()
        expect(screen.getByText("Guardar y salir")).toBeTruthy()
    })

    it("cancelar cierra el popup y al desmontar avisa que se cancelló el cierre", () => {
        const { unmount } = montar()
        fireEvent.click(boton("Cancelar"))
        expect(get(activePopup)).toBeNull()
        unmount()
        expect(sendMain).toHaveBeenCalledWith(Main.CLOSE_CANCELLED)
    })

    it("salir llama a closeApp y no avisa el cierre cancelado", () => {
        const { unmount } = montar()
        fireEvent.click(boton("Salir"))
        expect(closeApp).toHaveBeenCalledTimes(1)
        unmount()
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("guardar y salir guarda primero si hay cambios", () => {
        const { unmount } = montar(false)
        fireEvent.click(boton("Guardar y salir"))
        expect(save).toHaveBeenCalledWith(true)
        expect(saveComplete).not.toHaveBeenCalled()
        unmount()
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("guardar y salir termina el guardado si ya estaba guardado", () => {
        const { unmount } = montar(true)
        fireEvent.click(boton("Guardar y salir"))
        expect(saveComplete).toHaveBeenCalledWith({ closeWhenFinished: true })
        expect(save).not.toHaveBeenCalled()
        unmount()
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("las teclas n, q e y hacen lo mismo que los botones", () => {
        montar(false)
        fireEvent.keyDown(window, { key: "n" })
        expect(get(activePopup)).toBeNull()
        fireEvent.keyDown(window, { key: "q" })
        expect(closeApp).toHaveBeenCalledTimes(1)
        fireEvent.keyDown(window, { key: "y" })
        expect(save).toHaveBeenCalledWith(true)
        fireEvent.keyDown(window, { key: "x" })
        expect(save).toHaveBeenCalledTimes(1)
    })

    it("el listener de teclado se quita al desmontar", () => {
        const { unmount } = montar()
        unmount()
        fireEvent.keyDown(window, { key: "q" })
        expect(closeApp).not.toHaveBeenCalled()
    })
})

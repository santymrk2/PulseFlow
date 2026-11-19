// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { requestMain, sendMain } from "../../shared/core/ipc/main"
import { activePopup, dictionary, popupData, showsCache } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { Restore } from "./Restore"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))

const DAY = 86400000
const backups = [
    { path: "/b/old", name: "antiguo", date: Date.now() - 40 * DAY, size: 2048 },
    { path: "/b/new", name: "reciente_auto", date: Date.now(), size: 500 }
]

let restaurar: () => void = () => {}
async function montar(list: object[] = backups, data: object = {}) {
    vi.mocked(requestMain).mockResolvedValue(list as never)
    restaurar = setStoresForTest([
        storeEntry(popupData, data),
        storeEntry(activePopup, "restore"),
        storeEntry(showsCache, { show: { name: "No borrar" } } as never),
        storeEntry(dictionary, {
            calendar: { today: "Hoy" },
            settings: { auto: "Auto", restore_confirm: "¿Seguro?" },
            inputs: { change_folder: "Cambiar carpeta" },
            actions: { back: "Volver", delete: "Borrar" }
        })
    ] as never)
    const view = render(<Restore />)
    await act(async () => {})
    return view
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("Restore", () => {
    it("pide los backups, los ordena por fecha y formatea nombre, tamaño y antigüedad", async () => {
        await montar()
        expect(requestMain).toHaveBeenCalledWith(Main.BACKUPS)
        expect(screen.getByText(/Auto/).textContent).toContain("500 B")
        expect(screen.getByText(/40d -/)).toBeTruthy()
        expect(screen.getByText(/Hoy -/)).toBeTruthy()
        expect(screen.getByText("2.00 KB")).toBeTruthy()
    })

    it("sin backups vacía showsCache y restaura el personalizado", async () => {
        await montar([])
        expect(get(showsCache)).toEqual({})
        expect(sendMain).toHaveBeenCalledWith(Main.RESTORE)
    })

    it("restaurar un backup abre confirm con el prompt y el trigger que envía RESTORE", async () => {
        await montar()
        fireEvent.click(screen.getByText("antiguo").closest("button") as HTMLElement)
        expect(get(activePopup)).toBe("confirm")
        const data = get(popupData)
        expect(data.prompt).toContain("<b>antiguo</b>")
        expect(data.prompt).toContain("¿Seguro?")
        data.trigger()
        expect(sendMain).toHaveBeenCalledWith(Main.RESTORE, { path: "/b/old" })
    })

    it("el botón back devuelve al popup indicado", async () => {
        await montar(backups, { back: "select_show" })
        fireEvent.click(document.querySelector('[data-title="Volver"]') as HTMLElement)
        expect(get(activePopup)).toBe("select_show")
    })

    it("borrar espera 5 s y llamar de nuevo al mismo botón lo deshace", async () => {
        const { container } = await montar()
        vi.useFakeTimers()
        const botonBorrar = () => container.querySelector('[data-title="Borrar"]') as HTMLElement
        fireEvent.click(botonBorrar())
        act(() => vi.advanceTimersByTime(4999))
        expect(sendMain).not.toHaveBeenCalledWith(Main.DELETE_BACKUP, expect.anything())
        fireEvent.click(botonBorrar())
        act(() => vi.advanceTimersByTime(5000))
        expect(sendMain).not.toHaveBeenCalledWith(Main.DELETE_BACKUP, expect.anything())
    })

    it("tras 5 s borra el backup pendiente y lo marca como eliminado", async () => {
        const { container } = await montar()
        vi.useFakeTimers()
        fireEvent.click(container.querySelector('[data-title="Borrar"]') as HTMLElement)
        act(() => vi.advanceTimersByTime(5000))
        expect(sendMain).toHaveBeenCalledWith(Main.DELETE_BACKUP, { path: "/b/old" })
        expect((container.querySelector('[data-title="Borrar"]') as HTMLButtonElement).disabled).toBe(true)
    })

    it("el botón de carpeta restauración personalizada también vacía showsCache", async () => {
        const { container } = await montar()
        fireEvent.click(screen.getByText("Cambiar carpeta").closest("button") as HTMLElement)
        expect(get(showsCache)).toEqual({})
        expect(sendMain).toHaveBeenCalledWith(Main.RESTORE)
        expect(container.querySelectorAll("button").length).toBeGreaterThan(0)
    })
})

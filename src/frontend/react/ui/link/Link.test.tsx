// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../shared/core/ipc/main"
import { Link } from "./Link"

vi.mock("../../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("Link", () => {
    it("renderiza_el_contenido", () => {
        render(<Link url="https://pulseflow.app">Sitio</Link>)
        expect(screen.getByText("Sitio")).toBeTruthy()
    })

    it("click_envia_la_url_al_backend", () => {
        render(<Link url="https://pulseflow.app">Sitio</Link>)
        fireEvent.click(screen.getByText("Sitio"))
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://pulseflow.app")
    })
})

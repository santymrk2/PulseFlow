// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { attachPersistentWebview } from "../../../components/slide/views/websiteDomPool"
import { Website } from "./Website"

vi.mock("../../../components/slide/views/websiteDomPool", () => ({ attachPersistentWebview: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })) }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("Website", () => {
    it("sin_source_valida_no_renderiza_el_webview", async () => {
        const { container } = render(<Website src="" />)
        await act(async () => {})
        expect(attachPersistentWebview).not.toHaveBeenCalled()
        expect(container.firstElementChild).toBeNull()
    })

    it("con_disablePreview_muestra_solo_el_icono_y_no_crea_webview", async () => {
        const { container } = render(<Website src="https://pulseflow.app" disablePreview />)
        await act(async () => {})
        expect(container.querySelector("svg")).toBeTruthy()
        expect(attachPersistentWebview).not.toHaveBeenCalled()
    })

    it("normaliza_la_url_agrega_el_protocolo_y_adjunta_el_webview", async () => {
        render(<Website src="www.pulseflow.app/{ruta}&amp;x=1" zoom={1.5} outputId="out1" />)
        await act(async () => {})
        expect(attachPersistentWebview).toHaveBeenCalledWith(expect.any(HTMLElement), { src: "http://www.pulseflow.app/%7Bruta%7D&x=1", zoom: 1.5, outputId: "out1" })
    })

    it("destruye_el_webview_al_desmontar", async () => {
        const destroy = vi.fn()
        vi.mocked(attachPersistentWebview).mockReturnValue({ update: vi.fn(), destroy } as never)
        const { unmount } = render(<Website src="https://pulseflow.app" />)
        await act(async () => {})
        unmount()
        expect(destroy).toHaveBeenCalled()
    })
})

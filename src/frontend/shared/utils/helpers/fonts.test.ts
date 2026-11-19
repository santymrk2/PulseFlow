import { beforeEach, describe, expect, it, vi } from "vitest"

const invoke = vi.hoisted(() => vi.fn())
vi.mock("@tauri-apps/api/core", () => ({ invoke }))
vi.mock("../../core/stores", () => ({ customFonts: {}, special: {} }))
vi.mock("./array", () => ({ sortByName: (a: unknown) => a }))
vi.mock("../../core/lib/store", () => ({ get: () => ({}) }))

describe("getSystemFontsList (F19)", () => {
    beforeEach(() => {
        vi.resetModules()
        invoke.mockReset()
        // WKWebView (macOS) no implementa queryLocalFonts
        vi.stubGlobal("queryLocalFonts", undefined)
    })

    it("lista las fuentes del sistema desde el backend aunque la webview no tenga queryLocalFonts", async () => {
        invoke.mockResolvedValue([
            { family: "Menlo", fullName: "Menlo", style: "Regular", postscriptName: "Menlo-Regular" },
            { family: "Menlo", fullName: "Menlo Bold", style: "Bold", postscriptName: "Menlo-Bold" }
        ])
        const { getSystemFontsList } = await import("./fonts")
        const labels = (await getSystemFontsList(false)).map((f) => f.label)
        expect(invoke).toHaveBeenCalledWith("LIST_SYSTEM_FONTS")
        expect(labels).toContain("Menlo")
    })
})

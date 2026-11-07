// Tests de `setupCloudSync` (F23.22): con `CAN_SYNC` en false, el pedido manual avisa
// con un toast y el automático (arranque, listeners, timers) no.
//
// Los módulos pesados (IPC, stores, UI, guardado, socket) se mockean: el helper sólo
// usa `requestMain`, `newToast` y los stores de sincronización en estas ramas.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { writable } from "svelte/store"

const mocks = vi.hoisted(() => ({ requestMain: vi.fn(), newToast: vi.fn(), contentProviderSync: vi.fn() }))

vi.mock("../IPC/main", () => ({ requestMain: mocks.requestMain, sendMain: vi.fn() }))
vi.mock("./common", () => ({ newToast: mocks.newToast, setStatus: vi.fn(), hasNewerUpdate: vi.fn(), isMainWindow: vi.fn(() => true), wait: vi.fn() }))
vi.mock("./startup", () => ({ contentProviderSync: mocks.contentProviderSync }))
vi.mock("./popup", () => ({ confirmCustom: vi.fn() }))
vi.mock("./save", () => ({ getSyncedSettings: vi.fn(), save: vi.fn() }))
vi.mock("./SocketHelper", () => ({ SocketHelper: class {} }))
vi.mock("../components/helpers/media", () => ({ isLocalFile: vi.fn() }))
vi.mock("../components/helpers/setShow", () => ({ loadShows: vi.fn() }))
vi.mock("../components/helpers/color", () => ({ generateLightRandomColor: vi.fn() }))
vi.mock("../components/helpers/array", () => ({ clone: (a: any) => a }))
vi.mock("../stores", () => ({
    alertMessage: writable(""),
    activePopup: writable(null),
    cloudSyncData: writable<any>({}),
    providerConnections: writable<any>({}),
    cloudUsers: writable([]),
    deviceId: writable(""),
    special: writable({}),
    shows: writable({}),
    showsCache: writable({}),
    saved: writable(true),
    activeEdit: writable({}),
    activePage: writable(""),
    activeProject: writable(null),
    activeShow: writable(null),
    deletedShows: writable([]),
    renamedShows: writable([]),
    focusMode: writable(false),
    popupData: writable({}),
    scripturesCache: writable({})
}))

const { setupCloudSync } = await import("./cloudSync")
const stores = await import("../stores")

beforeEach(() => {
    vi.clearAllMocks()
    mocks.requestMain.mockImplementation(async (channel: string) => (channel === "CAN_SYNC" ? false : undefined))
    ;(stores.cloudSyncData as any).set({ enabled: true, id: "churchApps", team: { churchId: "c", id: "t" } })
    ;(stores.providerConnections as any).set({})
})

describe("setupCloudSync con CAN_SYNC en false (F23.22)", () => {
    it("el pedido manual (botón) avisa que la función no está disponible", async () => {
        await setupCloudSync()

        expect(mocks.newToast).toHaveBeenCalledTimes(1)
        expect(mocks.newToast).toHaveBeenCalledWith("toast.feature_unavailable")
    })

    it("el pedido manual con sync apagada (enabled false) también avisa", async () => {
        ;(stores.cloudSyncData as any).set({ enabled: false, id: "churchApps" })

        await setupCloudSync()

        expect(mocks.newToast).toHaveBeenCalledWith("toast.feature_unavailable")
    })

    it("el arranque (auto) no avisa", async () => {
        await setupCloudSync(true)

        expect(mocks.newToast).not.toHaveBeenCalled()
    })

    it("el listener de PROVIDER_CONNECT (notify en false) no avisa", async () => {
        await setupCloudSync(false, false)

        expect(mocks.newToast).not.toHaveBeenCalled()
    })
})

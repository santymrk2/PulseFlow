// ----- FreeShow -----
// Store global del frontend React (Zustand), equivalente a los Svelte stores de
// `src/frontend/stores.ts`.

import { create } from "zustand"
import type { TrimmedShows } from "@/types/Show"

export type ConnectionStatus = "connecting" | "connected" | "offline"

/** Páginas principales del shell (equivalente a `activePage` en Svelte). */
export type AppPage = "show" | "edit" | "stage" | "settings"

/** Categorías de la página Configuración (equivalente a `settingsTab`). */
export type SettingsTabId =
    | "general"
    | "shortcuts"
    | "screens"
    | "integrations"
    | "pco"
    | "stream"
    | "overlays"
    | "templates"

interface AppState {
    /** Estado del handshake con el backend Tauri. */
    status: ConnectionStatus
    /** Shows de la biblioteca (id → información recortada). */
    shows: TrimmedShows
    /** Ajustes sincronizados con el backend (`SETTINGS`). */
    settings: Record<string, any> | null
    /** Página activa del shell. */
    page: AppPage
    /** Pestaña activa de Configuración. */
    settingsTab: SettingsTabId

    setStatus: (status: ConnectionStatus) => void
    setShows: (shows: TrimmedShows) => void
    setSettings: (settings: Record<string, any>) => void
    setPage: (page: AppPage) => void
    setSettingsTab: (tab: SettingsTabId) => void
}

export const useAppStore = create<AppState>((set) => ({
    status: "connecting",
    shows: {},
    settings: null,
    page: "show",
    settingsTab: "general",

    setStatus: (status) => set({ status }),
    setShows: (shows) => set({ shows, status: "connected" }),
    setSettings: (settings) => set({ settings }),
    setPage: (page) => set({ page }),
    setSettingsTab: (settingsTab) => set({ settingsTab }),
}))

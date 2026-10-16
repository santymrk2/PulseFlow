// ----- FreeShow -----
// Shell de la ventana de Control.
//
//   ┌───────────────────────── Topbar ─────────────────────────┐
//   │  logo          Show / Edit / Stage        Settings  ⏻   │
//   ├──────────────┬──────────────────────────┬───────────────┤
//   │  panel izq.  │        centro            │  panel der.   │
//   ├──────────────┴──────────────────────────┴───────────────┤
//   │                        Drawer                            │
//   └──────────────────────────────────────────────────────────┘

import { useEffect, useState } from "react"
import Drawer from "@/components/Drawer"
import Editor from "@/components/Editor"
import ImportDialog from "@/components/ImportDialog"
import LibraryPanel from "@/components/LibraryPanel"
import MediaPlaybackBar from "@/components/MediaPlaybackBar"
import OutputSetupDialog from "@/components/OutputSetupDialog"
import RightPanel from "@/components/RightPanel"
import SettingsContent from "@/components/SettingsContent"
import SettingsTabs from "@/components/SettingsTabs"
import SettingsTools from "@/components/SettingsTools"
import SlidesPanel from "@/components/SlidesPanel"
import StageView from "@/components/StageView"
import Topbar from "@/components/Topbar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useActions } from "@/hooks/useActions"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useProjectionBroadcast } from "@/hooks/useProjectionSync"
import { useShowLoader } from "@/hooks/useShowLoader"
import { useStartup } from "@/hooks/useStartup"
import { useAppStore, type AppPage } from "@/store/useAppStore"
import { useShowStore } from "@/store/useShowStore"

function LeftPanel({ page }: { page: AppPage }) {
  const title = page === "show" ? "Proyectos" : page === "edit" ? "Diapositivas" : "Escenario"

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-900">
      <header className="flex h-9 shrink-0 items-center border-b px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {page === "show" ? (
          <LibraryPanel />
        ) : page === "edit" ? (
          <SlidesPanel />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            Selecciona un escenario
          </div>
        )}
      </div>
    </aside>
  )
}

export default function App() {
  useStartup()
  useShowLoader()
  useKeyboardShortcuts()
  useActions()
  useProjectionBroadcast()

  const page = useAppStore((s) => s.page)
  const setPage = useAppStore((s) => s.setPage)
  const [importOpen, setImportOpen] = useState(false)
  const [outputSetupOpen, setOutputSetupOpen] = useState(false)

  // Importar (Ctrl/Cmd+I) — el resto de acciones viven en la barra superior.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault()
        setImportOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar onOutputSetup={() => setOutputSetupOpen(true)} />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="22" minSize="16" className="min-w-0">
          {page === "settings" ? <SettingsTabs /> : <LeftPanel page={page} />}
        </ResizablePanel>

        <ResizableHandle className="bg-border" />

        <ResizablePanel defaultSize="56" minSize="30" className="min-w-0">
          <main className="h-full min-h-0">
            {page === "settings" ? (
              <SettingsContent />
            ) : page === "stage" ? (
              <StageView embedded />
            ) : (
              <Editor />
            )}
          </main>
        </ResizablePanel>

        <ResizableHandle className="bg-border" />

        <ResizablePanel defaultSize="22" minSize="16" className="min-w-0">
          {page === "settings" ? <SettingsTools /> : <RightPanel />}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* MediaBar (reproducción del medio activo) — sólo en Show/Edit, encima del drawer. */}
      {(page === "show" || page === "edit") && <MediaPlaybackBar />}

      {/* El drawer (paneles inferiores) solo tiene sentido en Show/Edit, igual que en Svelte. */}
      {(page === "show" || page === "edit") && <Drawer />}

      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImported={(id, name) => {
            setPage("edit")
            useShowStore.getState().openShow(id, name)
          }}
        />
      )}

      {outputSetupOpen && <OutputSetupDialog onClose={() => setOutputSetupOpen(false)} />}
    </div>
  )
}

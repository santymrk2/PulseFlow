// ----- FreeShow -----
// Barra superior. Conserva la distribución espacial de `Top.svelte`
// (logo a la izquierda, pestañas de página centradas, acciones a la derecha)
// pero con la estética estándar de shadcn/ui.

import { Edit3, Monitor, MonitorPlay, Settings, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MAIN } from "@/IPC/channels"
import { cn } from "@/lib/utils"
import { useAppStore, type AppPage } from "@/store/useAppStore"
import { useProjectionStore } from "@/store/useProjectionStore"

const pages: { id: AppPage; label: string; icon: typeof Monitor }[] = [
  { id: "show", label: "Show", icon: Monitor },
  { id: "edit", label: "Edit", icon: Edit3 },
  { id: "stage", label: "Stage", icon: Users },
]

interface TopbarProps {
  onOutputSetup?: () => void
}

export default function Topbar({ onOutputSetup }: TopbarProps) {
  const page = useAppStore((s) => s.page)
  const setPage = useAppStore((s) => s.setPage)
  const outputVisible = useProjectionStore((s) => s.visible)
  const setProjection = useProjectionStore((s) => s.setProjection)
  const clear = useProjectionStore((s) => s.clear)

  function toggleOutput() {
    if (outputVisible) {
      clear()
      window.api?.send(MAIN, { channel: "CLOSE_OUTPUT_WINDOW" })
      return
    }
    setProjection({ visible: true })
    window.api?.send(MAIN, { channel: "OPEN_OUTPUT_WINDOW" })
  }

  return (
    <header
      data-tauri-drag-region
      className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-3 select-none"
    >
      {/* Logo */}
      <span data-tauri-drag-region className="flex w-52 items-center">
        <h1 data-tauri-drag-region className="px-1 text-sm font-semibold tracking-tight">
          FreeShow
        </h1>
      </span>

      {/* Pestañas de página */}
      <nav className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {pages.map(({ id, label, icon: Icon }) => {
          const active = page === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Acciones */}
      <div className="flex w-52 items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          title="Configuración"
          onClick={() => setPage("settings")}
          className={cn(page === "settings" && "bg-muted text-foreground")}
        >
          <Settings className="size-4" />
        </Button>

        <Button
          variant={outputVisible ? "destructive" : "ghost"}
          size="icon"
          title={outputVisible ? "Detener salida" : "Mostrar salida"}
          onClick={toggleOutput}
          onContextMenu={(e) => {
            e.preventDefault()
            onOutputSetup?.()
          }}
        >
          <MonitorPlay className="size-4" />
        </Button>
      </div>
    </header>
  )
}

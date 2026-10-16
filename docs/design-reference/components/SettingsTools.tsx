// ----- FreeShow -----
// Panel derecho de Configuración: herramientas del contexto activo.

import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store/useAppStore"

export default function SettingsTools() {
  const setPage = useAppStore((s) => s.setPage)

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-900">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Settings2 className="size-3.5" />
        Herramientas
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground hover:text-foreground"
          onClick={() => setPage("show")}
        >
          Cerrar configuración
        </Button>
      </div>
    </aside>
  )
}

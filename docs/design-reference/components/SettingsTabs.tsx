// ----- FreeShow -----
// Panel izquierdo de Configuración: lista vertical de categorías.

import { settingsTabs } from "@/lib/settingsTabs"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"

export default function SettingsTabs() {
  const active = useAppStore((s) => s.settingsTab)
  const setTab = useAppStore((s) => s.setSettingsTab)

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-900">
      <header className="flex h-9 shrink-0 items-center border-b px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Configuración
      </header>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {settingsTabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
                isActive
                  ? "bg-zinc-800 text-foreground"
                  : "text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

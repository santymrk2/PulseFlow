// ----- FreeShow -----
// Drawer inferior: barra de pestañas de categoría + buscador, con el contenido
// de la pestaña activa debajo. Se redimensiona arrastrando el borde superior y
// se colapsa/abre al hacer clic en la cabecera (ubicación espacial de Svelte,
// estética shadcn/ui).

import { useEffect, useRef, useState } from "react"
import {
  BookOpen,
  Calendar,
  Images,
  LayoutTemplate,
  Layers,
  Library,
  ListMusic,
  Search,
  X,
} from "lucide-react"
import AudioMixerPanel from "@/components/AudioMixerPanel"
import CalendarPanel from "@/components/CalendarPanel"
import LibraryPanel from "@/components/LibraryPanel"
import MediaPanel from "@/components/MediaPanel"
import OverlaysLibraryPanel from "@/components/OverlaysLibraryPanel"
import ScripturePanel from "@/components/ScripturePanel"
import TemplatesPanel from "@/components/TemplatesPanel"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MIN_HEIGHT = 40
const DEFAULT_HEIGHT = 300
const TOP_HEIGHT = 40

type DrawerTabId =
  | "shows"
  | "media"
  | "audio"
  | "scripture"
  | "calendar"
  | "overlays"
  | "templates"

const drawerTabs: { id: DrawerTabId; label: string; icon: typeof Library }[] = [
  { id: "shows", label: "Shows", icon: Library },
  { id: "media", label: "Media", icon: Images },
  { id: "audio", label: "Audio", icon: ListMusic },
  { id: "scripture", label: "Scripture", icon: BookOpen },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "overlays", label: "Overlays", icon: Layers },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
]

function DrawerTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Library
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex shrink-0 items-center gap-2 border-b-2 px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

export default function Drawer() {
  const [activeTab, setActiveTab] = useState<DrawerTabId>("shows")
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const drag = useRef<{ startY: number; startHeight: number } | null>(null)

  const toggle = () => setHeight((h) => (h > MIN_HEIGHT ? MIN_HEIGHT : DEFAULT_HEIGHT))

  const openTab = (id: DrawerTabId) => {
    setActiveTab(id)
    setHeight((h) => (h > MIN_HEIGHT ? h : DEFAULT_HEIGHT))
  }

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    drag.current = { startY: e.clientY, startHeight: height > MIN_HEIGHT ? height : DEFAULT_HEIGHT }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return
      const maxHeight = window.innerHeight - TOP_HEIGHT - 60
      const next = drag.current.startHeight + (drag.current.startY - e.clientY)
      setHeight(Math.min(Math.max(next, MIN_HEIGHT), maxHeight))
    }
    const onUp = () => {
      drag.current = null
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [])

  const onHeaderClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return
    toggle()
  }

  const clearSearch = () => {
    setSearchValue("")
    setSearchOpen(false)
  }

  return (
    <section className="relative z-20 flex w-full flex-col border-t bg-zinc-900" style={{ height }}>
      <div
        className="relative flex h-10 shrink-0 cursor-pointer items-center justify-between"
        onClick={onHeaderClick}
      >
        <div
          className="absolute top-0 left-0 h-1 w-full cursor-ns-resize bg-border"
          onMouseDown={onDragStart}
        />

        <span className="flex overflow-x-auto overflow-y-hidden">
          {drawerTabs.map(({ id, label, icon }) => (
            <DrawerTab
              key={id}
              active={activeTab === id}
              icon={icon}
              label={label}
              onClick={() => openTab(id)}
            />
          ))}
        </span>

        <div className="flex items-center pr-2 pl-2">
          {searchOpen ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Buscar…"
                className="h-8 w-64"
              />
              <button
                type="button"
                title="Limpiar"
                onClick={clearSearch}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="Buscar [Ctrl+F]"
              onClick={() => setSearchOpen(true)}
              className="flex h-8 w-64 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Search className="size-4" />
              <span>Buscar</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 justify-between overflow-hidden">
        {activeTab === "shows" && <LibraryPanel />}
        {activeTab === "media" && <MediaPanel />}
        {activeTab === "audio" && <AudioMixerPanel />}
        {activeTab === "scripture" && <ScripturePanel />}
        {activeTab === "calendar" && <CalendarPanel />}
        {activeTab === "overlays" && <OverlaysLibraryPanel />}
        {activeTab === "templates" && <TemplatesPanel />}
      </div>
    </section>
  )
}

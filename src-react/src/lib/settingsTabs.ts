// ----- FreeShow -----
// Categorías de la página Configuración (id, etiqueta e icono).

import { Cloud, FolderCog, KeyboardIcon, LayoutTemplate, Layers, Monitor, Radio, Users } from "lucide-react"
import type { SettingsTabId } from "@/store/useAppStore"

export const settingsTabs: { id: SettingsTabId; label: string; icon: typeof FolderCog }[] = [
  { id: "general", label: "General", icon: FolderCog },
  { id: "shortcuts", label: "Atajos", icon: KeyboardIcon },
  { id: "screens", label: "Pantallas", icon: Monitor },
  { id: "integrations", label: "Integraciones", icon: Cloud },
  { id: "pco", label: "Planning Center", icon: Users },
  { id: "stream", label: "Servidor", icon: Radio },
  { id: "overlays", label: "Overlays", icon: Layers },
  { id: "templates", label: "Plantillas", icon: LayoutTemplate },
]

// ----- FreeShow -----
// Panel derecho: vista previa de la salida (arriba) y herramientas del contexto
// activo (debajo), equivalente al panel `.right` de `MainLayout.svelte`.

import ActionsPanel from "@/components/ActionsPanel"
import AlertsPanel from "@/components/AlertsPanel"
import ClearControls from "@/components/ClearControls"
import EffectsPanel from "@/components/EffectsPanel"
import GroupsPanel from "@/components/GroupsPanel"
import OverlayControls from "@/components/OverlayControls"
import ProjectionControls from "@/components/ProjectionControls"
import SlideProperties from "@/components/SlideProperties"
import TimersPanel from "@/components/TimersPanel"
import { ScrollArea } from "@/components/ui/scroll-area"

function Divider() {
  return <div className="mx-3 h-px shrink-0 bg-border" />
}

export default function RightPanel() {
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-900">
      <ScrollArea className="min-h-0 flex-1">
        <ProjectionControls />
        <Divider />
        <SlideProperties />
        <Divider />
        <ClearControls />
        <Divider />
        <OverlayControls />
        <Divider />
        <GroupsPanel />
        <Divider />
        <TimersPanel />
        <Divider />
        <AlertsPanel />
        <Divider />
        <EffectsPanel />
        <Divider />
        <ActionsPanel />
      </ScrollArea>
    </aside>
  )
}

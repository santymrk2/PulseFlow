// ----- FreeShow -----
// Barra de Propiedades (panel derecho) del editor de diapositivas. Reúne en
// pestañas los distintos editores, al estilo de `EditTools.svelte`:
//   · Texto    → contenido y estilo del texto (SlideEditor)
//   · Elemento → lista de items y estilo de la caja (ItemsPanel + ItemStylePanel)
//   · Slide    → fondo y transición (SlideStylePanel)

import ItemStylePanel from "@/components/ItemStylePanel"
import ItemsPanel from "@/components/ItemsPanel"
import SlideEditor from "@/components/SlideEditor"
import SlideNotes from "@/components/SlideNotes"
import SlideStylePanel from "@/components/SlideStylePanel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useShowStore } from "@/store/useShowStore"

export default function SlideProperties() {
    const selectedSlideId = useShowStore((s) => s.selectedSlideId)

    if (!selectedSlideId) return null

    return (
        <Tabs defaultValue="text" className="gap-0">
            <div className="px-3 pt-3">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="text">Texto</TabsTrigger>
                    <TabsTrigger value="item">Elemento</TabsTrigger>
                    <TabsTrigger value="slide">Slide</TabsTrigger>
                    <TabsTrigger value="notes">Notas</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="text">
                <SlideEditor />
            </TabsContent>
            <TabsContent value="item">
                <ItemsPanel />
                <ItemStylePanel />
            </TabsContent>
            <TabsContent value="slide">
                <SlideStylePanel />
            </TabsContent>
            <TabsContent value="notes">
                <SlideNotes />
            </TabsContent>
        </Tabs>
    )
}
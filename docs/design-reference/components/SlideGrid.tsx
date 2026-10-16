// ----- FreeShow -----
// Cuadrícula de diapositivas del show activo con reordenación Drag & Drop
// (@dnd-kit) y menú contextual por diapositiva. El orden se aplica al layout
// activo vía `useShowStore`.

import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToParentElement } from "@dnd-kit/modifiers"
import {
    SortableContext,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Copy, FileX2, MonitorPlay, Trash2 } from "lucide-react"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import SlideThumbnail from "@/components/SlideThumbnail"
import { cn } from "@/lib/utils"
import { getActiveLayoutId, getShowResolution } from "@/lib/show"
import { projectSlide } from "@/lib/outputActions"
import { useGroupsStore } from "@/store/useGroupsStore"
import { useShowStore } from "@/store/useShowStore"
import type { Resolution, Slide } from "@/types/Show"

function SortableSlide({
    id,
    index,
    slide,
    resolution,
    selected,
    onSelect,
}: {
    id: string
    index: number
    slide: Slide
    resolution: Resolution
    selected: boolean
    onSelect: (id: string) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const duplicateSlide = useShowStore((s) => s.duplicateSlide)
    const deleteSlide = useShowStore((s) => s.deleteSlide)
    const groupLabel = useGroupsStore((s) => s.label)
    const groupColor = useGroupsStore((s) => s.color)

    const groupId = slide.group && slide.group !== "." ? slide.group : ""

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={setNodeRef}
                    style={{
                        transform: CSS.Transform.toString(transform),
                        transition,
                        touchAction: "none",
                        opacity: isDragging ? 0.4 : 1,
                        zIndex: isDragging ? 50 : undefined,
                    }}
                    {...attributes}
                    {...listeners}
                    onClick={() => onSelect(id)}
                    className={cn(
                        "group relative cursor-grab overflow-hidden rounded-lg border bg-zinc-900 shadow-sm transition-shadow select-none",
                        selected ? "border-blue-500 ring-2 ring-blue-500/60" : "border-zinc-800 hover:border-zinc-600",
                        isDragging && "cursor-grabbing shadow-2xl"
                    )}
                >
                    <SlideThumbnail slide={slide} resolution={resolution} />
                    <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                        {index + 1}
                    </span>
                    {groupId && (
                        <span
                            className="pointer-events-none absolute top-1 right-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                            style={{ backgroundColor: groupColor(groupId) }}
                        >
                            {groupLabel(groupId)}
                        </span>
                    )}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={() => projectSlide(id)}>
                    <MonitorPlay />
                    Proyectar
                </ContextMenuItem>
                <ContextMenuItem onClick={() => duplicateSlide(id)}>
                    <Copy />
                    Duplicar
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={() => deleteSlide(id)}>
                    <Trash2 />
                    Eliminar
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}

export default function SlideGrid() {
    const show = useShowStore((s) => s.show)
    const selectedSlideId = useShowStore((s) => s.selectedSlideId)
    const selectSlide = useShowStore((s) => s.selectSlide)
    const reorderSlides = useShowStore((s) => s.reorderSlides)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const layoutId = getActiveLayoutId(show)
    const groupIds = show?.layouts?.[layoutId]?.slides?.map((group) => group.id) ?? []
    const resolution = getShowResolution(show)

    if (!show || groupIds.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-zinc-600">
                <FileX2 className="size-6" />
                <p className="text-xs">
                    {show ? "Este show no tiene diapositivas" : "Selecciona un show de la biblioteca"}
                </p>
            </div>
        )
    }

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return
        const from = groupIds.indexOf(String(active.id))
        const to = groupIds.indexOf(String(over.id))
        if (from !== -1 && to !== -1) reorderSlides(from, to)
    }

    return (
        <div className="flex-1 overflow-y-auto p-4">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToParentElement]}
                onDragEnd={onDragEnd}
            >
                <SortableContext items={groupIds} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                        {groupIds.map((id, index) => (
                            <SortableSlide
                                key={id}
                                id={id}
                                index={index}
                                slide={show.slides[id] ?? { items: [] }}
                                resolution={resolution}
                                selected={selectedSlideId === id}
                                onSelect={selectSlide}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}

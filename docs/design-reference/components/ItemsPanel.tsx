// ----- FreeShow -----
// Panel "Elementos": lista las cajas de contenido de la diapositiva seleccionada
// y permite seleccionarlas, añadir/duplicar/eliminar y cambiar su orden (z-order).
// Port reducido de `edit/tools/ItemsList.svelte`.

import { ArrowDown, ArrowUp, Copy, Plus, Square, Trash2, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addTextItem, duplicateItem, isTextItem, rearrangeItems, removeItem } from "@/lib/itemStyles"
import { getSlideText } from "@/lib/show"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/store/useEditorStore"
import { useShowStore } from "@/store/useShowStore"
import type { Item } from "@/types/Show"

function itemLabel(item: Item, index: number): string {
    if (isTextItem(item)) {
        const text = getSlideText({ items: [item] }).replace(/\n+/g, " ").trim()
        return text ? (text.length > 24 ? `${text.slice(0, 24)}…` : text) : "Caja de texto vacía"
    }
    return `${item.type} ${index + 1}`
}

function ItemIcon({ item }: { item: Item }) {
    if (isTextItem(item)) return <Type className="size-3.5" />
    return <Square className="size-3.5" />
}

export default function ItemsPanel() {
    const show = useShowStore((s) => s.show)
    const selectedSlideId = useShowStore((s) => s.selectedSlideId)
    const updateSlide = useShowStore((s) => s.updateSlide)
    const activeSlideId = useEditorStore((s) => s.slideId)
    const activeItemIndex = useEditorStore((s) => s.itemIndex)
    const selectItem = useEditorStore((s) => s.selectItem)

    if (!show || !selectedSlideId) return null
    const slide = show.slides[selectedSlideId]
    if (!slide) return null

    const items = slide.items ?? []
    const selected = activeSlideId === selectedSlideId ? activeItemIndex : null

    const select = (index: number) => {
        selectItem(selectedSlideId, selected === index ? null : index)
    }

    const addText = () => {
        const { slide: next, index } = addTextItem(slide)
        updateSlide(selectedSlideId, next)
        selectItem(selectedSlideId, index)
    }

    const remove = (index: number) => {
        updateSlide(selectedSlideId, removeItem(slide, index))
        if (selected === index) selectItem(selectedSlideId, null)
    }

    const duplicate = (index: number) => {
        const { slide: next, index: newIndex } = duplicateItem(slide, index)
        updateSlide(selectedSlideId, next)
        selectItem(selectedSlideId, newIndex)
    }

    const move = (index: number, direction: "up" | "down") => {
        const type = direction === "up" ? "forward" : "backward"
        const { slide: next, index: newIndex } = rearrangeItems(slide, type, index)
        updateSlide(selectedSlideId, next)
        selectItem(selectedSlideId, newIndex)
    }

    return (
        <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                    Elementos ({items.length})
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={addText}
                    className="h-6 gap-1 text-zinc-500 hover:text-zinc-200"
                >
                    <Plus className="size-3.5" />
                    Texto
                </Button>
            </div>

            {items.length === 0 && <p className="text-xs text-zinc-600">Esta diapositiva no tiene elementos.</p>}

            <div className="flex flex-col gap-1">
                {items.map((item, index) => (
                    <div
                        key={index}
                        role="button"
                        tabIndex={0}
                        onClick={() => select(index)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") select(index)
                        }}
                        className={cn(
                            "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                            selected === index
                                ? "border-indigo-500/60 bg-indigo-500/10 text-zinc-100"
                                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700",
                        )}
                    >
                        <span className="shrink-0 text-zinc-500">
                            <ItemIcon item={item} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{itemLabel(item, index)}</span>
                        <span className="flex shrink-0 items-center">
                            <button
                                type="button"
                                title="Subir"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    move(index, "up")
                                }}
                                className="flex size-5 items-center justify-center rounded text-zinc-600 hover:text-zinc-200"
                            >
                                <ArrowUp className="size-3" />
                            </button>
                            <button
                                type="button"
                                title="Bajar"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    move(index, "down")
                                }}
                                className="flex size-5 items-center justify-center rounded text-zinc-600 hover:text-zinc-200"
                            >
                                <ArrowDown className="size-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => duplicate(index)}
                                title="Duplicar"
                                className="flex size-5 items-center justify-center rounded text-zinc-600 hover:text-zinc-200"
                            >
                                <Copy className="size-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(index)}
                                title="Eliminar"
                                className="flex size-5 items-center justify-center rounded text-zinc-600 hover:text-red-400"
                            >
                                <Trash2 className="size-3" />
                            </button>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

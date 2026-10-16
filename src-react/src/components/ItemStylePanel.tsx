// ----- FreeShow -----
// Panel "Estilo del elemento": edita la caja (posición/tamaño), la rotación, la
// opacidad, el fondo, el borde y el desenfoque del item activo. Port reducido de
// `edit/tools/ItemStyle.svelte` (sección de posición y caja) adaptado a React.

import { Move } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { getFilterValue, getItemStyleMap, setItemsStyle } from "@/lib/itemStyles"
import { useEditorStore } from "@/store/useEditorStore"
import { useShowStore } from "@/store/useShowStore"

const FIELDS = [
    { key: "top", label: "Arriba" },
    { key: "left", label: "Izquierda" },
    { key: "width", label: "Ancho" },
    { key: "height", label: "Alto" },
] as const

function pxNumber(value: string | undefined): number {
    if (!value) return 0
    const parsed = parseFloat(value)
    return Number.isNaN(parsed) ? 0 : parsed
}

/** Grados de rotación desde una cadena `transform` (`rotate(-15deg)`). */
function rotateDegrees(transform: string | undefined): number {
    if (!transform) return 0
    const match = transform.match(/rotate\(([-\d.]+)deg\)/)
    return match ? Number(match[1]) : 0
}

export default function ItemStylePanel() {
    const show = useShowStore((s) => s.show)
    const selectedSlideId = useShowStore((s) => s.selectedSlideId)
    const updateSlide = useShowStore((s) => s.updateSlide)
    const activeSlideId = useEditorStore((s) => s.slideId)
    const activeItemIndex = useEditorStore((s) => s.itemIndex)

    if (!show || !selectedSlideId) return null
    const slide = show.slides[selectedSlideId]
    if (!slide) return null

    const index = activeSlideId === selectedSlideId ? activeItemIndex : null
    const item = index != null ? slide.items?.[index] : undefined

    if (index == null || !item) {
        return (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-zinc-600">
                <Move className="size-4" />
                <p className="text-xs">Selecciona un elemento de la lista para editar su caja y estilo.</p>
            </div>
        )
    }

    const style = getItemStyleMap(item)
    const update = (declarations: Record<string, string>) =>
        updateSlide(selectedSlideId, setItemsStyle(slide, [index], declarations))
    const setAuto = (value: boolean) => {
        const items = [...(slide.items ?? [])]
        items[index] = { ...item, auto: value }
        updateSlide(selectedSlideId, { ...slide, items })
    }

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <Move className="size-3.5" />
                Caja
            </div>

            <div className="grid grid-cols-2 gap-2">
                {FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-1">
                        <Label className="text-[10px] text-zinc-500">{label}</Label>
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                value={pxNumber(style[key])}
                                onChange={(event) => update({ [key]: `${event.target.value || 0}px` })}
                                className="h-7 text-xs"
                            />
                            <span className="text-[10px] text-zinc-600">px</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-500">Ajuste automático</Label>
                <Switch checked={item.auto !== false} onCheckedChange={setAuto} />
            </div>

            <div className="flex items-center gap-2">
                <Label className="w-20 shrink-0 text-xs text-zinc-500">Rotar</Label>
                <Input
                    type="number"
                    value={rotateDegrees(style.transform)}
                    onChange={(event) => update({ transform: `rotate(${event.target.value || 0}deg)` })}
                    className="h-7 flex-1 text-xs"
                />
                <span className="text-[10px] text-zinc-600">°</span>
            </div>

            <div className="flex items-center gap-2">
                <Label className="w-20 shrink-0 text-xs text-zinc-500">Opacidad</Label>
                <Input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(parseFloat(style.opacity ?? "1") * 100) || 0}
                    onChange={(event) => update({ opacity: `${(Number(event.target.value || 0) / 100).toFixed(2)}` })}
                    className="h-7 flex-1 text-xs"
                />
                <span className="text-[10px] text-zinc-600">%</span>
            </div>

            <div className="flex items-center gap-2">
                <Label className="w-20 shrink-0 text-xs text-zinc-500">Redondeo</Label>
                <Input
                    type="number"
                    value={pxNumber(style["border-radius"])}
                    onChange={(event) => update({ "border-radius": `${event.target.value || 0}px` })}
                    className="h-7 flex-1 text-xs"
                />
                <span className="text-[10px] text-zinc-600">px</span>
            </div>

            <div className="flex items-center gap-2">
                <Label className="w-20 shrink-0 text-xs text-zinc-500">Relleno</Label>
                <Input
                    type="number"
                    value={pxNumber(style.padding)}
                    onChange={(event) => update({ padding: `${event.target.value || 0}px` })}
                    className="h-7 flex-1 text-xs"
                />
                <span className="text-[10px] text-zinc-600">px</span>
            </div>

            <div className="flex items-center gap-2">
                <Label className="w-20 shrink-0 text-xs text-zinc-500">Desenfoque</Label>
                <Input
                    type="number"
                    value={getFilterValue(style["backdrop-filter"], "blur")}
                    onChange={(event) => {
                        const value = Number(event.target.value || 0)
                        update({ "backdrop-filter": value > 0 ? `blur(${value}px)` : "" })
                    }}
                    className="h-7 flex-1 text-xs"
                />
                <span className="text-[10px] text-zinc-600">px</span>
            </div>

            <div className="flex items-center gap-2">
                <Label className="w-20 shrink-0 text-xs text-zinc-500">Fondo</Label>
                <input
                    type="color"
                    value={/^#/.test(style["background-color"] ?? "#000000") ? style["background-color"] : "#000000"}
                    onChange={(event) => update({ "background-color": event.target.value })}
                    className="h-7 w-10 cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                />
                <Input
                    value={style["background-color"] ?? ""}
                    placeholder="Color o degradado CSS…"
                    onChange={(event) =>
                        update(
                            event.target.value.includes("gradient")
                                ? { background: event.target.value }
                                : { "background-color": event.target.value },
                        )
                    }
                    className="h-7 flex-1 text-xs"
                />
            </div>
        </div>
    )
}

// ----- FreeShow -----
// Editor de texto enriquecido de la diapositiva seleccionada. Edita el texto de
// cada línea y sus estilos (tamaño, color, alineación, negrita/cursiva, sombra y
// fuente). Cada cambio actualiza el show (persistencia debounced).

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Plus, Trash2, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    addTextLine,
    ensureTextItem,
    getSlideLines,
    getSlideStyle,
    removeTextLine,
    setSlideTextStyle,
    updateLineValue,
} from "@/lib/show"
import { cn } from "@/lib/utils"
import { useShowStore } from "@/store/useShowStore"

const FONT_SIZES = [40, 50, 60, 70, 80, 90, 110, 130]
const SHADOW = "3px 3px 6px rgba(0,0,0,0.65)"

export default function SlideEditor() {
    const show = useShowStore((s) => s.show)
    const selectedSlideId = useShowStore((s) => s.selectedSlideId)
    const updateSlide = useShowStore((s) => s.updateSlide)

    if (!show || !selectedSlideId) return null
    const slide = show.slides[selectedSlideId]
    if (!slide) return null

    const withText = ensureTextItem(slide)
    const lines = getSlideLines(withText)
    const style = getSlideStyle(withText)

    const fontSize = parseInt(style["font-size"] ?? "", 10) || 70
    const color = style["color"] ?? "#ffffff"
    const fontFamily = style["font-family"] ?? ""
    const align = (style["text-align"] ?? "center").replace(/<|>/g, "").trim()
    const bold = /bold|[7-9]00/.test(style["font-weight"] ?? "")
    const italic = (style["font-style"] ?? "").includes("italic")
    const shadow = !!style["text-shadow"]

    const applyStyle = (declarations: Record<string, string>) => {
        updateSlide(selectedSlideId, setSlideTextStyle(withText, declarations))
    }

    const setLine = (itemIndex: number, lineIndex: number, value: string) => {
        updateSlide(selectedSlideId, updateLineValue(withText, itemIndex, lineIndex, value))
    }

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <Type className="size-3.5" />
                Texto de la diapositiva
            </div>

            {lines.length === 0 && (
                <p className="text-xs text-zinc-600">Esta diapositiva no tiene texto.</p>
            )}

            <div className="flex flex-col gap-2">
                {lines.map((line) => (
                    <div key={`${line.itemIndex}-${line.lineIndex}`} className="flex items-start gap-1.5">
                        <textarea
                            value={line.value}
                            onChange={(event) => setLine(line.itemIndex, line.lineIndex, event.target.value)}
                            placeholder="Escribe el texto…"
                            rows={2}
                            className="min-h-9 flex-1 resize-y rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none focus-visible:border-zinc-600"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-zinc-600 hover:text-red-400"
                            onClick={() => updateSlide(selectedSlideId, removeTextLine(withText, line.lineIndex))}
                            title="Eliminar línea"
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </div>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateSlide(selectedSlideId, addTextLine(withText))}
                    className="justify-start gap-1.5 text-zinc-500 hover:text-zinc-200"
                >
                    <Plus className="size-3.5" />
                    Añadir línea
                </Button>
            </div>

            <div className="border-t border-zinc-800 pt-3">
                <div className="mb-2 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Estilo</div>

                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                        <Label className="w-14 shrink-0 text-xs text-zinc-500">Tamaño</Label>
                        <Input
                            type="number"
                            value={fontSize}
                            onChange={(event) =>
                                applyStyle({ "font-size": `${event.target.value || 0}px` })
                            }
                            className="h-7 flex-1 text-xs"
                            list="font-sizes"
                        />
                        <datalist id="font-sizes">
                            {FONT_SIZES.map((size) => (
                                <option key={size} value={size} />
                            ))}
                        </datalist>
                    </div>

                    <div className="flex items-center gap-2">
                        <Label className="w-14 shrink-0 text-xs text-zinc-500">Color</Label>
                        <input
                            type="color"
                            value={color}
                            onChange={(event) => applyStyle({ color: event.target.value })}
                            className="h-7 flex-1 cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Label className="w-14 shrink-0 text-xs text-zinc-500">Fuente</Label>
                        <Input
                            value={fontFamily}
                            placeholder="Inter, Arial…"
                            onChange={(event) =>
                                applyStyle({ "font-family": event.target.value })
                            }
                            className="h-7 flex-1 text-xs"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Label className="w-14 shrink-0 text-xs text-zinc-500">Alinear</Label>
                        <div className="flex flex-1 gap-1">
                            {[
                                { value: "left", icon: AlignLeft },
                                { value: "center", icon: AlignCenter },
                                { value: "right", icon: AlignRight },
                            ].map(({ value, icon: Icon }) => (
                                <Button
                                    key={value}
                                    variant={align === value ? "secondary" : "ghost"}
                                    size="icon"
                                    className="size-7 flex-1"
                                    onClick={() => applyStyle({ "text-align": value })}
                                >
                                    <Icon className="size-3.5" />
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Label className="w-14 shrink-0 text-xs text-zinc-500">Formato</Label>
                        <div className="flex flex-1 gap-1">
                            <Button
                                variant={bold ? "secondary" : "ghost"}
                                size="icon"
                                className="size-7 flex-1"
                                onClick={() => applyStyle({ "font-weight": bold ? "" : "bold" })}
                            >
                                <Bold className="size-3.5" />
                            </Button>
                            <Button
                                variant={italic ? "secondary" : "ghost"}
                                size="icon"
                                className="size-7 flex-1"
                                onClick={() => applyStyle({ "font-style": italic ? "" : "italic" })}
                            >
                                <Italic className="size-3.5" />
                            </Button>
                            <Button
                                variant={shadow ? "secondary" : "ghost"}
                                size="icon"
                                className="size-7 flex-1"
                                onClick={() => applyStyle({ "text-shadow": shadow ? "" : SHADOW })}
                                title="Sombra"
                            >
                                <span className={cn("text-[11px] font-bold")}>S</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

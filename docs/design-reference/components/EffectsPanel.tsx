// ----- FreeShow -----
// Panel de efectos animados: crear, activar (se dibujan sobre la salida),
// editar color/cantidad/velocidad y eliminar.

import { useState } from "react"
import { Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffectsStore } from "@/store/useEffectsStore"
import { EFFECT_TYPES, type EffectType } from "@/lib/effects"

function Slider({
    label,
    value,
    min,
    max,
    step,
    onChange,
}: {
    label: string
    value: number
    min: number
    max: number
    step: number
    onChange: (value: number) => void
}) {
    return (
        <label className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="w-14 shrink-0">{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className="h-1 flex-1 accent-indigo-500"
            />
            <span className="w-8 shrink-0 text-right tabular-nums text-zinc-400">{value}</span>
        </label>
    )
}

export default function EffectsPanel() {
    const effects = useEffectsStore((s) => s.effects)
    const active = useEffectsStore((s) => s.active)
    const addEffect = useEffectsStore((s) => s.addEffect)
    const updateEffect = useEffectsStore((s) => s.updateEffect)
    const deleteEffect = useEffectsStore((s) => s.deleteEffect)
    const toggleActive = useEffectsStore((s) => s.toggleActive)
    const clearActive = useEffectsStore((s) => s.clearActive)

    const [newName, setNewName] = useState("")
    const entries = Object.entries(effects)

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span>Efectos</span>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-zinc-500 hover:text-zinc-200"
                    title="Desactivar todos"
                    onClick={clearActive}
                >
                    <Sparkles className="size-3.5" />
                </Button>
            </div>

            <div className="flex flex-col gap-2">
                {entries.map(([id, effect]) => {
                    const isActive = active.includes(id)
                    return (
                        <div
                            key={id}
                            className={`flex flex-col gap-1.5 rounded-md border p-2 ${
                                isActive ? "border-indigo-500/60 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900/40"
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => toggleActive(id)}
                                    className={`size-7 shrink-0 rounded border ${
                                        isActive ? "border-indigo-400 bg-indigo-500" : "border-zinc-700 bg-zinc-900"
                                    }`}
                                    title={isActive ? "Desactivar efecto" : "Activar efecto"}
                                />
                                <Input
                                    value={effect.name}
                                    onChange={(event) => updateEffect(id, { name: event.target.value })}
                                    className="h-7 flex-1 text-xs"
                                />
                                <input
                                    type="color"
                                    value={effect.color}
                                    onChange={(event) => updateEffect(id, { color: event.target.value })}
                                    className="size-7 shrink-0 cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                                    title="Color"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 shrink-0 text-zinc-600 hover:text-red-400"
                                    title="Eliminar efecto"
                                    onClick={() => deleteEffect(id)}
                                >
                                    <Plus className="size-3.5 rotate-45" />
                                </Button>
                            </div>
                            <select
                                value={effect.type}
                                onChange={(event) => updateEffect(id, { type: event.target.value as EffectType })}
                                className="h-7 rounded border border-zinc-800 bg-zinc-900 px-1.5 text-xs text-zinc-300"
                            >
                                {EFFECT_TYPES.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <Slider
                                label="Cantidad"
                                value={effect.quantity}
                                min={10}
                                max={600}
                                step={10}
                                onChange={(value) => updateEffect(id, { quantity: value })}
                            />
                            <Slider
                                label="Velocidad"
                                value={effect.speed}
                                min={0.1}
                                max={3}
                                step={0.1}
                                onChange={(value) => updateEffect(id, { speed: value })}
                            />
                        </div>
                    )
                })}
                {entries.length === 0 && (
                    <p className="py-2 text-center text-xs text-zinc-600">Sin efectos definidos.</p>
                )}
            </div>

            <div className="flex items-center gap-1.5 border-t border-zinc-800 pt-3">
                <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Nuevo efecto…"
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" || !newName.trim()) return
                        addEffect(newName, "rain")
                        setNewName("")
                    }}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-zinc-400 hover:text-zinc-100"
                    onClick={() => {
                        if (!newName.trim()) return
                        addEffect(newName, "rain")
                        setNewName("")
                    }}
                >
                    <Plus className="size-3.5" />
                    Añadir
                </Button>
            </div>
        </div>
    )
}

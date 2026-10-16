// ----- FreeShow -----
// Panel de gestión de grupos de diapositivas (etiquetas con color).
// Réplica del `ManageGroups.svelte`: renombrar, recolorear, añadir y eliminar.

import { useState } from "react"
import { Plus, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGroupsStore } from "@/store/useGroupsStore"

export default function GroupsPanel() {
    const groups = useGroupsStore((s) => s.groups)
    const addGroup = useGroupsStore((s) => s.addGroup)
    const updateGroup = useGroupsStore((s) => s.updateGroup)
    const deleteGroup = useGroupsStore((s) => s.deleteGroup)
    const reset = useGroupsStore((s) => s.reset)

    const [newName, setNewName] = useState("")
    const entries = Object.entries(groups)

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span>Grupos</span>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-zinc-500 hover:text-zinc-200"
                    title="Restablecer grupos por defecto"
                    onClick={reset}
                >
                    <RotateCcw className="size-3.5" />
                </Button>
            </div>

            <div className="flex flex-col gap-1.5">
                {entries.map(([id, group]) => (
                    <div key={id} className="flex items-center gap-1.5">
                        <input
                            type="color"
                            value={group.color}
                            onChange={(event) => updateGroup(id, { color: event.target.value })}
                            className="size-7 shrink-0 cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                            title="Color del grupo"
                        />
                        <Input
                            value={group.name}
                            onChange={(event) => updateGroup(id, { name: event.target.value, default: false })}
                            className="h-7 flex-1 text-xs"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-zinc-600 hover:text-red-400"
                            title="Eliminar grupo"
                            onClick={() => deleteGroup(id)}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </div>
                ))}
                {entries.length === 0 && (
                    <p className="py-2 text-center text-xs text-zinc-600">Sin grupos definidos.</p>
                )}
            </div>

            <div className="flex items-center gap-1.5 border-t border-zinc-800 pt-3">
                <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Nuevo grupo…"
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" || !newName.trim()) return
                        addGroup(newName, "#6366f1")
                        setNewName("")
                    }}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-zinc-400 hover:text-zinc-100"
                    onClick={() => {
                        if (!newName.trim()) return
                        addGroup(newName, "#6366f1")
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

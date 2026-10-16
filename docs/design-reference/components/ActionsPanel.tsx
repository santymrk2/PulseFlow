// ----- FreeShow -----
// Panel de acciones y disparadores: nombre, disparador (tecla/arranque/MIDI),
// tecla, comando y activación. Persistido en `SYNCED_SETTINGS.actions`.

import { useState } from "react"
import { Plus, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ACTION_COMMANDS, runAction, type ActionTrigger } from "@/lib/actions"
import { useActionsStore } from "@/store/useActionsStore"

const TRIGGER_LABELS: Record<ActionTrigger, string> = {
    keypress: "Tecla",
    startup: "Arranque",
    midi: "MIDI",
}

export default function ActionsPanel() {
    const actions = useActionsStore((s) => s.actions)
    const addAction = useActionsStore((s) => s.addAction)
    const updateAction = useActionsStore((s) => s.updateAction)
    const deleteAction = useActionsStore((s) => s.deleteAction)

    const [newName, setNewName] = useState("")
    const entries = Object.entries(actions)

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span>Acciones y disparadores</span>
                <Zap className="size-3.5" />
            </div>

            <div className="flex flex-col gap-2">
                {entries.map(([id, action]) => (
                    <div
                        key={id}
                        className={`flex flex-col gap-1.5 rounded-md border p-2 ${
                            action.enabled ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-800/60 bg-zinc-900/20 opacity-60"
                        }`}
                    >
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => updateAction(id, { enabled: !action.enabled })}
                                className={`size-7 shrink-0 rounded border ${
                                    action.enabled ? "border-emerald-400 bg-emerald-500" : "border-zinc-700 bg-zinc-900"
                                }`}
                                title={action.enabled ? "Desactivar" : "Activar"}
                            />
                            <Input
                                value={action.name}
                                onChange={(event) => updateAction(id, { name: event.target.value })}
                                className="h-7 flex-1 text-xs"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0 text-zinc-500 hover:text-indigo-300"
                                title="Ejecutar ahora"
                                onClick={() => runAction(action.command)}
                            >
                                <Zap className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0 text-zinc-600 hover:text-red-400"
                                title="Eliminar acción"
                                onClick={() => deleteAction(id)}
                            >
                                <Plus className="size-3.5 rotate-45" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Select
                                value={action.trigger}
                                onValueChange={(value) => updateAction(id, { trigger: value as ActionTrigger })}
                            >
                                <SelectTrigger size="sm" className="h-7 w-24 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {action.trigger === "keypress" && (
                                <Input
                                    value={action.key}
                                    placeholder="Tecla"
                                    maxLength={8}
                                    onChange={(event) => updateAction(id, { key: event.target.value })}
                                    className="h-7 w-16 text-center text-xs"
                                />
                            )}

                            <Select value={action.command} onValueChange={(value) => updateAction(id, { command: value })}>
                                <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ACTION_COMMANDS.map((command) => (
                                        <SelectItem key={command.id} value={command.id}>
                                            {command.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ))}
                {entries.length === 0 && <p className="py-2 text-center text-xs text-zinc-600">Sin acciones.</p>}
            </div>

            <div className="flex items-center gap-1.5 border-t border-zinc-800 pt-3">
                <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Nueva acción…"
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" || !newName.trim()) return
                        addAction(newName)
                        setNewName("")
                    }}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-zinc-400 hover:text-zinc-100"
                    onClick={() => {
                        if (!newName.trim()) return
                        addAction(newName)
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

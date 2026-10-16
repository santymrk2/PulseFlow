// ----- FreeShow -----
// Panel de integración con Planning Center Online (PCO): credenciales, conexión
// y lista de equipos (service types) disponibles.

import { useEffect, useState } from "react"
import { RefreshCw, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePcoStore } from "@/store/usePcoStore"

export default function PcoPanel() {
    const config = usePcoStore((s) => s.config)
    const teams = usePcoStore((s) => s.teams)
    const connected = usePcoStore((s) => s.connected)
    const loading = usePcoStore((s) => s.loading)
    const update = usePcoStore((s) => s.update)
    const connect = usePcoStore((s) => s.connect)
    const loadTeams = usePcoStore((s) => s.loadTeams)

    const [message, setMessage] = useState("")

    useEffect(() => {
        if (connected && teams.length === 0) void loadTeams()
    }, [connected, teams.length, loadTeams])

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span>Planning Center</span>
                <span
                    className={`flex items-center gap-1 text-[10px] normal-case ${
                        connected ? "text-emerald-400" : "text-zinc-600"
                    }`}
                >
                    <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-600"}`} />
                    {connected ? "Conectado" : "Desconectado"}
                </span>
            </div>

            <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                Client ID
                <Input
                    value={config.clientId}
                    onChange={(event) => update({ clientId: event.target.value })}
                    className="h-7 text-xs"
                    placeholder="pco client id"
                />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                Client Secret
                <Input
                    type="password"
                    value={config.clientSecret}
                    onChange={(event) => update({ clientSecret: event.target.value })}
                    className="h-7 text-xs"
                    placeholder="••••••••"
                />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                Team ID
                <Input
                    value={config.teamId}
                    onChange={(event) => update({ teamId: event.target.value })}
                    className="h-7 text-xs"
                    placeholder="team id"
                />
            </label>

            <div className="flex items-center gap-1.5">
                <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 gap-1.5"
                    disabled={loading || !config.clientId}
                    onClick={async () => setMessage((await connect()) ? "Conexión establecida." : "El proveedor no respondió.")}
                >
                    <Link2 className="size-3.5" />
                    Conectar
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-zinc-400"
                    disabled={loading}
                    onClick={() => void loadTeams()}
                >
                    <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                    Equipos
                </Button>
            </div>

            {message && <p className="text-[10px] text-zinc-500">{message}</p>}

            <div className="flex flex-col gap-1 border-t border-zinc-800 pt-3">
                {teams.map((team) => (
                    <button
                        key={team.id}
                        type="button"
                        onClick={() => update({ teamId: team.id })}
                        className={`truncate rounded px-2 py-1 text-left text-xs ${
                            config.teamId === team.id ? "bg-indigo-500/20 text-indigo-200" : "text-zinc-400 hover:bg-zinc-800"
                        }`}
                    >
                        {team.name || team.id}
                    </button>
                ))}
                {teams.length === 0 && (
                    <p className="text-[11px] text-zinc-600">
                        Conecta una cuenta para descubrir equipos. La sincronización en vivo requiere el backend PCO.
                    </p>
                )}
            </div>
        </div>
    )
}

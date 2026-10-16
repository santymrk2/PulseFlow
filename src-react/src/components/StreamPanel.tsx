// ----- FreeShow -----
// Panel de servidor remoto (REST/WebSocket) y timecode.

import { Play, Square, Radio, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useServerStore } from "@/store/useServerStore"

export default function StreamPanel() {
    const running = useServerStore((s) => s.running)
    const port = useServerStore((s) => s.port)
    const password = useServerStore((s) => s.password)
    const timecodeMode = useServerStore((s) => s.timecodeMode)
    const framerate = useServerStore((s) => s.framerate)
    const timecodeRunning = useServerStore((s) => s.timecodeRunning)
    const setPort = useServerStore((s) => s.setPort)
    const setPassword = useServerStore((s) => s.setPassword)
    const start = useServerStore((s) => s.start)
    const stop = useServerStore((s) => s.stop)
    const toggleTimecode = useServerStore((s) => s.toggleTimecode)
    const setTimecodeMode = useServerStore((s) => s.setTimecodeMode)
    const setFramerate = useServerStore((s) => s.setFramerate)

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span>Servidor y streaming</span>
                <span className={`size-1.5 rounded-full ${running ? "bg-emerald-400" : "bg-zinc-600"}`} />
            </div>

            <div className="flex items-end gap-1.5">
                <label className="flex flex-1 flex-col gap-1 text-[10px] text-zinc-500">
                    Puerto
                    <Input
                        type="number"
                        value={port}
                        disabled={running}
                        onChange={(event) => setPort(Number(event.target.value))}
                        className="h-7 text-xs"
                    />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-[10px] text-zinc-500">
                    Contraseña
                    <Input
                        type="password"
                        value={password}
                        disabled={running}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-7 text-xs"
                    />
                </label>
            </div>

            <div className="flex items-center gap-1.5">
                <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => (running ? void stop() : void start())}
                >
                    {running ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
                    {running ? "Detener" : "Iniciar"}
                </Button>
                <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <Radio className="size-3" />
                    {running ? `ws://localhost:${port}` : "detenido"}
                </span>
            </div>

            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                    <Clock className="size-3.5" />
                    Timecode
                </span>
                <div className="flex items-end gap-1.5">
                    <Select value={timecodeMode} onValueChange={(value) => setTimecodeMode(value as "send" | "receive")}>
                        <SelectTrigger size="sm" className="h-7 w-24 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="send">Enviar</SelectItem>
                            <SelectItem value="receive">Recibir</SelectItem>
                        </SelectContent>
                    </Select>
                    <label className="flex flex-1 flex-col gap-1 text-[10px] text-zinc-500">
                        FPS
                        <Input
                            type="number"
                            value={framerate}
                            onChange={(event) => setFramerate(Number(event.target.value))}
                            className="h-7 text-xs"
                        />
                    </label>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1.5 ${timecodeRunning ? "text-red-400" : "text-zinc-400"}`}
                        onClick={() => void toggleTimecode()}
                    >
                        {timecodeRunning ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
                        {timecodeRunning ? "Parar" : "Iniciar"}
                    </Button>
                </div>
            </div>
        </div>
    )
}

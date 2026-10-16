// ----- FreeShow -----
// Diálogo de configuración de la salida: pantalla destino, resolución y modo de
// ventana. Réplica simplificada de `popups/OutputSetup.svelte`.

import { useEffect, useState } from "react"
import { Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    getDisplays,
    getRenderEngine,
    setRenderEngine,
    getStoreValue,
    openOutputWindow,
    openNativeOutput,
    setStoreValue,
    type Display,
    type RenderEngine,
} from "@/IPC/system"

const RESOLUTIONS: { value: string; width: number; height: number; label: string }[] = [
    { value: "1920x1080", width: 1920, height: 1080, label: "Full HD · 1920×1080" },
    { value: "1280x720", width: 1280, height: 720, label: "HD · 1280×720" },
    { value: "3840x2160", width: 3840, height: 2160, label: "4K · 3840×2160" },
    { value: "1024x768", width: 1024, height: 768, label: "XGA · 1024×768" },
]

interface OutputSetupDialogProps {
    onClose: () => void
}

export default function OutputSetupDialog({ onClose }: OutputSetupDialogProps) {
    const [displays, setDisplays] = useState<Display[]>([])
    const [displayId, setDisplayId] = useState(0)
    const [resolution, setResolution] = useState("1920x1080")
    const [fullscreen, setFullscreen] = useState(true)
    const [renderEngine, setEngine] = useState<RenderEngine>("web")

    useEffect(() => {
        void getDisplays().then((list) => {
            setDisplays(list)
            if (list.length) setDisplayId(list[0].id)
        })
        void getStoreValue("settings", "outputResolution").then((value) => {
            if (typeof value === "string") setResolution(value)
        })
        void getRenderEngine().then((engine) => setEngine(engine))
    }, [])

    async function save() {
        await setStoreValue("settings", "outputResolution", resolution)
        await setStoreValue("settings", "outputDisplay", displayId)
        await setStoreValue("settings", "outputFullscreen", fullscreen)
        await setRenderEngine(renderEngine)

        if (renderEngine === "native") {
            await openNativeOutput(displayId, fullscreen)
        } else {
            await openOutputWindow({ display: displayId, fullscreen })
        }
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="flex w-[420px] flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <Monitor className="size-4" />
                    Configuración de la salida
                </div>

                <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
                    Pantalla
                    <Select value={String(displayId)} onValueChange={(value) => setDisplayId(Number(value))}>
                        <SelectTrigger size="sm" className="w-full">
                            <SelectValue placeholder="Selecciona una pantalla" />
                        </SelectTrigger>
                        <SelectContent>
                            {displays.map((display, index) => (
                                <SelectItem key={display.id} value={String(display.id)}>
                                    {display.label}
                                    {index === 0 ? " (principal)" : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
                    Resolución
                    <Select value={resolution} onValueChange={setResolution}>
                        <SelectTrigger size="sm" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {RESOLUTIONS.map((entry) => (
                                <SelectItem key={entry.value} value={entry.value}>
                                    {entry.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
                    Motor de Render
                    <Select value={renderEngine} onValueChange={(val) => setEngine(val as RenderEngine)}>
                        <SelectTrigger size="sm" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="web">Web (Legacy HTML/CSS)</SelectItem>
                            <SelectItem value="native">Nativo GPU (Pro Engine WGPU 60fps)</SelectItem>
                        </SelectContent>
                    </Select>
                </label>

                <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <input
                        type="checkbox"
                        checked={fullscreen}
                        onChange={(event) => setFullscreen(event.target.checked)}
                        className="size-4 accent-indigo-500"
                    />
                    Pantalla completa
                </label>

                <div className="flex justify-end gap-1.5 border-t border-zinc-800 pt-3">
                    <Button variant="ghost" size="sm" className="text-zinc-400" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button size="sm" onClick={() => void save()}>
                        Abrir salida
                    </Button>
                </div>
            </div>
        </div>
    )
}

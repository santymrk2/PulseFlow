// ----- FreeShow -----
// Controles de proyección (panel derecho).
//
// El recuadro de preview es un espejo a escala en tiempo real de la ventana de
// Audiencia: reacciona al store de Zustand (que `useProjectionBroadcast` difunde
// a la salida), de modo que muestra exactamente lo proyectado (texto enriquecido,
// medio o negro).

import { MonitorPlay, Projector, Trash2 } from "lucide-react"
import { MediaContent } from "@/components/MediaStage"
import RichTextCanvas from "@/components/RichTextCanvas"
import { Button } from "@/components/ui/button"
import { MAIN } from "@/IPC/channels"
import { closeStageWindow, openStageWindow } from "@/IPC/system"
import { useProjectionStore } from "@/store/useProjectionStore"

function openAudience() {
    window.api?.send(MAIN, { channel: "OPEN_OUTPUT_WINDOW", data: {} })
}

function closeAudience() {
    window.api?.send(MAIN, { channel: "CLOSE_OUTPUT_WINDOW" })
}

export default function ProjectionControls() {
    const visible = useProjectionStore((s) => s.visible)
    const text = useProjectionStore((s) => s.text)
    const subtext = useProjectionStore((s) => s.subtext)
    const background = useProjectionStore((s) => s.background)
    const color = useProjectionStore((s) => s.color)
    const richText = useProjectionStore((s) => s.richText)
    const media = useProjectionStore((s) => s.media)
    const clear = useProjectionStore((s) => s.clear)

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span className="flex items-center gap-2">
                    <Projector className="size-3.5" />
                    Output
                </span>
                <span
                    className={`size-1.5 rounded-full ${visible ? "bg-emerald-400" : "bg-zinc-600"}`}
                    title={visible ? "En vivo" : "En negro"}
                />
            </div>

            {/* Espejo en vivo de lo que ve la Audiencia. */}
            <div
                className="relative aspect-video w-full overflow-hidden rounded-md border border-zinc-800"
                style={{ backgroundColor: background, color }}
            >
                {visible ? (
                    media ? (
                        <MediaContent
                            media={media}
                            className="absolute inset-0 size-full object-contain"
                            report
                            forceMuted
                        />
                    ) : richText ? (
                        <RichTextCanvas richText={richText} />
                    ) : (
                        <div className="flex size-full items-center justify-center px-4 text-center">
                            <div>
                                <div className="text-base font-bold whitespace-pre-wrap">{text}</div>
                                {subtext && (
                                    <div className="mt-1 text-xs opacity-80 whitespace-pre-wrap">{subtext}</div>
                                )}
                            </div>
                        </div>
                    )
                ) : (
                    <div className="flex size-full items-center justify-center">
                        <p className="text-[11px] text-zinc-600">Preview</p>
                    </div>
                )}
            </div>

            <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" className="flex-1 gap-1.5" onClick={openAudience}>
                    <Projector className="size-3.5" />
                    Abrir
                </Button>
                <Button size="sm" variant="ghost" className="text-zinc-400" onClick={closeAudience}>
                    Cerrar
                </Button>
            </div>

            <div className="flex gap-1.5">
                <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => void openStageWindow()}
                >
                    <MonitorPlay className="size-3.5" />
                    Abrir Stage
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-zinc-400"
                    onClick={() => void closeStageWindow()}
                >
                    Cerrar
                </Button>
            </div>

            <Button size="sm" variant="ghost" className="gap-1.5 text-zinc-400" onClick={clear}>
                <Trash2 className="size-3.5" />
                Limpiar pantalla
            </Button>
        </div>
    )
}

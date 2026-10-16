// ----- FreeShow -----
// Vista de la ventana de Audiencia (Output).
//
// Se renderiza cuando la etiqueta de la ventana es "output" (ver `main.tsx`).
// Es una superficie "tonta": sólo dibuja el estado que le llega desde la ventana
// de Control vía `useProjectionListener`. No carga la biblioteca ni el shell.

import { useEffect } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { CrossfadeStage } from "@/components/MediaStage"
import OverlayStage from "@/components/OverlayStage"
import RichTextCanvas from "@/components/RichTextCanvas"
import TimerDisplay from "@/components/TimerDisplay"
import EffectCanvas from "@/components/EffectCanvas"
import { useProjectionListener } from "@/hooks/useProjectionSync"
import { useProjectionStore } from "@/store/useProjectionStore"

export default function OutputView() {
    useProjectionListener()

    const visible = useProjectionStore((s) => s.visible)
    const text = useProjectionStore((s) => s.text)
    const subtext = useProjectionStore((s) => s.subtext)
    const background = useProjectionStore((s) => s.background)
    const color = useProjectionStore((s) => s.color)
    const align = useProjectionStore((s) => s.align)
    const media = useProjectionStore((s) => s.media)
    const richText = useProjectionStore((s) => s.richText)
    const overlays = useProjectionStore((s) => s.overlays)
    const alert = useProjectionStore((s) => s.alert)

    useEffect(() => {
        const win = getCurrentWindow()
        const onKey = (event: KeyboardEvent) => {
            // ESC cierra la ventana de audiencia (atajo de salida para producción).
            if (event.key === "Escape") void win.close()
            // F alterna pantalla completa.
            else if (event.key === "f" || event.key === "F") {
                void win.isFullscreen().then((fullscreen) => win.setFullscreen(!fullscreen))
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    const showText = visible && !media

    return (
        <div
            data-tauri-drag-region
            className="relative flex h-screen w-screen items-center justify-center overflow-hidden"
            style={{ backgroundColor: background, color, textAlign: align }}
        >
            <CrossfadeStage media={visible ? media : null} />

            {showText && richText && <RichTextCanvas richText={richText} />}

            {showText && !richText && (
                <div data-tauri-drag-region className="relative z-10 px-[6vw]">
                    <div className="text-[7vw] leading-tight font-bold tracking-tight whitespace-pre-wrap">
                        {text}
                    </div>
                    {subtext && (
                        <div className="mt-[2vh] text-[3vw] whitespace-pre-wrap opacity-80">{subtext}</div>
                    )}
                </div>
            )}

            {visible && <OverlayStage overlays={overlays} />}

            <EffectCanvas />

            {alert && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center p-12"
                    style={{ backgroundColor: alert.background, color: alert.color }}
                >
                    <p className="max-w-[90%] text-center text-7xl font-bold">{alert.text}</p>
                </div>
            )}

            <TimerDisplay className="absolute right-8 bottom-8 z-40 drop-shadow-lg" />
        </div>
    )
}

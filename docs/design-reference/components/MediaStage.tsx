// ----- FreeShow -----
// Superficie de medios proyectada. `MediaContent` dibuja un `<img>` o `<video>`
// a pantalla completa; `CrossfadeStage` apila capas y hace un crossfade suave al
// cambiar de medio (o al limpiar la pantalla), sin bloquear el hilo de la UI.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { useProjectionStore } from "@/store/useProjectionStore"
import type { ProjectionMedia } from "@/types/Output"

export const DEFAULT_CROSSFADE_MS = 500

/**
 * Reproductor del medio: vídeo en bucle e imagen estática.
 *
 * La reproducción (play/pausa/seek/volumen) se rige por `mediaPlayback` del
 * store de proyección, de modo que la ventana de Control manda y la de Audiencia
 * obedece. Con `report`, este elemento informa de su tiempo/duración al store
 * (únicamente en la ventana de Control, que es la que difunde el estado).
 */
export function MediaContent({
    media,
    className,
    report = false,
    forceMuted = false,
}: {
    media: ProjectionMedia
    className?: string
    report?: boolean
    forceMuted?: boolean
}) {
    const fit = className ?? "size-full object-cover"
    const videoRef = useRef<HTMLVideoElement>(null)
    const playing = useProjectionStore((s) => s.mediaPlayback.playing)
    const currentTime = useProjectionStore((s) => s.mediaPlayback.currentTime)
    const volume = useProjectionStore((s) => s.mediaPlayback.volume)
    const muted = useProjectionStore((s) => s.mediaPlayback.muted)
    const isVideo = media.kind === "video"

    useEffect(() => {
        const video = videoRef.current
        if (!video || !isVideo) return
        if (playing) void video.play().catch(() => undefined)
        else video.pause()
    }, [playing, isVideo, media.id])

    useEffect(() => {
        const video = videoRef.current
        if (!video || !isVideo) return
        video.muted = muted || forceMuted
        video.volume = Math.min(1, Math.max(0, volume))
    }, [muted, volume, forceMuted, isVideo, media.id])

    useEffect(() => {
        const video = videoRef.current
        if (!video || !isVideo) return
        if (Math.abs(video.currentTime - currentTime) > 0.5) video.currentTime = currentTime
    }, [currentTime, isVideo, media.id])

    if (!isVideo) {
        return <img key={media.id} src={media.src} alt={media.name} draggable={false} className={fit} />
    }

    return (
        <video
            key={media.id}
            ref={videoRef}
            src={media.src}
            loop={media.loop}
            playsInline
            controls={false}
            disablePictureInPicture
            className={fit}
            onLoadedMetadata={(event) => {
                if (report) useProjectionStore.getState().setMediaPlayback({ duration: event.currentTarget.duration })
            }}
            onTimeUpdate={(event) => {
                if (report) useProjectionStore.getState().setMediaPlayback({ currentTime: event.currentTarget.currentTime })
            }}
        />
    )
}

interface Layer {
    id: number
    media: ProjectionMedia | null
}

/**
 * Crossfade entre medios. La capa superior entra con una animación de opacidad
 * 0→1; las anteriores se mantienen opacas (quedan cubiertas) y se descartan al
 * terminar. Al limpiar la pantalla (`media === null`) las capas previas se
 * desvanecen hacia el fondo.
 */
export function CrossfadeStage({
    media,
    durationMs = DEFAULT_CROSSFADE_MS,
}: {
    media: ProjectionMedia | null
    durationMs?: number
}) {
    const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, media }])
    const counter = useRef(0)
    const previous = useRef<ProjectionMedia | null>(media)

    useEffect(() => {
        if (previous.current === media) return
        previous.current = media

        counter.current += 1
        const layer: Layer = { id: counter.current, media }
        setLayers((list) => [...list, layer])

        const timer = setTimeout(() => setLayers((list) => list.slice(-1)), durationMs)
        return () => clearTimeout(timer)
    }, [media, durationMs])

    if (layers.length === 1 && !layers[0].media) return null

    const topHasMedia = !!layers[layers.length - 1]?.media

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {layers.map((layer, index) => {
                const isTop = index === layers.length - 1
                const opacity = isTop ? (layer.media ? 1 : 0) : topHasMedia ? 1 : 0

                const style: CSSProperties = {
                    opacity,
                    transition: `opacity ${durationMs}ms ease-in-out`,
                }
                if (isTop && layer.media) {
                    style.animation = `projection-fade-in ${durationMs}ms ease-in-out`
                }

                let content: ReactNode = null
                if (layer.media) content = <MediaContent media={layer.media} />

                return (
                    <div key={layer.id} className="absolute inset-0" style={style}>
                        {content}
                    </div>
                )
            })}
        </div>
    )
}

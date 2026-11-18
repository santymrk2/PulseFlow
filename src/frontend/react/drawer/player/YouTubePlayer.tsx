import { useEffect, useRef } from "react"
import YoutubePlayerFactory from "youtube-player"
import type { YouTubePlayer as YouTubePlayerInstance, Options } from "youtube-player/dist/types"

interface PlayerEvent {
    data?: number
    target?: unknown
}

export interface YouTubePlayerProps {
    videoId: string
    options?: Options
    className?: string
    onReady?: (event: PlayerEvent) => void
    onError?: (event: PlayerEvent) => void
    onStateChange?: (event: PlayerEvent) => void
    onEnd?: (event: PlayerEvent) => void
    onPlay?: (event: PlayerEvent) => void
    onPause?: (event: PlayerEvent) => void
}

// (F24.20c, rezagado F24.17h).
export function YouTubePlayer({ videoId, options = {}, className, onReady, onError, onStateChange, onEnd, onPlay, onPause }: YouTubePlayerProps) {
    const playerElem = useRef<HTMLDivElement | null>(null)
    const player = useRef<YouTubePlayerInstance | null>(null)
    const currentId = useRef("")
    const handlers = useRef({ onReady, onError, onStateChange, onEnd, onPlay, onPause })
    handlers.current = { onReady, onError, onStateChange, onEnd, onPlay, onPause }

    useEffect(() => {
        if (!playerElem.current) return
        currentId.current = videoId
        const instance = YoutubePlayerFactory(playerElem.current, { ...options, videoId } as Options)
        player.current = instance

        instance.on("ready", (e: PlayerEvent) => handlers.current.onReady?.(e))
        instance.on("error", (e: PlayerEvent) => handlers.current.onError?.(e))
        instance.on("stateChange", (e: PlayerEvent) => {
            handlers.current.onStateChange?.(e)
            switch (e.data) {
                case 0:
                    handlers.current.onEnd?.(e)
                    break
                case 1:
                    handlers.current.onPlay?.(e)
                    break
                case 2:
                    handlers.current.onPause?.(e)
                    break
                default:
                    break
            }
        })

        return () => {
            void instance.destroy()
            player.current = null
        }
        // El player se crea una vez; los cambios de video se aplican abajo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const instance = player.current
        if (!instance || !videoId || videoId === currentId.current) return
        currentId.current = videoId
        if (options?.playerVars?.autoplay === 1) void instance.loadVideoById(videoId)
        else void instance.cueVideoById(videoId)
    }, [videoId, options?.playerVars?.autoplay])

    return (
        <div className={className}>
            <div ref={playerElem} />
        </div>
    )
}

export default YouTubePlayer

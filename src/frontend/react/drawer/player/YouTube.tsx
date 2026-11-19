import { useEffect, useRef, useState } from "react"
import { focusMode, special } from "../../../shared/core/stores"
import { useStore } from "../../hooks/useStore"
import { YouTubePlayer } from "./YouTubePlayer"
import styles from "./YouTube.module.css"

export interface PlayerVideoData {
    paused: boolean
    muted: boolean
    loop: boolean
    duration: number
}

export interface YouTubeProps {
    videoData?: PlayerVideoData
    onVideoDataChange?: (data: PlayerVideoData) => void
    videoTime?: number
    onVideoTimeChange?: (time: number) => void
    actualVideoTime?: number
    onActualVideoTimeChange?: (time: number) => void
    id: string
    preview?: boolean
    onLoaded?: () => void
    onEnded?: () => void
}

interface YTPlayer {
    getPlayerState: () => number
    getCurrentTime: () => number
    getDuration: () => number
    seekTo: (seconds: number, allowSeekAhead: boolean) => void
    pauseVideo: () => void
    playVideo: () => void
    stopVideo: () => void
    mute: () => void
    isMuted: () => boolean
}

// (F24.20c, rezagado F24.17h).
export function YouTube({ videoData = { paused: false, muted: true, loop: false, duration: 0 }, onVideoDataChange, videoTime = 0, onVideoTimeChange, actualVideoTime = 0, onActualVideoTimeChange, id, preview = false, onLoaded, onEnded }: YouTubeProps) {
    const currentFocusMode = useStore(focusMode)
    const currentSpecial = useStore(special)
    const [player, setPlayer] = useState<YTPlayer | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [seeking, setSeeking] = useState(false)
    const state = useRef({ videoData, videoTime, actualVideoTime, preview, seeking, loaded })
    state.current = { videoData, videoTime, actualVideoTime, preview, seeking, loaded }

    let normalizedId = id.includes("?list") ? id.slice(0, id.indexOf("?list")) : id
    normalizedId = normalizedId.slice(-11)

    const options = {
        playerVars: {
            autoplay: 1,
            loop: videoData.loop,
            fs: 0,
            rel: 0,
            controls: currentSpecial.hideCursor ? 0 : 1
        }
    }

    function setVideoData(next: Partial<PlayerVideoData>) {
        const merged = { ...state.current.videoData, ...next }
        if (JSON.stringify(merged) === JSON.stringify(state.current.videoData)) return
        onVideoDataChange?.(merged)
    }

    function onReady(event: { target?: YTPlayer | unknown; data?: number }) {
        const target = event.target as YTPlayer | undefined
        if (!target) return
        setPlayer(target)
        setLoaded(true)
        setVideoData({ paused: !!currentFocusMode })
        onLoaded?.()
    }

    useEffect(() => {
        if (!loaded || !player) return
        const interval = setInterval(() => {
            try {
                if (player.getPlayerState() === 1) {
                    const time = player.getCurrentTime()
                    if (time !== state.current.actualVideoTime) onActualVideoTimeChange?.(time)
                }
                if (state.current.preview && !state.current.seeking) {
                    const time = player.getCurrentTime()
                    if (Math.abs(time - state.current.videoTime) >= 0.01) onVideoTimeChange?.(time)
                    const duration = !state.current.videoData.duration ? player.getDuration() : 0
                    if (duration) setVideoData({ duration })
                }
            } catch {
                // player no listo
            }
        }, 250)
        return () => clearInterval(interval)
    }, [loaded, player, onActualVideoTimeChange, onVideoTimeChange, preview])

    useEffect(() => {
        if (seeking || videoTime === undefined || !player || !loaded) return
        let current = 0
        try {
            current = player.getCurrentTime()
        } catch {
            return
        }
        if (Math.abs(current - videoTime) < 2) return
        setSeeking(true)
        player.seekTo(videoTime, true)
        const timeout = setTimeout(() => setSeeking(false), 500)
        return () => clearTimeout(timeout)
    }, [videoTime, player, loaded, seeking])

    useEffect(() => {
        if (!player || !loaded || seeking || videoData.paused === undefined) return
        try {
            if (videoData.paused) player.pauseVideo()
            else player.playVideo()
        } catch {
            // ignorar
        }
    }, [player, loaded, seeking, videoData.paused])

    useEffect(() => {
        if (!player || !loaded) return
        try {
            if (!player.isMuted()) player.mute()
        } catch {
            // ignorar
        }
    }, [player, loaded, videoData.muted])

    useEffect(() => {
        if (!id && player) {
            try {
                player.stopVideo()
            } catch {
                // ignorar
            }
        }
    }, [id, player])

    return <div className={`${styles.main} ${!id ? styles.hide : ""}`.trim()}>{id ? <YouTubePlayer className="yt" videoId={normalizedId} options={options} onReady={onReady} onEnd={() => onEnded?.()} /> : null}</div>
}

export default YouTube

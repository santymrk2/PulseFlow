import Player from "@vimeo/player"
import { useEffect, useRef, useState } from "react"
import { focusMode, theme, themes } from "../../../stores"
import { useStore } from "../../hooks/useStore"
import styles from "./Vimeo.module.css"

export interface PlayerVideoData {
    paused: boolean
    muted: boolean
    loop: boolean
    duration: number
}

export interface VimeoProps {
    videoData?: PlayerVideoData
    onVideoDataChange?: (data: PlayerVideoData) => void
    videoTime?: number
    onVideoTimeChange?: (time: number) => void
    actualVideoTime?: number
    onActualVideoTimeChange?: (time: number) => void
    id: string
    preview?: boolean
    onLoaded?: () => void
}

// (F24.20c, rezagado F24.17h).
export function Vimeo({ videoData = { paused: false, muted: true, loop: false, duration: 0 }, onVideoDataChange, videoTime = 0, onVideoTimeChange, actualVideoTime = 0, onActualVideoTimeChange, id, preview = false, onLoaded }: VimeoProps) {
    const currentFocusMode = useStore(focusMode)
    const currentTheme = useStore(theme)
    const currentThemes = useStore(themes)
    const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null)
    const [player, setPlayer] = useState<Player | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [paused, setPaused] = useState(true)
    const [time, setTime] = useState(0)
    const [seeking, setSeeking] = useState(false)
    const [isPlayPending, setIsPlayPending] = useState(false)
    const state = useRef({ videoData, videoTime, actualVideoTime, preview, paused, seeking, isPlayPending, time })
    state.current = { videoData, videoTime, actualVideoTime, preview, paused, seeking, isPlayPending, time }
    const pendingSeek = useRef<number | null>(null)
    const shouldBeMuted = true
    const color = currentThemes[currentTheme]?.colors?.secondary || "white"

    function setVideoData(next: Partial<PlayerVideoData>) {
        const merged = { ...state.current.videoData, ...next }
        if (JSON.stringify(merged) === JSON.stringify(state.current.videoData)) return
        onVideoDataChange?.(merged)
    }

    useEffect(() => {
        if (!iframe) return
        const instance = new Player(iframe, { autoplay: true, autopause: false, loop: videoData.loop, muted: shouldBeMuted, color, controls: false })
        setPlayer(instance)
        instance.on("error", (err: unknown) => console.warn("Vimeo player error event:", err))
        void instance.setColor(color).catch((err: unknown) => console.warn("Vimeo setColor error:", err))
        if (shouldBeMuted) void instance.setMuted(true).catch((err: unknown) => console.warn("Vimeo setMuted error:", err))

        setLoaded(true)
        setVideoData({ paused: !!currentFocusMode })
        void seekTo(videoTime, instance)
        onLoaded?.()

        const onPlay = () => {
            setPaused(false)
            setIsPlayPending(false)
        }
        const onPause = () => {
            setPaused(true)
            setIsPlayPending(false)
        }
        const onDuration = ({ duration }: { duration: number }) => setVideoData({ duration })
        const onTime = ({ seconds }: { seconds: number }) => {
            setTime(seconds)
            onVideoTimeChange?.(seconds)
        }
        instance.on("play", onPlay)
        instance.on("pause", onPause)
        instance.on("durationchange", onDuration)
        instance.on("timeupdate", onTime)
        return () => {
            instance.off("play", onPlay)
            instance.off("pause", onPause)
            instance.off("durationchange", onDuration)
            instance.off("timeupdate", onTime)
            void instance.unload().catch(() => {})
        }
        // Se recrea con el iframe del id actual.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [iframe, id])

    useEffect(() => {
        if (!loaded || !player) return
        const interval = setInterval(async () => {
            try {
                const current = await player.getCurrentTime()
                if (current !== state.current.actualVideoTime) onActualVideoTimeChange?.(current)
            } catch {
                // ignorar
            }
        }, 500)
        return () => clearInterval(interval)
    }, [loaded, player, onActualVideoTimeChange])

    useEffect(() => {
        if (!player || !loaded || seeking) return
        if (videoData.paused && (!paused || isPlayPending)) {
            setIsPlayPending(false)
            void player.pause().catch((err: unknown) => console.warn("Vimeo pause error:", err))
        } else if (!videoData.paused && paused && !isPlayPending) {
            setIsPlayPending(true)
            void player.play().catch((err: unknown) => {
                console.warn("Vimeo play error:", err)
                setIsPlayPending(false)
            })
        }
        void player.setMuted(shouldBeMuted).catch((err: unknown) => console.warn("Vimeo setMuted error:", err))
    }, [player, loaded, seeking, videoData.paused, paused, isPlayPending])

    useEffect(() => {
        if (!id && player) void player.unload().catch((err: unknown) => console.warn("Vimeo unload error:", err))
    }, [id, player])

    useEffect(() => {
        if (!loaded || seeking || videoTime === undefined || !player) return
        if (preview && !paused) return
        if (Math.abs(time - videoTime) < 1) return
        void seekTo(videoTime, player)
    }, [loaded, seeking, videoTime, player, preview, paused, time])

    async function seekTo(targetTime: number, instance = player) {
        if (!instance) return
        if (state.current.seeking) {
            pendingSeek.current = targetTime
            return
        }
        const isPlaying = !state.current.videoData.paused
        setVideoData({ paused: true })
        setSeeking(true)
        pendingSeek.current = null
        try {
            if (targetTime > 0) await Promise.race([instance.setCurrentTime(targetTime), new Promise<void>((resolve) => setTimeout(resolve, 500))])
        } catch (err) {
            console.warn("Vimeo setCurrentTime error:", err)
        } finally {
            if (isPlaying) setVideoData({ paused: false })
            setSeeking(false)
            if (pendingSeek.current !== null && pendingSeek.current !== targetTime) {
                const next = pendingSeek.current
                pendingSeek.current = null
                void seekTo(next, instance)
            }
        }
    }

    return <div className={`${styles.main} ${!id ? styles.hide : ""}`.trim()}>{id ? <iframe ref={setIframe} data-vimeo-title="0" data-vimeo-autopause="0" data-vimeo-dnt="0" allow="autoplay;" id={id} title="video" src={`https://player.vimeo.com/video/${id}?autopause=0&controls=0&loop=${videoData.loop}`} width="640" height="360" /> : null}</div>
}

export default Vimeo

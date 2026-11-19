import { useEffect, useRef, useState } from "react"
import { activeProject, activeShow, playerVideos, projects } from "../../shared/core/stores"
import { useStore } from "../hooks/useStore"
import { _show } from "../../shared/utils/helpers/shows"
import { videoSync } from "../../components/media/video/videoSync"
import { Vimeo } from "../drawer/player/Vimeo"
import { YouTube } from "../drawer/player/YouTube"

export interface PlayerVideoData {
    muted: boolean
    paused: boolean
    loop: boolean
    duration: number
}

export interface PlayerProps {
    id: string
    outputId?: string
    preview?: boolean
    videoData?: PlayerVideoData
    onVideoDataChange?: (data: PlayerVideoData) => void
    videoTime?: number
    onVideoTimeChange?: (time: number) => void
    onLoaded?: () => void
    onEnded?: () => void
}

// (F24.20c, rezagado F24.17h).
export function Player({ id, outputId = "", preview = false, videoData = { muted: true, paused: false, loop: false, duration: 0 }, onVideoDataChange, videoTime = 0, onVideoTimeChange, onLoaded, onEnded }: PlayerProps) {
    const currentActiveShow = useStore(activeShow)
    const currentPlayerVideos = useStore(playerVideos)
    const currentProjects = useStore(projects)
    const currentActiveProject = useStore(activeProject)
    const [actualVideoTime, setActualVideoTime] = useState(0)
    const state = useRef({ videoData, videoTime, actualVideoTime })
    state.current = { videoData, videoTime, actualVideoTime }

    const playerVideosMap = (currentPlayerVideos || {}) as Record<string, { type: "youtube" | "vimeo"; id: string; name?: string } | undefined>
    let data: { type: "youtube" | "vimeo"; id: string; name?: string } | null = null
    if (currentActiveShow && !playerVideosMap[id]) {
        const showMedia = _show(currentActiveShow?.id || "").get("media")?.[id] as { data?: typeof data; type?: string; id?: string; path?: string; name?: string } | undefined
        if (showMedia?.data) data = showMedia.data
        else if (showMedia?.type === "youtube" || showMedia?.type === "vimeo") data = { type: showMedia.type, id: showMedia.id || showMedia.path || id, name: showMedia.name }
        else data = ((currentProjects || {})[currentActiveProject || ""]?.shows.find((a) => a.index === currentActiveShow?.index)?.data as typeof data) || null
    }

    const video = playerVideosMap[id] || data

    useEffect(() => {
        if (!id || !outputId) return
        setActualVideoTime(0)
        const unsubscribe = videoSync(id, outputId, (data) => {
            if (!video) return
            const seekOffset = data.paused ? 0.5 : 2
            if (data.currentTime !== undefined && Math.abs(state.current.actualVideoTime - data.currentTime) > seekOffset) onVideoTimeChange?.(data.currentTime)

            const next = {
                ...state.current.videoData,
                loop: data.loop ?? state.current.videoData.loop,
                paused: data.paused ?? state.current.videoData.paused,
                muted: data.muted ?? state.current.videoData.muted
            }
            if (JSON.stringify(next) !== JSON.stringify(state.current.videoData)) onVideoDataChange?.(next)
        })
        return () => unsubscribe?.()
    }, [id, outputId, onVideoDataChange, onVideoTimeChange, video])

    function handleVideoDataChange(next: PlayerVideoData) {
        onVideoDataChange?.(next)
    }
    function handleVideoTimeChange(next: number) {
        onVideoTimeChange?.(next)
    }

    if (video?.type === "youtube") {
        const vid = video.id || ""
        return <YouTube key={vid} id={vid} videoData={videoData} onVideoDataChange={handleVideoDataChange} videoTime={videoTime} onVideoTimeChange={handleVideoTimeChange} actualVideoTime={actualVideoTime} onActualVideoTimeChange={setActualVideoTime} preview={preview} onLoaded={onLoaded} onEnded={onEnded} />
    }
    if (video?.type === "vimeo") {
        const vid = video.id || ""
        return <Vimeo key={vid} id={vid} videoData={videoData} onVideoDataChange={handleVideoDataChange} videoTime={videoTime} onVideoTimeChange={handleVideoTimeChange} actualVideoTime={actualVideoTime} onActualVideoTimeChange={setActualVideoTime} preview={preview} onLoaded={onLoaded} />
    }
    return null
}

export default Player

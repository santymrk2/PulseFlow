import { useEffect, useState } from "react"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { AudioPlaylist } from "../../../audio/audioPlaylist"
import { addProjectItem } from "../../../converters/project"
import { activePlaylist, activeShow, media, outLocked, playingAudio } from "../../../shared/core/stores"
import { joinTime, secondsToTime } from "../../../shared/utils/helpers/time"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button, type ButtonClickDetail } from "../../ui/button/Button"
import { SelectElem } from "../../system/SelectElem"
import styles from "./AudioFile.module.css"

// Port de components/drawer/audio/AudioFile.svelte. Los `{#await AudioPlayer.getDuration(path)}` se resuelven con state.
export interface AudioFileProps {
    path: string
    name: string
    active?: string | null
    playlist?: boolean
    index?: number
    fileOver?: boolean
}

export function AudioFile({ path, name, active = null, playlist = false, index = -1, fileOver = false }: AudioFileProps) {
    const playing = useStore(playingAudio)
    const currentPlaylist = useStore(activePlaylist)
    const currentShow = useStore(activeShow)
    const mediaValue = useStore(media)
    const locked = useStore(outLocked)

    const [duration, setDuration] = useState<number | null>(null)

    useEffect(() => {
        let cancelled = false
        AudioPlayer.getDuration(path).then((value) => {
            if (!cancelled) setDuration(value)
        })
        return () => {
            cancelled = true
        }
    }, [path])

    const audioKey = playlist && index > -1 ? AudioPlayer.getKey(path, index) : path
    const audioData = playing[audioKey]
    const outline = !!audioData && (!currentPlaylist || currentPlaylist?.index === index)

    function click(detail: ButtonClickDetail) {
        if (locked || detail.ctrl || detail.shift) return
        if (playlist) AudioPlaylist.start(active || "", path, index, { pauseIfPlaying: true })
        else AudioPlayer.start(path, { name }, { playMultiple: detail.alt })
    }

    function doubleClick(detail: ButtonClickDetail) {
        if (detail.ctrl || detail.shift) return
        addProjectItem({ id: path, name, type: "audio" })
    }

    let icon = "music"
    let white = true
    if (duration !== null) {
        if (audioData?.paused === true) icon = "play"
        else if (audioData?.paused === false) icon = "pause"
        else if (mediaValue[path]?.favourite === true && active !== "favourites") icon = "star"
        else icon = AudioPlayer.getAudioType(path, duration)
        white = audioData?.paused === true || (!audioData && (mediaValue[path]?.favourite !== true || active === "favourites"))
    }

    return (
        <SelectElem id="audio" data={{ path, name, index }} fileOver={fileOver} borders={playlist ? "edges" : "all"} trigger={playlist ? "column" : null} draggable>
            <Button align="start" className={`context #audio_button${playlist ? "_playlist" : ""}`} showOutline={outline} isActive={currentShow?.id === path} style={{ width: "100%" }} title={path} bold={false} onClick={click} onDblClick={doubleClick}>
                <span className={styles.row} style={{ maxWidth: "90%" }}>
                    <Icon id={icon} white={white} right />
                    <p>{name.slice(0, name.lastIndexOf("."))}</p>
                </span>
                <span className={styles.row} style={{ opacity: 0.8 }}>
                    <p>{duration === null ? "00:00" : joinTime(secondsToTime(duration))}</p>
                </span>
            </Button>
        </SelectElem>
    )
}

import { useEffect, useState } from "react"
import { AudioPlayer } from "../../../../shared/audio/audioPlayer"
import { getFileName } from "../../../../shared/utils/helpers/media"
import { activeShow, outLocked, playingAudio } from "../../../../shared/core/stores"
import { useStore } from "../../../../shared/ui/hooks/useStore"
import { Button, type ButtonClickDetail } from "../../../../shared/ui/kit/button/Button"
import { SelectElem } from "../../../../shared/ui/system/SelectElem"
import styles from "./AudioEffect.module.css"

// Port de components/drawer/audio/AudioEffect.svelte (card de la librería de efectos).
export interface AudioEffectCardProps {
    path: string
    name: string
}

export function AudioEffect({ path, name }: AudioEffectCardProps) {
    const playing = useStore(playingAudio)
    const show = useStore(activeShow)
    const locked = useStore(outLocked)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)

    useEffect(() => {
        if (!playing[path]) {
            setCurrentTime(0)
            setDuration(0)
            return
        }
        const interval = setInterval(() => {
            const audio = AudioPlayer.getAudio(path)
            if (!audio) return
            setCurrentTime(audio.currentTime)
            setDuration(audio.duration)
        }, 80)
        return () => clearInterval(interval)
    }, [path, playing])

    function handleClick(detail: ButtonClickDetail) {
        if (locked || detail.ctrl) return
        AudioPlayer.start(path, { name }, { playMultiple: true, stopIfPlaying: true, clearTime: 0.3 })
    }

    return (
        <SelectElem id="audio_effect" data={{ path, name }} style={{ width: "calc(20% - 5px)" }} draggable>
            <Button align="start" className="context #audio_effect_button" showOutline={!!playing[path]} isActive={show?.id === path} style={{ width: "100%", height: "100px", border: "2px solid var(--primary-lighter)", borderRadius: "8px" }} title={getFileName(path)} bold={false} onClick={handleClick}>
                <div className={styles.flex}>
                    <p style={{ fontSize: "1.15em", whiteSpace: "normal" }}>{name}</p>
                </div>
                {duration ? <div className={styles.progress} style={{ width: `${(currentTime / duration) * 100}%` }} /> : null}
            </Button>
        </SelectElem>
    )
}

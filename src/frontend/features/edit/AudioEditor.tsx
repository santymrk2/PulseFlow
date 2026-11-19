import { useEffect, useRef, useState } from "react"
import { AudioPlayer } from "../../shared/audio/audioPlayer"
import { createWaveform, WAVEFORM_SAMPLES } from "../../shared/audio/audioWaveform"
import { activeEdit, activeShow, media } from "../../shared/core/stores"
import { useStore } from "../../shared/ui/hooks/useStore"
import styles from "./AudioEditor.module.css"

// Port de components/edit/editors/AudioEditor.svelte.
export function AudioEditor() {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentMedia = useStore(media)

    const path = currentActiveEdit.id || currentActiveShow?.id || ""
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [duration, setDuration] = useState(0)

    useEffect(() => {
        if (!path) return
        let cancelled = false
        void AudioPlayer.getDuration(path).then((value) => {
            if (!cancelled) setDuration(value || 0)
        })
        return () => {
            cancelled = true
        }
    }, [path])

    useEffect(() => {
        const container = containerRef.current
        if (!container || !path) return

        container.querySelectorAll(".wave-bar").forEach((bar) => {
            ;(bar as HTMLElement).style.height = "0"
        })
        void createWaveform(container, path)
    }, [path])

    const start = path && currentMedia[path] && duration ? AudioPlayer.getStartTime(path) : 0
    const end = path && currentMedia[path] && duration ? AudioPlayer.getEndTime(path, duration) : 0
    const startPercentage = duration && end ? start / duration : 0
    const endPercentage = 1 - (duration && end ? end / duration : 1)

    return (
        <div className={styles.center}>
            <div className={styles.waveformContainer} ref={containerRef}>
                {Array.from({ length: WAVEFORM_SAMPLES }).map((_, index) => (
                    <div key={index} className={`wave-bar ${styles.waveBar}`} />
                ))}
            </div>

            <div className={`${styles.trim} ${styles.left}`} style={{ width: `${startPercentage * 100}%` }} />
            <div className={`${styles.trim} ${styles.right}`} style={{ width: `${endPercentage * 100}%` }} />
        </div>
    )
}

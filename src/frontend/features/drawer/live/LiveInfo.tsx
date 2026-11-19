import { useEffect, useState } from "react"
import { activeRecording, currentRecordingStream, drawerTabsData, special } from "../../../shared/core/stores"
import { mediaRecorderIsPaused, stopMediaRecorder, toggleMediaRecorder } from "../logic/live/recorder"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { T } from "../../../shared/ui/helpers/T"
import { Button } from "../../../shared/ui/kit/button/Button"
import { TextField } from "../../../shared/ui/kit/text-field/TextField"
import { useStore } from "../../../shared/ui/hooks/useStore"
import styles from "./LiveInfo.module.css"

export interface LiveInfoProps {
    optionsOpen: boolean
}

// Port de components/drawer/live/LiveInfo.svelte. recorder.ts se importa tal cual: es un singleton con estado de módulo.
export function LiveInfo({ optionsOpen }: LiveInfoProps) {
    const recording = useStore(activeRecording)
    const recordingStream = useStore(currentRecordingStream)
    const tabs = useStore(drawerTabsData)
    const settings = useStore(special)
    const [video, setVideo] = useState<HTMLVideoElement | null>(null)
    const [paused, setPaused] = useState(false)
    const active = tabs.media?.openedSubSubTab?.inputs || "cameras"

    useEffect(() => {
        if (!video) return
        if (video.srcObject !== recordingStream) video.srcObject = recordingStream
        if (recordingStream) setPaused(mediaRecorderIsPaused() || false)
    }, [video, recordingStream])

    useEffect(() => {
        if (paused) video?.pause()
        else video?.play()?.catch(() => {})
    }, [paused, video])

    function updateSpecial(key: string, value: string | null) {
        special.update((all) => {
            if (!value) delete all[key]
            else all[key] = value
            return all
        })
    }

    if (recording) {
        return (
            <>
                <div className={styles.scroll}>
                    <video ref={setVideo} className={styles.video} muted playsInline>
                        <track kind="captions" />
                    </video>
                    <Button style={{ flex: 0 }} onClick={() => setPaused(toggleMediaRecorder())}>
                        <Icon id={paused ? "play" : "pause"} white={paused} size={1.2} right />
                        <T id={paused ? "popup.continue" : "media.pause"} />
                    </Button>
                </div>
                <div className={styles.bottom}>
                    <Button onClick={() => stopMediaRecorder()}>
                        <Icon id="export" size={1.2} right />
                        <T id="actions.export_recording" />
                    </Button>
                </div>
            </>
        )
    }

    if (active === "screens" || active === "windows") {
        return (
            <div className={styles.scroll} style={{ padding: 10 }}>
                <T id="empty.recording" />
            </div>
        )
    }

    if (active === "ndi" && optionsOpen) {
        return (
            <div className={styles.scroll} style={{ padding: 10 }}>
                <TextField label="inputs.group" title="settings.comma_seperated" value={settings?.ndiInputGroups || ""} placeholder="public" onChange={(value) => updateSpecial("ndiInputGroups", value)} />
            </div>
        )
    }

    return null
}

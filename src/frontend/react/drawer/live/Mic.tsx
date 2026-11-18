import { useEffect, useRef, useState } from "react"
import { Main } from "../../../../types/IPC/Main"
import { AudioMicrophone } from "../../../audio/audioMicrophone"
import { sendMain } from "../../../IPC/main"
import { activeFocus, activeShow, focusMode, playingAudio } from "../../../stores"
import { Icon } from "../../helpers/Icon"
import { Button } from "../../ui/button/Button"
import { useStore } from "../../hooks/useStore"
import styles from "./Mic.module.css"

export interface MicProps {
    mic: { id: string; name: string }
}

// Port de components/drawer/live/Mic.svelte.
export function Mic({ mic }: MicProps) {
    const [soundLevel, setSoundLevel] = useState(0)
    const [hasContext, setHasContext] = useState(false)
    const playing = useStore(playingAudio)
    const focus = useStore(focusMode)

    const contextRef = useRef<AudioContext | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const frameRef = useRef<number | null>(null)
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        let destroyed = false

        function handleSuccess(stream: MediaStream) {
            if (destroyed) {
                stream.getAudioTracks().forEach((track) => track.stop())
                return
            }
            streamRef.current = stream
            const context = new AudioContext()
            contextRef.current = context
            const source = context.createMediaStreamSource(stream)
            const analyser = context.createAnalyser()
            analyser.smoothingTimeConstant = 0.2
            analyser.fftSize = 1024
            source.connect(analyser)
            const array = new Uint8Array(analyser.frequencyBinCount)
            setHasContext(true)

            const updateLevel = () => {
                if (context.state === "closed") return
                analyser.getByteFrequencyData(array)
                let values = 0
                for (let i = 0; i < array.length; i++) values += array[i]
                setSoundLevel(Math.min(100, values / array.length))
                frameRef.current = requestAnimationFrame(updateLevel)
            }
            updateLevel()
        }

        function capture() {
            navigator.mediaDevices
                .getUserMedia({ audio: { deviceId: { exact: mic.id } } })
                .then(handleSuccess)
                .catch((err: Error) => {
                    if (destroyed) return
                    console.error(err)
                    if (err.name === "NotReadableError") sendMain(Main.ACCESS_MICROPHONE_PERMISSION)
                    retryRef.current = setTimeout(capture, 5000)
                })
        }

        capture()
        return () => {
            destroyed = true
            if (frameRef.current) cancelAnimationFrame(frameRef.current)
            streamRef.current?.getAudioTracks().forEach((track) => track.stop())
            if (retryRef.current) clearTimeout(retryRef.current)
            contextRef.current?.close().catch(() => {})
        }
    }, [mic.id])

    const micId = "mic_sub_" + mic.id
    const muted = !playing[micId]

    return (
        <div className={styles.main}>
            <Button
                align="start"
                style={{ width: "100%" }}
                bold={false}
                disabled={!hasContext}
                onClick={() => {
                    if (!contextRef.current) return
                    AudioMicrophone.start(mic.id, { name: mic.name }, { pauseIfPlaying: true })
                }}
                onDblClick={(detail) => {
                    if (detail.ctrl) return
                    if (focus) activeFocus.set({ id: mic.id, type: "audio" })
                    else activeShow.set({ id: mic.id, name: mic.name, type: "audio", data: { isMic: true } })
                }}
            >
                <span style={{ display: "flex", gap: 5, flex: 3, alignItems: "center" }}>
                    <Icon id={muted ? "muted" : "volume"} white={muted} right />
                    <p>{mic.name}</p>
                </span>

                {hasContext ? (
                    <div className={styles.channelRow}>
                        <span className={soundLevel > 0 ? `${styles.signalDot} ${styles.active}` : styles.signalDot} />
                        <span className={styles.meter}>
                            <div style={{ width: `${100 - soundLevel}%` }} />
                            <span className={styles.meter} style={{ position: "absolute", opacity: 0.08, right: 0, height: "inherit", width: "100%" }} />
                        </span>
                    </div>
                ) : null}
            </Button>
        </div>
    )
}

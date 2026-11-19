import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { activeRecording, currentRecordingStream } from "../../shared/core/stores"
import { createMediaRecorder } from "../../features/drawer/logic/live/recorder"
import { clone } from "../../shared/utils/helpers/array"
import { useStore } from "../../shared/ui/hooks/useStore"
import styles from "./Recorder.module.css"

export function Recorder() {
    const recording = useStore(activeRecording)
    const recordingStream = useStore(currentRecordingStream)
    const [recorderActive, setRecorderActive] = useState(false)
    const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)

    const isOutputRecording = !!(recording?.isOutput || recording?.type === "output")

    useEffect(() => {
        if (videoRef.current && recordingStream && !isOutputRecording && videoRef.current.srcObject !== recordingStream) {
            videoRef.current.srcObject = recordingStream
            videoRef.current.play().catch(() => {})
        }
    }, [recordingStream, isOutputRecording])

    useEffect(() => {
        if (!recording) {
            currentStream?.getTracks().forEach((track) => {
                track.stop()
            })
            setCurrentStream(null)

            if (videoRef.current) videoRef.current.srcObject = null
            setRecorderActive(false)
            return
        }

        if (isOutputRecording) return

        setRecorderActive(true)

        const options = clone(recording)
        options.maxWidth = 4096
        options.maxHeight = 2160

        navigator.mediaDevices
            .getUserMedia(options)
            .then((stream) => {
                if (!stream) return console.error("Error getting media stream!")
                if (!videoRef.current || !get(activeRecording)) {
                    stream.getTracks().forEach((track) => {
                        track.stop()
                    })
                    return
                }

                setCurrentStream(stream)
                currentRecordingStream.set(stream)
                videoRef.current.srcObject = stream
                videoRef.current.play().catch(() => {})
                createMediaRecorder(stream)
            })
            .catch(function (err) {
                console.error(err.name + ": " + err.message)
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recording])

    if (!(recorderActive || recordingStream) || isOutputRecording) return null

    return (
        <video ref={videoRef} className={styles.recorder} muted autoPlay playsInline>
            <track kind="captions" />
        </video>
    )
}

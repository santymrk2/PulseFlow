import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../shared/core/ipc/main"
import { outputs } from "../../../shared/core/stores"
import { findMatchingOut } from "../../../shared/utils/helpers/output"
import { SelectElem } from "../../system/SelectElem"
import { useStore } from "../../hooks/useStore"
import { Card } from "../Card"
import type { Screen } from "./types"
import styles from "./Capture.module.css"

export interface CaptureProps {
    screen: Screen
    // El Svelte hacía `bind:streams` y hacía push sobre el mismo array: se conserva la referencia.
    streams: MediaStream[]
    background?: boolean
    onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

export function Capture({ screen, streams, background = false, onClick }: CaptureProps) {
    const [loaded, setLoaded] = useState(false)
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
    const [video, setVideo] = useState<HTMLVideoElement | null>(null)
    const outputList = useStore(outputs)

    const constraints = {
        video: {
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: screen.id,
                maxWidth: 1920,
                maxHeight: 1080,
                maxFrameRate: 60
            }
        }
    }

    const destroyed = useRef(false)
    const currentStream = useRef<MediaStream | null>(null)
    const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const readyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const loadedRef = useRef(false)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    videoRef.current = video
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    canvasRef.current = canvas

    function ready() {
        const currentVideo = videoRef.current
        const currentCanvas = canvasRef.current
        if (loadedRef.current || !currentVideo || background || !currentCanvas) return
        currentCanvas.width = currentVideo.offsetWidth
        currentCanvas.height = currentVideo.offsetHeight
        currentCanvas.getContext("2d")?.drawImage(currentVideo, 0, 0, currentVideo.offsetWidth, currentVideo.offsetHeight)
        loadedRef.current = true
        setLoaded(true)
    }

    useEffect(() => {
        destroyed.current = false

        function capture() {
            navigator.mediaDevices
                .getUserMedia(constraints as MediaStreamConstraints)
                .then((stream) => {
                    if (destroyed.current || !videoRef.current) {
                        stream.getTracks().forEach((track) => track.stop())
                        return
                    }
                    currentStream.current = stream
                    streams.push(stream)
                    const currentVideo = videoRef.current!
                    currentVideo.srcObject = stream
                    currentVideo.onloadedmetadata = () => {
                        currentVideo.play()
                        readyTimeout.current = setTimeout(ready, 1000)
                    }
                })
                .catch((err: Error) => {
                    if (destroyed.current) return
                    console.error(err.name + ": " + err.message)
                    sendMain(Main.ACCESS_SCREEN_PERMISSION)
                    retryTimeout.current = setTimeout(capture, 5000)
                })
        }

        capture()
        return () => {
            destroyed.current = true
            if (retryTimeout.current) clearTimeout(retryTimeout.current)
            if (readyTimeout.current) clearTimeout(readyTimeout.current)
            currentStream.current?.getTracks().forEach((track) => track.stop())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (background) {
        return (
            <video ref={setVideo} className={styles.video} style={{ width: "100%", height: "100%", pointerEvents: "none", position: "absolute" }}>
                <track kind="captions" />
            </video>
        )
    }

    const outlineColor = findMatchingOut(screen.id, outputList)
    const isScreen = screen.id.includes("screen")

    return (
        <Card mediaData={JSON.stringify(constraints)} className="context #screen_card" loaded={loaded} outlineColor={outlineColor} active={outlineColor !== null} onClick={onClick} title={screen.name} label={screen.name} icon={isScreen ? "screen" : "window"} white={!isScreen} showPlayOnHover>
            <SelectElem style={{ display: "flex" }} id="screen" data={{ id: screen.id, type: "screen", name: screen.name }} draggable>
                <canvas ref={setCanvas} className={styles.canvas} />
                {!loaded ? (
                    <video ref={setVideo} className={styles.video} style={{ pointerEvents: "none", position: "absolute" }}>
                        <track kind="captions" />
                    </video>
                ) : null}
            </SelectElem>
        </Card>
    )
}

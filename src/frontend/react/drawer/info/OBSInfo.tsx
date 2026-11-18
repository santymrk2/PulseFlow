import { useEffect, useRef, useState } from "react"
import { obsData } from "../../../stores"
import { connectToOBS } from "../../../utils/obsTalk"
import { wait } from "../../../utils/common"
import { useStore } from "../../hooks/useStore"
import { cn } from "../../../lib/utils"
import styles from "./OBSInfo.module.css"

// Port de components/drawer/info/OBSInfo.svelte. Cliente OBS y sus intervalos se conservan tal cual.
type OBSClient = Awaited<ReturnType<typeof connectToOBS>>

interface OBSMessage {
    op?: number
    d?: {
        responseData?: Record<string, unknown>
        requestType?: string
        requestStatus?: { result?: boolean }
        eventData?: Record<string, unknown>
        eventType?: string
    }
}

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {})

export function OBSInfo() {
    const data = useStore(obsData)
    const [connected, setConnected] = useState(false)
    const [isLive, setIsLive] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [previewImg, setPreviewImg] = useState("")
    const [cpuUsage, setCpuUsage] = useState(0)
    const [activeFps, setActiveFps] = useState(0)
    const [streamDuration, setStreamDuration] = useState("")
    const [streamBytes, setStreamBytes] = useState(0)

    const obs = useRef<OBSClient | null>(null)
    const mounted = useRef(false)
    const scene = useRef("")
    const live = useRef(false)
    const cpuBuffer = useRef<number[]>([])
    const fpsBuffer = useRef<number[]>([])
    const previewInterval = useRef<ReturnType<typeof setInterval> | null>(null)
    const metricsInterval = useRef<ReturnType<typeof setInterval> | null>(null)

    function stopPreviewAutoRefresh() {
        if (previewInterval.current) clearInterval(previewInterval.current)
        previewInterval.current = null
    }

    function startPreviewAutoRefresh() {
        stopPreviewAutoRefresh()
        previewInterval.current = setInterval(() => latest.current.getPreview(), 500)
    }

    function stopMetricsAutoRefresh() {
        if (metricsInterval.current) clearInterval(metricsInterval.current)
        metricsInterval.current = null
    }

    function getPreview() {
        if (!mounted.current || !obs.current || !scene.current) return
        const requestId = Math.random().toString(36).substring(7)
        obs.current.call("GetSourceScreenshot", {
            sourceName: scene.current,
            imageFormat: "jpg",
            imageWidth: 480,
            imageCompressionQuality: 50,
            requestId
        })
        startPreviewAutoRefresh()
    }

    function getMetrics() {
        if (!obs.current) return
        obs.current.call("GetStats")
        if (live.current) obs.current.call("GetStreamStatus")
    }

    function startMetricsAutoRefresh() {
        stopMetricsAutoRefresh()
        metricsInterval.current = setInterval(() => latest.current.getMetrics(), 1000)
    }

    const latest = useRef({ getPreview, getMetrics })
    useEffect(() => {
        latest.current = { getPreview, getMetrics }
    })

    useEffect(() => {
        mounted.current = true
        let unsubscribe: (() => void) | undefined

        async function setup() {
            const client = await connectToOBS()
            obs.current = client
            latest.current.getPreview()

            client.onStateChange((isConnected: boolean) => {
                setConnected(isConnected)
                if (isConnected) {
                    client.call("GetSceneList")
                    client.call("GetStreamStatus")
                    client.call("GetRecordStatus")
                    startMetricsAutoRefresh()
                } else {
                    stopMetricsAutoRefresh()
                }
            })

            client.listen((message: OBSMessage) => {
                if (message.op === 7 && message.d) {
                    const res = asRecord(message.d.responseData)
                    switch (message.d.requestType) {
                        case "GetSceneList":
                            scene.current = String(res.currentProgramSceneName || "")
                            setPreviewImg("")
                            latest.current.getPreview()
                            break
                        case "GetSceneItemList":
                            latest.current.getPreview()
                            break
                        case "GetStats": {
                            const cpu = Number(res.cpuUsage || 0)
                            const fps = Number(res.activeFps || 0)
                            cpuBuffer.current.push(cpu)
                            fpsBuffer.current.push(fps)
                            if (cpuBuffer.current.length > 10) cpuBuffer.current.shift()
                            if (fpsBuffer.current.length > 10) fpsBuffer.current.shift()
                            setCpuUsage(cpuBuffer.current.reduce((a, b) => a + b, 0) / cpuBuffer.current.length)
                            setActiveFps(fpsBuffer.current.reduce((a, b) => a + b, 0) / fpsBuffer.current.length)
                            break
                        }
                        case "GetStreamStatus":
                            setIsLive(Boolean(res.outputActive))
                            live.current = Boolean(res.outputActive)
                            setStreamDuration(String(res.outputTimecode || ""))
                            setStreamBytes(Number(res.outputBytes || 0))
                            break
                        case "GetRecordStatus":
                            setIsRecording(Boolean(res.isRecording ?? res.outputActive ?? false))
                            break
                        case "ToggleRecord":
                            if (typeof res.outputActive !== "undefined") setIsRecording(Boolean(res.outputActive))
                            break
                        case "GetSourceScreenshot":
                            if (message.d.requestStatus?.result) setPreviewImg(String(res.imageData || ""))
                            break
                    }
                }

                if (message.op === 5 && message.d) {
                    const evt = asRecord(message.d.eventData)
                    switch (message.d.eventType) {
                        case "CurrentProgramSceneChanged":
                            scene.current = String(evt.sceneName || "")
                            setPreviewImg("")
                            latest.current.getPreview()
                            break
                        case "StreamStateChanged":
                            live.current = Boolean(evt.outputActive)
                            setIsLive(live.current)
                            break
                        case "RecordStateChanged":
                            setIsRecording(Boolean(evt.outputActive))
                            break
                    }
                }
            })
        }

        async function start() {
            if (!data.connected) {
                unsubscribe = obsData.subscribe((value) => {
                    if (value.connected) {
                        unsubscribe?.()
                        void setup()
                    }
                })
                return
            }
            await wait(100)
            await setup()
        }

        void start()
        return () => {
            mounted.current = false
            unsubscribe?.()
            stopPreviewAutoRefresh()
            stopMetricsAutoRefresh()
        }
        // El estado inicial de obsData se lee al montar, igual que el onMount de Svelte.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!connected) return null

    return (
        <div className={styles.root}>
            <div className={styles.preview}>{previewImg ? <img id="preview-img" src={previewImg} alt="Scene Preview" className={styles.previewImage} /> : <div className={styles.previewPlaceholder}>No Preview Available</div>}</div>

            <div className={styles.spacer} />

            <div className={styles.metrics}>
                <div className={styles.statusCell}>
                    <span className={cn(styles.statusLabel, isLive ? styles.labelActive : styles.labelInactive)}>LIVE</span>
                    <span className={cn(styles.dot, isLive ? styles.dotActive : styles.dotInactive)} />
                </div>
                <div className={styles.statusCell}>
                    <span className={cn(styles.statusLabel, isRecording ? styles.labelActive : styles.labelInactive)}>REC</span>
                    <span className={cn(styles.dot, isRecording ? styles.dotActive : styles.dotInactive)} />
                </div>

                <div className={styles.metric}>
                    <span className={styles.metricLabel}>CPU Usage</span>
                    <span className={styles.metricValue}>{cpuUsage.toFixed(1)}%</span>
                </div>
                <div className={styles.metric}>
                    <span className={styles.metricLabel}>Framerate</span>
                    <span className={styles.metricValue}>{activeFps.toFixed(0)} FPS</span>
                </div>

                {isLive ? (
                    <>
                        <div className={styles.liveDivider} />
                        <div className={styles.metric}>
                            <span className={styles.metricLabel}>Duration</span>
                            <span className={styles.liveValue}>{streamDuration}</span>
                        </div>
                        <div className={styles.metric}>
                            <span className={styles.metricLabel}>Data Sent</span>
                            <span className={styles.metricValue}>{(streamBytes / (1024 * 1024)).toFixed(1)} MB</span>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    )
}

import { useEffect, useRef, useState } from "react"
import { obsData } from "../../../stores"
import { connectToOBS } from "../../../utils/obsTalk"
import { T } from "../../helpers/T"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { Link } from "../../ui/link/Link"
import "./OBS.module.css"

// Port de components/drawer/pages/OBS.svelte: docks de OBS Studio (escenas, fuentes, audio, transiciones y controles).
// El protocolo llega sin tipos desde `obsTalk`; cada mensaje se interpreta con las vistas de abajo.
interface OBSource {
    sceneItemId: number
    sceneItemIndex?: number
    sceneItemEnabled?: boolean
    sourceName?: string
}

interface OBSChannel {
    db: number
    percent: number
    hasSound: boolean
}

interface OBSInput {
    inputName: string
    inputKind?: string
    inputMuted?: boolean
    hasAudio?: boolean
    channels?: OBSChannel[]
}

interface OBSResponse {
    scenes?: { sceneName: string; sceneIndex: number }[]
    currentProgramSceneName?: string
    outputActive?: boolean
    isRecording?: boolean
    sceneItems?: OBSource[]
    transitions?: { transitionName: string }[]
    currentSceneTransitionName?: string
    inputs?: OBSInput[]
    inputMuted?: boolean
}

interface OBSEvent {
    sceneName?: string
    outputActive?: boolean
    sceneItemId?: number
    sceneItemEnabled?: boolean
    transitionName?: string
    inputName?: string
    inputMuted?: boolean
    inputs?: { inputName: string; inputLevelsMul?: number[][] }[]
}

interface OBSMessageBody {
    requestType?: string
    requestId?: string
    requestStatus?: { result?: boolean }
    responseData?: OBSResponse
    eventType?: string
    eventData?: OBSEvent
}

interface OBSMessage {
    op: number
    d?: OBSMessageBody
}

type OBSConnection = Awaited<ReturnType<typeof connectToOBS>>

export function OBS() {
    const obsDataValue = useStore(obsData)

    const [connected, setConnected] = useState(false)
    const [scenes, setScenes] = useState<string[]>([])
    const [currentScene, setCurrentSceneState] = useState("")
    const [isLive, setIsLive] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [errorMsg, setErrorMsg] = useState("")
    const [sources, setSources] = useState<OBSource[]>([])
    const [transitions, setTransitions] = useState<string[]>([])
    const [currentTransition, setCurrentTransition] = useState("")
    const [audioInputs, setAudioInputs] = useState<OBSInput[]>([])
    const [showAll, setShowAll] = useState(false)

    const obsRef = useRef<OBSConnection | null>(null)
    // El listener de OBS se registra una sola vez y lee siempre los valores vivos (como las variables de Svelte).
    const sourcesRef = useRef<OBSource[]>([])
    const currentSceneRef = useRef("")
    const audioInputsRef = useRef<OBSInput[]>([])

    function updateSources(next: OBSource[]) {
        sourcesRef.current = next
        setSources(next)
    }

    function updateAudioInputs(next: OBSInput[]) {
        audioInputsRef.current = next
        setAudioInputs(next)
    }

    function updateCurrentScene(next: string) {
        currentSceneRef.current = next
        setCurrentSceneState(next)
    }

    function handleInputMuteResponse(d: OBSMessageBody) {
        const reqId = d.requestId || ""
        if (!reqId.startsWith("mute_")) return

        const inputName = reqId.substring(5)
        const hasAudio = d.requestStatus?.result === true
        if (hasAudio) {
            updateAudioInputs(audioInputsRef.current.map((input) => (input.inputName === inputName ? { ...input, inputMuted: d.responseData?.inputMuted, hasAudio: true } : input)))
        } else {
            updateAudioInputs(audioInputsRef.current.filter((input) => input.inputName !== inputName))
        }
    }

    function handleInputListResponse(res: OBSResponse | undefined) {
        const enabledSceneSourceNames = sourcesRef.current.filter((s) => s.sceneItemEnabled).map((s) => s.sourceName)
        const candidateInputs = (res?.inputs || []).filter((input) => {
            const kind = (input.inputKind || "").toLowerCase()
            const name = input.inputName || ""
            if (kind.includes("image") || kind.includes("color") || kind.includes("text") || kind.includes("cut")) return false
            if (name.toLowerCase().includes("rtmp") || kind.includes("rtmp")) return false
            const isGlobal = kind.includes("wasapi") || kind.includes("audio") || kind.includes("mic")
            return isGlobal || enabledSceneSourceNames.includes(name)
        })

        updateAudioInputs(candidateInputs.map((input) => ({ ...input, hasAudio: undefined })))
        candidateInputs.forEach((input) => {
            obsRef.current?.send({
                op: 6,
                d: {
                    requestType: "GetInputMute",
                    requestId: `mute_${input.inputName}`,
                    requestData: { inputName: input.inputName }
                }
            })
        })
    }

    function handleMessage(msg: OBSMessage) {
        // OpCode 7: Request Responses
        if (msg.op === 7 && msg.d) {
            const res = msg.d.responseData
            switch (msg.d.requestType) {
                case "GetSceneList":
                    setScenes(
                        (res?.scenes || [])
                            .slice()
                            .sort((a, b) => b.sceneIndex - a.sceneIndex)
                            .map((s) => s.sceneName)
                    )
                    updateCurrentScene(res?.currentProgramSceneName || "")
                    break
                case "GetStreamStatus":
                    setIsLive(Boolean(res?.outputActive))
                    break
                case "GetRecordStatus":
                    setIsRecording(Boolean(res?.isRecording ?? res?.outputActive ?? false))
                    break
                case "GetSceneItemList":
                    updateSources((res?.sceneItems || []).slice().sort((a, b) => (b.sceneItemIndex ?? 0) - (a.sceneItemIndex ?? 0)))
                    obsRef.current?.call("GetInputList")
                    break
                case "GetSceneTransitionList":
                    setTransitions((res?.transitions || []).map((t) => t.transitionName))
                    setCurrentTransition(res?.currentSceneTransitionName || "")
                    break
                case "GetInputList":
                    handleInputListResponse(res)
                    break
                case "GetInputMute":
                    handleInputMuteResponse(msg.d)
                    break
                case "ToggleRecord":
                    if (res && typeof res.outputActive !== "undefined") setIsRecording(res.outputActive)
                    break
            }
        }

        // OpCode 5: Event Broadcasters
        if (msg.op === 5 && msg.d) {
            const evt: OBSEvent = msg.d.eventData || {}
            switch (msg.d.eventType) {
                case "CurrentProgramSceneChanged":
                    updateCurrentScene(evt.sceneName || "")
                    break
                case "StreamStateChanged":
                    setIsLive(!!evt.outputActive)
                    break
                case "RecordStateChanged":
                    setIsRecording(!!evt.outputActive)
                    break
                case "SceneItemEnableStateChanged":
                    if (evt.sceneName === currentSceneRef.current) {
                        updateSources(sourcesRef.current.map((s) => (s.sceneItemId === evt.sceneItemId ? { ...s, sceneItemEnabled: evt.sceneItemEnabled } : s)))
                    }
                    break
                case "SceneItemCreated":
                case "SceneItemRemoved":
                    if (evt.sceneName === currentSceneRef.current) obsRef.current?.call("GetSceneItemList", { sceneName: currentSceneRef.current })
                    break
                case "CurrentSceneTransitionChanged":
                    setCurrentTransition(evt.transitionName || "")
                    break
                case "InputMuteStateChanged":
                    updateAudioInputs(audioInputsRef.current.map((input) => (input.inputName === evt.inputName ? { ...input, inputMuted: evt.inputMuted } : input)))
                    break
                case "InputVolumeMeters":
                    if (evt.inputs) {
                        const meters = evt.inputs
                        updateAudioInputs(
                            audioInputsRef.current.map((input) => {
                                const meterData = meters.find((meter) => meter.inputName === input.inputName)
                                if (!meterData) return input
                                if (!meterData.inputLevelsMul) return { ...input, channels: [] }

                                return {
                                    ...input,
                                    channels: meterData.inputLevelsMul.map((channel) => {
                                        const mag = channel[1] ?? channel[0] ?? 0
                                        // -100dB is 0.00001, anything above this means the line is active
                                        const channelHasSound = mag > 0.00001

                                        const db = mag > 0 ? 20 * Math.log10(mag) : -100

                                        // Piecewise mapping to match OBS exact visual meter spacing
                                        let percent = 0
                                        if (db <= -60) percent = 0
                                        else if (db <= -20) percent = ((db + 60) / 40) * 75
                                        else if (db <= -9) percent = 75 + ((db + 20) / 11) * 15
                                        else if (db <= 0) percent = 90 + ((db + 9) / 9) * 10
                                        else percent = 100

                                        return { db, percent, hasSound: channelHasSound }
                                    })
                                }
                            })
                        )
                    }
                    break
            }
        }
    }

    async function connect() {
        setErrorMsg("")
        const connection = await connectToOBS()
        obsRef.current = connection

        if (connection.isConnected) setConnected(true)

        connection.onStateChange((isConnected, error) => {
            setConnected(isConnected)
            setErrorMsg("")
            if (!isConnected && error) setErrorMsg(error)
            if (isConnected) {
                connection.call("GetSceneList")
                connection.call("GetStreamStatus")
                connection.call("GetRecordStatus")
            }
        })

        connection.listen(handleMessage)
    }

    function changeScene(name: string) {
        obsRef.current?.call("SetCurrentProgramScene", { sceneName: name })
    }

    function toggleSource(source: OBSource) {
        const obs = obsRef.current
        if (!obs) return
        const nextState = !source.sceneItemEnabled
        obs.call("SetSceneItemEnabled", {
            sceneName: currentSceneRef.current,
            sceneItemId: source.sceneItemId,
            sceneItemEnabled: nextState
        })
        updateSources(sourcesRef.current.map((item) => (item.sceneItemId === source.sceneItemId ? { ...item, sceneItemEnabled: nextState } : item)))
        setTimeout(() => {
            if (obs && currentSceneRef.current) {
                obs.call("GetSceneItemList", { sceneName: currentSceneRef.current })
                obs.call("GetInputList")
            }
        }, 300)
    }

    function changeTransition(name: string) {
        const obs = obsRef.current
        if (obs) {
            obs.call("SetCurrentSceneTransition", { transitionName: name })
            setCurrentTransition(name)
        }
    }

    function toggleMute(input: OBSInput) {
        const obs = obsRef.current
        if (obs) {
            obs.call("ToggleInputMute", { inputName: input.inputName })
            updateAudioInputs(audioInputsRef.current.map((item) => (item.inputName === input.inputName ? { ...item, inputMuted: !item.inputMuted } : item)))
        }
    }

    function toggleStream() {
        obsRef.current?.call("ToggleStream")
    }

    function toggleRecording() {
        const obs = obsRef.current
        if (obs) {
            obs.call("ToggleRecord")
            setTimeout(() => {
                obs.call("GetStreamStatus")
            }, 500)
        }
    }

    // onMount: si ya estaba conectado, reconectar. Es sólo al montar.
    useEffect(() => {
        if (obsDataValue.connected) void connect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // $: if (connected && obs) { GetSceneTransitionList, GetInputList }
    useEffect(() => {
        if (!connected || !obsRef.current) return
        obsRef.current.call("GetSceneTransitionList")
        obsRef.current.call("GetInputList")
    }, [connected])

    // $: if (connected && currentScene && obs) GetSceneItemList
    useEffect(() => {
        if (!connected || !currentScene || !obsRef.current) return
        obsRef.current.call("GetSceneItemList", { sceneName: currentScene })
    }, [connected, currentScene])

    return connected ? (
        <>
            <div className="obs-docks-container">
                {/* Scenes List Dock */}
                <div className="obs-dock">
                    <div className="obs-dock-header">
                        <h4 className="obs-dock-title">Scenes</h4>
                    </div>
                    <ul className="obs-dock-list">
                        {scenes.map((scene) => (
                            <li key={scene} style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                                <Button onClick={() => changeScene(scene)} id={scene === currentScene ? "active-scene-btn" : ""} className={`obs-btn ${scene === currentScene ? "active-scene" : ""}`}>
                                    {scene}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Sources List Dock */}
                {showAll ? (
                    <div className="obs-dock">
                        <div className="obs-dock-header">
                            <h4 className="obs-dock-title">Sources</h4>
                        </div>
                        <ul className="obs-dock-list">
                            {sources.map((source) => (
                                <li key={source.sceneItemId} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3em 0.7em", background: "#2b303c", borderRadius: 4 }}>
                                    <span style={{ color: source.sceneItemEnabled ? "#f1f3f5" : "#64748b", fontSize: "0.85em", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 140 }} title={source.sourceName}>
                                        {source.sourceName}
                                    </span>
                                    <Button onClick={() => toggleSource(source)} className="obs-btn-icon" title={source.sceneItemEnabled ? "Hide Layer" : "Show Layer"}>
                                        <Icon id={source.sceneItemEnabled ? "eye" : "hide"} style={{ opacity: source.sceneItemEnabled ? 1 : 0.35 }} white />
                                    </Button>
                                </li>
                            ))}
                            {sources.length === 0 ? <div style={{ padding: "1em", color: "#555", fontSize: "0.8em", textAlign: "center" }}>No Sources</div> : null}
                        </ul>
                    </div>
                ) : null}

                {/* Audio Mixer Dock */}
                <div className="obs-dock">
                    <div className="obs-dock-header">
                        <h4 className="obs-dock-title">Audio Mixer</h4>
                    </div>
                    <ul className="obs-dock-list">
                        {audioInputs
                            .filter((input) => input.hasAudio)
                            .map((input) => (
                                <li key={input.inputName} style={{ width: "100%", display: "flex", flexDirection: "column", padding: "0.3em 0.7em", background: "#2b303c", borderRadius: 4 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                        <span style={{ color: input.inputMuted ? "#64748b" : "#f1f3f5", fontSize: "0.85em", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={input.inputName}>
                                            {input.inputName}
                                        </span>
                                        <Button onClick={() => toggleMute(input)} className="obs-btn-icon" title={input.inputMuted ? "Unmute" : "Mute"}>
                                            <Icon id={input.inputMuted ? "volume_off" : "volume"} style={{ opacity: input.inputMuted ? 0.7 : 1 }} color={input.inputMuted ? "red" : ""} white />
                                        </Button>
                                    </div>
                                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 2, marginTop: 4, opacity: input.inputMuted ? 0.3 : 1 }}>
                                        {(input.channels || []).map((channel, channelIndex) => (
                                            <div key={channelIndex} style={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}>
                                                <div style={{ width: 10, height: 4, borderRadius: 1.5, background: channel.hasSound ? "#22c55e" : "#101216", transition: "background-color 0.1s ease-out", flexShrink: 0 }} title={channel.hasSound ? "Signal Active" : "No Signal"}></div>
                                                <div style={{ flex: 1, height: 4, background: "#101216", borderRadius: 1.5, overflow: "hidden" }}>
                                                    <div
                                                        style={{
                                                            width: `${channel.percent || 0}%`,
                                                            height: "100%",
                                                            background: (channel.db || -100) > -9 ? "#ef4444" : (channel.db || -100) > -20 ? "#eab308" : "#22c55e",
                                                            transition: "width 0.1s ease-out, background-color 0.1s ease-out",
                                                            maxWidth: "100%"
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        {audioInputs.filter((input) => input.hasAudio).length === 0 ? <div style={{ padding: "1em", color: "#555", fontSize: "0.8em", textAlign: "center" }}>No Audio</div> : null}
                    </ul>
                </div>

                {/* Scene Transitions Dock */}
                {showAll ? (
                    <div className="obs-dock">
                        <div className="obs-dock-header">
                            <h4 className="obs-dock-title">Scene Transitions</h4>
                        </div>
                        <ul className="obs-dock-list">
                            {transitions.map((transition) => (
                                <li key={transition} style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                                    <Button onClick={() => changeTransition(transition)} id={transition === currentTransition ? "active-transition-btn" : ""} className={`obs-btn ${transition === currentTransition ? "active-scene" : ""}`}>
                                        {transition}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                {/* Controls Dock */}
                <div className="obs-dock">
                    <div className="obs-dock-header">
                        <h4 className="obs-dock-title">Controls</h4>
                    </div>
                    <div className="obs-dock-body">
                        <div className="obs-dock-row">
                            <Button onClick={toggleStream} className={`obs-btn obs-btn-control ${isLive ? "obs-btn-danger" : ""}`}>
                                {isLive ? "Stop Streaming" : "Start Streaming"}
                            </Button>
                        </div>
                        <div className="obs-dock-row">
                            <Button onClick={toggleRecording} className={`obs-btn obs-btn-control ${isRecording ? "obs-btn-danger" : ""}`}>
                                {isRecording ? "Stop Recording" : "Start Recording"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <FloatingBar round>
                <Button isActive={showAll} title="create_show.more_options" onClick={() => setShowAll(!showAll)}>
                    <Icon id={showAll ? "eye" : "hide"} white={!showAll} />
                </Button>
            </FloatingBar>
        </>
    ) : (
        <Center>
            <Link url="https://freeshow.app/docs/livestreaming#setting-up-obs-control-from-freeshow">
                <T id="main.docs" />
                <Icon id="launch" white />
            </Link>

            {errorMsg ? <div style={{ marginTop: 20, color: "var(--danger)", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "0.75em 1.25em", borderRadius: 6, fontSize: "0.9em", fontWeight: 500, maxWidth: 340 }}>{errorMsg}</div> : null}

            <Button variant="outline" onClick={connect} style={{ marginTop: 20, width: "100%", maxWidth: 250 }}>
                <Icon id="bind" white />
                <T id="settings.connect_to" replace={["OBS Studio"]} />
            </Button>
        </Center>
    )
}

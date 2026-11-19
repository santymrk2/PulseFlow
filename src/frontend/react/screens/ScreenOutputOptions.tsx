import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import { BLACKMAGIC, NDI, OMT, OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import type { Option } from "../../../types/Main"
import type { Output, Outputs, RtmpDestination } from "../../../types/Output"
import { AudioAnalyser } from "../../audio/audioAnalyser"
import { clone } from "../../components/helpers/array"
import { addRtmpDestination, checkFFmpeg, refreshOut, removeRtmpDestination, startRtmpStreaming, startStreaming, stopRtmpStreaming, stopStreaming, updateOutputRtmpData, updateOutputWebrtcData, updateRtmpDestination } from "../../components/helpers/output"
import { hasStreamableDestination } from "../../components/helpers/rtmpDestinations"
import { requestMain } from "../../shared/core/ipc/main"
import { cn } from "../../shared/core/lib/utils"
import { activePopup, alertMessage, currentOutputSettings, ndiData, omtData, os, outputs, rtmpStatus, saved } from "../../shared/core/stores"
import { newToast } from "../../utils/common"
import { translateText } from "../../utils/language"
import { destroy, receive, send } from "../../utils/request"
import { useFreshStore } from "../hooks/useFreshStore"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { CheckboxField } from "../ui/checkbox-field/CheckboxField"
import { InputRow } from "../ui/input-row/InputRow"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"
import { Title } from "../ui/title/Title"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./ScreenOutputOptions.module.css"

// Port de components/screens/ScreenOutputOptions.svelte (F24.14): opciones de envío (Blackmagic, NDI, OMT, WebRTC, RTMP)
// de la salida elegida en `currentOutputSettings`. Los handlers leen los stores en el momento (`get`), como el Svelte leía
// `$outputs` / `currentOutput` ya actualizados dentro de sus timeouts y callbacks de IPC.

type ScreenOutput = Output & { id: string }
type SelectOption = { label: string; value: string; data?: string; disabled?: boolean }

interface BlackmagicDisplayMode {
    name: string
    width?: number
    height?: number
    frameRate?: unknown
    videoModes?: string[]
}

interface BlackmagicRawDevice {
    deviceHandle: string
    displayName?: string
    modelName?: string
    outputDisplayModes?: BlackmagicDisplayMode[]
    inputDisplayModes?: BlackmagicDisplayMode[]
    supportsInternalKeying?: boolean
    supportsExternalKeying?: boolean
}

const asRecord = (value: unknown): Record<string, unknown> | undefined => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined)
// `e?.detail?.id ?? e`: los campos del kit entregan el valor; el auto-selector de Blackmagic entrega `{ detail: { id } }`
const detailId = (e: unknown) => asRecord(asRecord(e)?.detail)?.id ?? e
const detailIdOrName = (e: unknown) => asRecord(asRecord(e)?.detail)?.id || asRecord(asRecord(e)?.detail)?.name || e

// el `$: currentOutput = clone({ id: $currentOutputSettings, ...$outputs[$currentOutputSettings] })` de Svelte, a demanda
function readCurrent(): ScreenOutput | null {
    const id = get(currentOutputSettings)
    if (!id) return null
    return clone({ id, ...get(outputs)[id] })
}

function getUsedBlackmagicDeviceIds(all: Outputs, excludeId = "") {
    return Object.entries(all)
        .filter(([id, o]) => id !== excludeId && o.blackmagic && o.blackmagicData?.deviceId)
        .map(([, o]) => String(o.blackmagicData.deviceId))
}

function extractPlatformName(urlString: string | undefined): string | null {
    if (!urlString) return null
    try {
        const normalizedUrl = urlString.replace(/^rtmp(s)?:\/\//i, "http$1://")
        const parsedUrl = new URL(normalizedUrl)
        const match = parsedUrl.hostname.toLowerCase().match(/([^.]+)\.[^.]+$/)
        return match ? match[1] : null
    } catch {
        return null
    }
}

const rateControlOptions = [
    { value: "cbr", label: "CBR", data: "Constant Bitrate" },
    { value: "vbr", label: "VBR", data: "Variable Bitrate" }
]

const framerates = [
    { value: "10", label: "10 fps" },
    { value: "12", label: "12 fps" },
    { value: "24", label: "24 fps" },
    { value: "25", label: "25 fps" },
    { value: "30", label: "30 fps" },
    { value: "48", label: "48 fps" },
    { value: "50", label: "50 fps" },
    { value: "60", label: "60 fps" }
]

const streamStyle = { width: "100%", justifyContent: "center" }

export function ScreenOutputOptions() {
    const currentId = useStore(currentOutputSettings)
    const outputsValue = useFreshStore(outputs, clone)
    const rtmpStatusValue = useFreshStore(rtmpStatus, clone)
    const currentOutput: ScreenOutput | null = currentId ? clone({ id: currentId, ...outputsValue[currentId] }) : null

    const [encoderOptions, setEncoderOptions] = useState<SelectOption[]>([{ value: "auto", label: "Auto" }])
    const [blackmagicDevices, setBlackmagicDevices] = useState<Option[]>([])
    // los timeouts y callbacks de IPC leen la lista vigente, no la del render que los creó
    const devicesRef = useRef<Option[]>([])

    const omtQualities = [
        { value: "Default", label: translateText("settings.auto") },
        { value: "Low", label: "Low (least bandwidth)" },
        { value: "Medium", label: "Medium" },
        { value: "High", label: "High (most bandwidth)" }
    ]

    function updateOutput(key: string, value: unknown, outputId = "") {
        if (!outputId) outputId = readCurrent()?.id || ""
        if (!outputId || !get(outputs)[outputId]) return

        if (key === "style") setTimeout(refreshOut)

        outputs.update((a) => {
            const out = a[outputId] as unknown as Record<string, unknown> & Output
            if (!out) return a

            // Update value
            if (key.includes(".")) {
                const [p1, p2] = key.split(".")
                const parent = out[p1] as Record<string, unknown>
                parent[p2] = value
                if (p2 === "lines" && !Number(value)) delete parent[p2]
            } else {
                out[key] = value
            }

            // IPC
            if (key === "enabled") {
                if (value) {
                    enableOutput(out)
                } else {
                    send(OUTPUT, ["REMOVE"], { id: outputId })
                    updateOutput("hideFromPreview", false, outputId)

                    ndiData.update((n) => {
                        delete n[outputId]
                        return n
                    })

                    omtData.update((n) => {
                        delete n[outputId]
                        return n
                    })

                    AudioAnalyser.recorderDeactivate()
                }
            }

            if (out.enabled) {
                // Recreate window for options fixed at creation (transparency, invisibility, capture/OSR mode)
                const recreateKeys = ["transparent", "invisible", "ndi", "omt", "webrtc", "rtmp", "blackmagic"]
                // macOS: always on top outputs are a different window type (panel)
                if (get(os).platform === "darwin") recreateKeys.push("alwaysOnTop")
                if (recreateKeys.includes(key)) {
                    send(OUTPUT, ["CREATE"], { id: outputId, ...out })
                } else if (key === "alwaysOnTop") {
                    send(OUTPUT, ["SET_VALUE"], { id: outputId, key, value })
                }
            }

            return a
        })

        async function enableOutput(out: Output) {
            if (out.rtmp) await checkFFmpeg()
            send(OUTPUT, ["CREATE"], { ...out, id: outputId })
            AudioAnalyser.recorderActivate()
        }
    }

    // ndi
    function updateNdiData(e: unknown, key: string) {
        const id = readCurrent()?.id
        if (!id) return

        let newData = get(outputs)[id]?.ndiData
        if (!newData) newData = {}

        const value = detailId(e)

        newData[key] = value

        updateOutput("ndiData", newData)

        send(NDI, ["NDI_DATA"], { id, ...newData })

        if (key === "name" || key === "groups") {
            alertMessage.set("settings.restart_for_change")
            activePopup.set("alert")
            saved.set(false)
        }
    }

    // omt
    function updateOmtData(e: unknown, key: string) {
        const id = readCurrent()?.id
        if (!id) return

        let newData = get(outputs)[id]?.omtData
        if (!newData) newData = {}

        const value = detailId(e)

        newData[key] = value

        updateOutput("omtData", newData)

        send(OMT, ["OMT_DATA"], { id, ...newData })
    }

    // webrtc
    function updateWebrtcData(e: unknown, key: string) {
        const id = readCurrent()?.id
        if (!id) return

        const value = detailId(e)
        const updated = updateOutputWebrtcData(id, key, value)
        if (!updated) return

        saved.set(false)
    }

    // RTMP

    function updateRtmpData(value: unknown, key: string) {
        const id = readCurrent()?.id
        if (!id) return
        updateOutputRtmpData(id, key, value)

        saved.set(false)
    }

    // RTMP encoder

    async function loadEncoders(force = false) {
        const detection = await requestMain(Main.ENCODER_DETECT, { force })
        const encoders = (detection?.encoders || []).sort((a, b) => a.label.localeCompare(b.label)).sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1))
        const recommended = encoders.find((e) => e.id === detection?.recommended)
        setEncoderOptions([{ value: "auto", label: "Auto", data: recommended?.label || "" }, ...encoders.map((e) => ({ value: e.id, label: e.label, data: e.available ? "" : e.reason, disabled: !e.available }))])
    }

    // RTMP destinations

    function addDestination() {
        const id = readCurrent()?.id
        if (id) addRtmpDestination(id)
    }
    function updateDestination(destinationId: string, key: keyof RtmpDestination, value: unknown) {
        const id = readCurrent()?.id
        if (id) updateRtmpDestination(id, destinationId, key, value)
    }
    function removeDestination(destinationId: string) {
        const id = readCurrent()?.id
        if (id) removeRtmpDestination(id, destinationId)
    }

    // blackmagic
    function updateBlackmagicData(e: unknown, key: string) {
        const id = readCurrent()?.id
        if (!id) return

        let newData = get(outputs)[id]?.blackmagicData
        if (!newData) newData = {}
        const value = detailIdOrName(e)

        if (key === "deviceId") {
            const usedIds = getUsedBlackmagicDeviceIds(get(outputs), id)
            if (usedIds.includes(String(value))) {
                newToast("Device already in use by another output.")
                return
            }
        }

        newData[key] = value

        updateOutput("blackmagicData", newData)

        // wait for current value to update
        setTimeout(() => {
            if (key === "deviceId") {
                const device = devicesRef.current.find((a) => a.id === value)
                if (!device) return

                const displayModes: BlackmagicDisplayMode[] = device.data?.displayModes || []
                updateBlackmagicData(displayModes, "displayModes")
                if (displayModes.length) {
                    // try setting to "preferred" modes, or set to first available
                    updateBlackmagicData(displayModes.find((a) => a.name === "1080i59.94" || a.name === "1080p29.97")?.name || displayModes[0]?.name, "displayMode")
                }
            } else if (key === "displayMode") {
                const device = devicesRef.current.find((a) => a.id === readCurrent()?.blackmagicData?.deviceId)
                if (!device) return

                const displayModes: BlackmagicDisplayMode[] = device.data?.displayModes || []
                const modeData: BlackmagicDisplayMode | undefined = displayModes.find((a) => a.name === value)
                if (!modeData?.width) return

                // pixel format
                const pixelFormats = (modeData.videoModes || []).map((format) => ({ name: format }))
                updateBlackmagicData(pixelFormats, "pixelFormats")
                updateBlackmagicData(pixelFormats[0]?.name, "pixelFormat")

                // force resolution & update framerate
                updateOutput("forcedResolution", { width: modeData.width, height: modeData.height })
                updateBlackmagicData(modeData.frameRate, "framerate")

                // allow data to update first
                setTimeout(() => {
                    if (newData.displayMode && newData.pixelFormat) send(OUTPUT, ["SET_VALUE"], { id: readCurrent()?.id, key: "blackmagic", value: readCurrent() })
                })
            } else if (key === "pixelFormat" || key === "alphaKey" || key === "sdr") {
                if (key === "alphaKey") updateOutput("transparent", value)
                setTimeout(() => {
                    if (newData.displayMode && newData.pixelFormat) send(OUTPUT, ["SET_VALUE"], { id: readCurrent()?.id, key: "blackmagic", value: readCurrent() })
                })
            }

            saved.set(false)
        })
    }

    // RECEIVE BLACKMAGIC DEVICES: el listener se registra una vez y llama siempre a la versión vigente de los handlers
    const latest = useRef({ updateBlackmagicData })
    useEffect(() => {
        latest.current = { updateBlackmagicData }
    })
    useEffect(() => {
        const listenerId = uid()
        receive(
            BLACKMAGIC,
            {
                GET_DEVICES: (data: string) => {
                    const parsedData: BlackmagicRawDevice[] = JSON.parse(data)
                    const devices: Option[] = parsedData.map((a) => ({
                        id: a.deviceHandle,
                        name: a.displayName || a.modelName || "",
                        data: {
                            displayModes: a.outputDisplayModes || a.inputDisplayModes,
                            supportsInternalKeying: a.supportsInternalKeying || false,
                            supportsExternalKeying: a.supportsExternalKeying || false
                        }
                    }))
                    devicesRef.current = devices
                    setBlackmagicDevices(devices)
                    // auto-select first available device (not in use)
                    const current = readCurrent()
                    if (devices.length && (!current?.blackmagicData?.deviceId || !current?.blackmagicData?.displayModes?.length)) {
                        const usedIds = getUsedBlackmagicDeviceIds(get(outputs), current?.id)
                        const availableDevice = devices.find((d) => !usedIds.includes(String(d.id || "")))
                        if (availableDevice) latest.current.updateBlackmagicData({ detail: { id: availableDevice.id } }, "deviceId")
                    }
                }
            },
            listenerId
        )
        return () => destroy(BLACKMAGIC, listenerId)
    }, [])

    // deps = outputs + id (estables entre renders): `currentOutput` se clona en cada render y re-dispararía el IPC con cada tick de rtmpStatus
    useEffect(() => {
        if (currentOutput?.blackmagic) send(BLACKMAGIC, ["GET_DEVICES"])
    }, [outputsValue, currentId])

    useEffect(() => {
        if (currentOutput?.rtmp && encoderOptions.length === 1) loadEncoders()
    }, [outputsValue, currentId, encoderOptions])

    useEffect(() => {
        if (currentOutput?.rtmp && !currentOutput?.rtmpData?.destinations?.length) addDestination()
    }, [outputsValue, currentId])

    // Check if alpha keying is supported by the device
    function isAlphaSupported(): boolean {
        const device = blackmagicDevices.find((a) => a.id === currentOutput?.blackmagicData?.deviceId)
        if (!device) return false
        return device.data?.supportsInternalKeying || device.data?.supportsExternalKeying || false
    }

    const usedBlackmagicIds = getUsedBlackmagicDeviceIds(outputsValue, currentOutput?.id)
    const destinations: RtmpDestination[] = currentOutput?.rtmpData?.destinations || []

    return (
        <>
            {currentOutput?.blackmagic ? (
                <>
                    <Title label="Blackmagic Design" icon="blackmagic" />

                    <SelectField
                        label="settings.device"
                        value={currentOutput?.blackmagicData?.deviceId || ""}
                        options={blackmagicDevices.map((device): SelectOption => {
                            const inUse = usedBlackmagicIds.includes(String(device.id || ""))
                            return { label: inUse ? `${device.name} (in use)` : device.name, value: device.id ? String(device.id) : "", disabled: usedBlackmagicIds.includes(String(device.id)) }
                        })}
                        onChange={(value) => updateBlackmagicData(value, "deviceId")}
                    />

                    {currentOutput?.blackmagicData?.deviceId ? (
                        <>
                            <InputRow>
                                <SelectField label="settings.display_mode" value={currentOutput.blackmagicData?.displayMode} options={currentOutput.blackmagicData?.displayModes?.map((mode: { name: string }) => ({ label: mode.name, value: mode.name })) || []} onChange={(value) => updateBlackmagicData(value, "displayMode")} />
                                <SelectField label="settings.pixel_format" value={currentOutput.blackmagicData?.pixelFormat} options={currentOutput.blackmagicData?.pixelFormats?.map((format: { name: string }) => ({ label: format.name, value: format.name })) || []} onChange={(value) => updateBlackmagicData(value, "pixelFormat")} />
                            </InputRow>

                            {currentOutput.blackmagicData?.pixelFormat?.includes("YUV") ? <ToggleField label="SDR" title="SDR Encoding (Rec. 709)" checked={currentOutput.blackmagicData?.sdr !== false} defaultValue={true} onChange={(checked) => updateBlackmagicData(checked, "sdr")} /> : null}

                            {isAlphaSupported() ? <ToggleField label="settings.alpha_key" checked={currentOutput.blackmagicData?.alphaKey} onChange={(checked) => updateBlackmagicData(checked, "alphaKey")} /> : null}
                        </>
                    ) : null}
                </>
            ) : null}

            {currentOutput?.ndi ? (
                <>
                    <Title label="NDI®" icon="ndi" />

                    <InputRow>
                        <SelectField label="settings.frame_rate" value={currentOutput.ndiData?.framerate || "30"} defaultValue="30" options={framerates} onChange={(value) => updateNdiData(value, "framerate")} />
                    </InputRow>

                    <InputRow>
                        <TextField label="inputs.name" value={currentOutput.ndiData?.name || `PulseFlow NDI${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} defaultValue={`PulseFlow NDI${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} onChange={(value) => updateNdiData(value, "name")} />
                        <TextField label="inputs.group" title="settings.comma_seperated" value={currentOutput.ndiData?.groups || ""} defaultValue="" placeholder="public" onChange={(value) => updateNdiData(value, "groups")} />
                    </InputRow>

                    <ToggleField label="settings.transparent" checked={currentOutput.transparent} defaultValue={true} onChange={(checked) => updateOutput("transparent", checked)} />
                </>
            ) : null}

            {currentOutput?.omt ? (
                <>
                    <Title label="OMT" icon="omt" />

                    <InputRow>
                        <SelectField label="settings.frame_rate" value={currentOutput.omtData?.framerate || "30"} defaultValue="30" options={framerates} onChange={(value) => updateOmtData(value, "framerate")} />
                    </InputRow>

                    <InputRow>
                        <TextField label="inputs.name" value={currentOutput.omtData?.name || `PulseFlow OMT${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} defaultValue={`PulseFlow OMT${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} onChange={(value) => updateOmtData(value, "name")} />
                        <SelectField label="settings.quality" value={currentOutput.omtData?.quality || "Default"} defaultValue="Default" options={omtQualities} onChange={(value) => updateOmtData(value, "quality")} />
                    </InputRow>

                    <ToggleField label="settings.transparent" checked={currentOutput.transparent} defaultValue={true} onChange={(checked) => updateOutput("transparent", checked)} />
                </>
            ) : null}

            {currentOutput?.webrtc ? (
                <>
                    <Title label="WebRTC" icon="broadcast" />

                    <InputRow>
                        <SelectField label="settings.frame_rate" value={currentOutput.webrtcData?.fps?.toString() || "30"} defaultValue="30" options={framerates} onChange={(value) => updateWebrtcData(value, "fps")} />
                        <TextField label="Bitrate (kbps)" value={currentOutput.webrtcData?.bitrate?.toString() || "4000"} defaultValue="4000" placeholder="4000" onChange={(value) => updateWebrtcData(value, "bitrate")} />
                    </InputRow>
                    <TextField label="WHIP Endpoint URL" value={currentOutput.webrtcData?.url || ""} placeholder="e.g. https://live.restream.io/whip/live/YOUR_KEY" onChange={(value) => updateWebrtcData(value, "url")} pasteBtn />
                    <TextField label="Bearer Token (Optional)" value={currentOutput.webrtcData?.token || ""} placeholder="Authorization token" onChange={(value) => updateWebrtcData(value, "token")} pasteBtn />

                    {currentOutput?.enabled && currentOutput?.webrtcData?.url ? (
                        <div style={{ paddingBottom: "10px" }}>
                            <Button variant="outline" icon={currentOutput.webrtcData?.streaming ? "stop" : "record"} style={streamStyle} className={cn(currentOutput.webrtcData?.streaming && styles.streaming)} onClick={() => (currentOutput?.webrtcData?.streaming ? stopStreaming(currentOutput.id, true) : startStreaming(currentOutput?.id))} white>
                                {translateText(currentOutput.webrtcData?.streaming ? "output.stop_streaming" : "output.start_streaming")}
                            </Button>
                        </div>
                    ) : null}
                </>
            ) : null}

            {currentOutput?.rtmp ? (
                <>
                    <Title label="RTMP" icon="broadcast" />

                    <InputRow>
                        <SelectField label="settings.frame_rate" value={currentOutput.rtmpData?.fps?.toString() || "30"} defaultValue="30" options={framerates} onChange={(value) => updateRtmpData(value, "fps")} />
                    </InputRow>

                    <InputRow>
                        <TextField label="settings.bitrate (kbps)" value={currentOutput.rtmpData?.bitrate?.toString() || "4000"} defaultValue="4000" placeholder="4000" onChange={(value) => updateRtmpData(value, "bitrate")} />
                        <SelectField label="actions.mode" value={currentOutput.rtmpData?.rateControl || "cbr"} options={rateControlOptions} onChange={(value) => updateRtmpData(value, "rateControl")} />
                    </InputRow>

                    <InputRow style={{ marginBottom: "10px" }}>
                        <SelectField label="settings.video_encoder" value={currentOutput.rtmpData?.encoder || "auto"} defaultValue="auto" options={encoderOptions} onChange={(value) => updateRtmpData(value, "encoder")} />
                    </InputRow>

                    <div className={styles.destinations}>
                        {destinations.map((destination) => {
                            const status = rtmpStatusValue[currentOutput?.id || ""]?.[destination.id]

                            return (
                                <div key={destination.id} className={styles.destination}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "4px", textTransform: "uppercase" }}>
                                        <span className={cn(styles.dot, styles[status?.state || "idle"])} data-title={status?.error || status?.state || "idle"}></span>
                                        <div style={{ fontSize: "0.8em", opacity: 0.5 }}>{extractPlatformName(destination.url) || ""}</div>
                                    </div>

                                    {destinations.length > 1 || destination.enabled === false ? (
                                        <InputRow>
                                            <CheckboxField label="settings.enabled" checked={destination.enabled} defaultValue={true} style={{ flex: 1 }} onChange={(checked) => updateDestination(destination.id, "enabled", checked)} />
                                            {!destination.enabled || !destination.url ? <Button variant="outline" icon="delete" title="settings.remove" onClick={() => removeDestination(destination.id)} red /> : null}
                                        </InputRow>
                                    ) : null}

                                    <TextField label="Stream URL" value={destination.url} placeholder="e.g. rtmp://a.rtmp.youtube.com/live2" onChange={(value) => updateDestination(destination.id, "url", value)} pasteBtn />
                                    <TextField label="Stream key" value={destination.key} type="password" onChange={(value) => updateDestination(destination.id, "key", value)} pasteBtn />

                                    {/* kept visible after recovery: a destination that reconnects repeatedly still looks "live" between drops, so the count is the only signal that it is struggling */}
                                    {status?.restarts ? (
                                        <div className={styles["destination-warning"]}>
                                            {status.restarts === 1 ? "Reconnected once" : `Reconnected ${status.restarts} times`}
                                            {status.lastIssue && !status.error ? ` — ${status.lastIssue}` : ""}
                                        </div>
                                    ) : null}
                                    {status?.error ? <div className={styles["destination-error"]}>{status.error}</div> : null}
                                </div>
                            )
                        })}

                        <Button variant="outline" icon="add" disabled={destinations.some((a) => !a.url)} onClick={() => addDestination()}>
                            {translateText("settings.add_destination")}
                        </Button>
                    </div>

                    {currentOutput?.enabled && hasStreamableDestination(currentOutput.rtmpData) ? (
                        <div style={{ padding: "10px 0" }}>
                            <Button variant="outline" icon={currentOutput.rtmpData?.streaming ? "stop" : "record"} style={streamStyle} className={cn(currentOutput.rtmpData?.streaming && styles.streaming)} onClick={() => (currentOutput?.rtmpData?.streaming ? stopRtmpStreaming(currentOutput.id, true) : startRtmpStreaming(currentOutput?.id))} white>
                                {translateText(currentOutput.rtmpData?.streaming ? "output.stop_streaming" : "output.start_streaming")}
                            </Button>
                        </div>
                    ) : null}
                </>
            ) : null}
        </>
    )
}

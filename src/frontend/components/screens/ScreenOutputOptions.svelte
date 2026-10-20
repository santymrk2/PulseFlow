<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { BLACKMAGIC, NDI, OMT, OUTPUT } from "../../../types/Channels"
    import { Main } from "../../../types/IPC/Main"
    import type { Option } from "../../../types/Main"
    import type { Output, RtmpDestination } from "../../../types/Output"
    import { AudioAnalyser } from "../../audio/audioAnalyser"
    import { requestMain } from "../../IPC/main"
    import { activePopup, alertMessage, currentOutputSettings, ndiData, omtData, os, outputs, rtmpStatus, saved } from "../../stores"
    import { newToast } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import { destroy, receive, send } from "../../utils/request"
    import { clone } from "../helpers/array"
    import { addRtmpDestination, checkFFmpeg, refreshOut, removeRtmpDestination, startRtmpStreaming, startStreaming, stopRtmpStreaming, stopStreaming, updateOutputRtmpData, updateOutputWebrtcData, updateRtmpDestination } from "../helpers/output"
    import { hasStreamableDestination } from "../helpers/rtmpDestinations"
    import InputRow from "../input/InputRow.svelte"
    import Title from "../input/Title.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"
    import CheckboxField from "../../lib/components/ui/checkbox-field/checkbox-field.svelte"
    import SelectField from "../../lib/components/ui/select-field/select-field.svelte"
    import TextField from "../../lib/components/ui/text-field/text-field.svelte"
    import ToggleField from "../../lib/components/ui/toggle-field/toggle-field.svelte"

    let currentOutput: Output | null = null
    $: if ($currentOutputSettings) currentOutput = clone({ id: $currentOutputSettings, ...$outputs[$currentOutputSettings] })

    $: if (currentOutput?.blackmagic) send(BLACKMAGIC, ["GET_DEVICES"])

    function updateOutput(key: string, value: any, outputId = "") {
        if (!outputId) outputId = currentOutput?.id || ""
        if (!outputId || !$outputs[outputId]) return

        if (key === "style") setTimeout(refreshOut)

        outputs.update((a: any) => {
            const out = a[outputId]
            if (!out) return a

            // Update value
            if (key.includes(".")) {
                let [p1, p2] = key.split(".")
                out[p1][p2] = value
                if (p2 === "lines" && !Number(value)) delete out[p1][p2]
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
                if ($os.platform === "darwin") recreateKeys.push("alwaysOnTop")
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
    function updateNdiData(e: any, key: string) {
        let id = currentOutput?.id
        if (!id) return

        let newData = $outputs[id]?.ndiData
        if (!newData) newData = {}

        let value = e?.detail?.id ?? e

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
    const omtQualities = [
        { value: "Default", label: translateText("settings.auto") },
        { value: "Low", label: "Low (least bandwidth)" },
        { value: "Medium", label: "Medium" },
        { value: "High", label: "High (most bandwidth)" }
    ]
    function updateOmtData(e: any, key: string) {
        let id = currentOutput?.id
        if (!id) return

        let newData = $outputs[id]?.omtData
        if (!newData) newData = {}

        let value = e?.detail?.id ?? e

        newData[key] = value

        updateOutput("omtData", newData)

        send(OMT, ["OMT_DATA"], { id, ...newData })
    }

    // webrtc
    function updateWebrtcData(e: any, key: string) {
        let id = currentOutput?.id
        if (!id) return

        let value = e?.detail?.id ?? e
        const updated = updateOutputWebrtcData(id, key, value)
        if (!updated) return

        saved.set(false)
    }

    // RTMP

    function updateRtmpData(value: any, key: string) {
        if (!currentOutput?.id) return
        updateOutputRtmpData(currentOutput.id, key, value)

        saved.set(false)
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

    // RTMP encoder

    let encoderOptions: { value: string; label: string; data?: string; disabled?: boolean }[] = [{ value: "auto", label: "Auto" }]
    // let detectingEncoders = false
    async function loadEncoders(force = false) {
        // detectingEncoders = true
        try {
            const detection = await requestMain(Main.ENCODER_DETECT, { force })
            const encoders = (detection?.encoders || []).sort((a, b) => a.label.localeCompare(b.label)).sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1))
            // .filter((a) => a.available) // should we hide unavailable encoders?
            const recommended = encoders.find((e) => e.id === detection?.recommended)
            encoderOptions = [{ value: "auto", label: "Auto", data: recommended?.label || "" }, ...encoders.map((e) => ({ value: e.id, label: e.label, data: e.available ? "" : e.reason, disabled: !e.available }))]
        } finally {
            // detectingEncoders = false
        }
    }

    $: if (currentOutput?.rtmp && encoderOptions.length === 1) loadEncoders()
    $: if (currentOutput?.rtmp && !currentOutput?.rtmpData?.destinations?.length) addDestination()

    const rateControlOptions = [
        { value: "cbr", label: "CBR", data: "Constant Bitrate" },
        { value: "vbr", label: "VBR", data: "Variable Bitrate" }
    ]

    // RTMP destinations

    function addDestination() {
        if (currentOutput?.id) addRtmpDestination(currentOutput.id)
    }
    function updateDestination(destinationId: string, key: keyof RtmpDestination, value: any) {
        if (currentOutput?.id) updateRtmpDestination(currentOutput.id, destinationId, key, value)
    }
    function removeDestination(destinationId: string) {
        if (currentOutput?.id) removeRtmpDestination(currentOutput.id, destinationId)
    }

    // Frame rates

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

    // blackmagic
    let blackmagicDevices: Option[] = []
    function getUsedBlackmagicDeviceIds(excludeId = "") {
        return Object.entries($outputs)
            .filter(([id, o]: any) => id !== excludeId && o.blackmagic && o.blackmagicData?.deviceId)
            .map(([_id, o]: any) => String(o.blackmagicData.deviceId))
    }

    function updateBlackmagicData(e: any, key: string) {
        let id = currentOutput?.id
        if (!id) return

        let newData = $outputs[id]?.blackmagicData
        if (!newData) newData = {}
        let value = e?.detail?.id || e?.detail?.name || e

        if (key === "deviceId") {
            const usedIds = getUsedBlackmagicDeviceIds(id)
            if (usedIds.includes(String(value))) {
                newToast("Device already in use by another output.")
                return
            }
        }

        newData[key] = value

        updateOutput("blackmagicData", newData)
        // send(NDI, ["NDI_DATA"], { id, ...newData })

        // wait for current value to update
        setTimeout(() => {
            if (key === "deviceId") {
                let device = blackmagicDevices.find((a) => a.id === value)
                if (!device) return

                let displayModes = device.data?.displayModes || []
                updateBlackmagicData(displayModes, "displayModes")
                if (displayModes.length) {
                    // try setting to "preferred" modes, or set to first available
                    updateBlackmagicData(displayModes.find((a) => a.name === "1080i59.94" || a.name === "1080p29.97")?.name || displayModes[0]?.name, "displayMode")
                }
            } else if (key === "displayMode") {
                let device = blackmagicDevices.find((a) => a.id === currentOutput?.blackmagicData?.deviceId)
                if (!device) return

                let displayModes = device.data?.displayModes || []
                let modeData = displayModes.find((a) => a.name === value) || {}
                if (!modeData.width) return

                // pixel format
                let pixelFormats = (modeData.videoModes || []).map((format) => ({ name: format }))
                updateBlackmagicData(pixelFormats, "pixelFormats")
                updateBlackmagicData(pixelFormats[0]?.name, "pixelFormat")

                // force resolution & update framerate
                updateOutput("forcedResolution", { width: modeData.width, height: modeData.height })
                updateBlackmagicData(modeData.frameRate, "framerate")
                // updateBlackmagicData(modeData.videoModes, "pixelFormats")

                // allow data to update first
                setTimeout(() => {
                    if (newData.displayMode && newData.pixelFormat) send(OUTPUT, ["SET_VALUE"], { id: currentOutput?.id, key: "blackmagic", value: currentOutput })
                })
            } else if (key === "pixelFormat" || key === "alphaKey" || key === "sdr") {
                if (key === "alphaKey") updateOutput("transparent", value)
                setTimeout(() => {
                    if (newData.displayMode && newData.pixelFormat) send(OUTPUT, ["SET_VALUE"], { id: currentOutput?.id, key: "blackmagic", value: currentOutput })
                })
            }

            saved.set(false)
        })
    }

    // RECEIVE BLACKMAGIC DEVICES

    let listenerId = uid()
    onDestroy(() => destroy(BLACKMAGIC, listenerId))
    const receiveBMD = {
        GET_DEVICES: (data) => {
            const parsedData = JSON.parse(data)
            blackmagicDevices = parsedData.map((a) => ({
                id: a.deviceHandle,
                name: a.displayName || a.modelName,
                data: {
                    displayModes: a.outputDisplayModes || a.inputDisplayModes,
                    supportsInternalKeying: a.supportsInternalKeying || false,
                    supportsExternalKeying: a.supportsExternalKeying || false
                }
            }))
            // auto-select first available device (not in use)
            if (blackmagicDevices.length && (!currentOutput?.blackmagicData?.deviceId || !currentOutput?.blackmagicData?.displayModes?.length)) {
                const usedIds = getUsedBlackmagicDeviceIds(currentOutput?.id)
                const availableDevice = blackmagicDevices.find((d) => !usedIds.includes(String(d.id || "")))
                if (availableDevice) updateBlackmagicData({ detail: { id: availableDevice.id } }, "deviceId")
            }
        }
    }
    receive(BLACKMAGIC, receiveBMD, listenerId)

    // Check if alpha keying is supported by the device
    function isAlphaSupported(): boolean {
        const device = blackmagicDevices.find((a) => a.id === currentOutput?.blackmagicData?.deviceId)
        if (!device) return false
        return device.data?.supportsInternalKeying || device.data?.supportsExternalKeying || false
    }
</script>

{#if currentOutput?.blackmagic}
    <Title label="Blackmagic Design" icon="blackmagic" />

    <SelectField
        label="settings.device"
        value={currentOutput?.blackmagicData?.deviceId || ""}
        options={(() => {
            const usedIds = getUsedBlackmagicDeviceIds(currentOutput?.id)
            return blackmagicDevices.map((device) => ({
                label: usedIds.includes(String(device.id || "")) ? `${device.name} (in use)` : device.name,
                value: device.id ? String(device.id) : "",
                disabled: usedIds.includes(String(device.id))
            }))
        })()}
        on:change={(e) => updateBlackmagicData(e.detail, "deviceId")}
    />

    {#if currentOutput?.blackmagicData?.deviceId}
        <InputRow>
            <SelectField label="settings.display_mode" value={currentOutput.blackmagicData?.displayMode} options={currentOutput.blackmagicData?.displayModes?.map((mode) => ({ label: mode.name, value: mode.name })) || []} on:change={(e) => updateBlackmagicData(e.detail, "displayMode")} />
            <SelectField label="settings.pixel_format" value={currentOutput.blackmagicData?.pixelFormat} options={currentOutput.blackmagicData?.pixelFormats?.map((format) => ({ label: format.name, value: format.name })) || []} on:change={(e) => updateBlackmagicData(e.detail, "pixelFormat")} />
        </InputRow>

        {#if currentOutput.blackmagicData?.pixelFormat?.includes("YUV")}
            <ToggleField label="SDR" title="SDR Encoding (Rec. 709)" checked={currentOutput.blackmagicData?.sdr !== false} defaultValue={true} on:change={(e) => updateBlackmagicData(e.detail, "sdr")} />
        {/if}

        {#if isAlphaSupported()}
            <ToggleField label="settings.alpha_key" checked={currentOutput.blackmagicData?.alphaKey} on:change={(e) => updateBlackmagicData(e.detail, "alphaKey")} />
        {/if}
    {/if}
{/if}

{#if currentOutput?.ndi}
    <Title label="NDI®" icon="ndi" />

    <InputRow>
        <SelectField label="settings.frame_rate" value={currentOutput.ndiData?.framerate || "30"} defaultValue="30" options={framerates} on:change={(e) => updateNdiData(e.detail, "framerate")} />
    </InputRow>

    <InputRow>
        <TextField label="inputs.name" value={currentOutput.ndiData?.name || `PulseFlow NDI${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} defaultValue={`PulseFlow NDI${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} on:change={(e) => updateNdiData(e.detail, "name")} />
        <TextField label="inputs.group" title="settings.comma_seperated" value={currentOutput.ndiData?.groups || ""} defaultValue="" placeholder="public" on:change={(e) => updateNdiData(e.detail, "groups")} />
    </InputRow>

    <!-- not sure if we need to toggle this off? -->
    <ToggleField label="settings.transparent" checked={currentOutput.transparent} defaultValue={true} on:change={(e) => updateOutput("transparent", e.detail)} />

    <!-- Connections count (connection status visible by blue indicator) -->
    <!-- {#if $ndiData[currentOutput?.id || ""]?.connections > 0}
        <div style="padding: 10px;font-size: 0.8em;opacity: 0.4;text-align: center;">
            {$ndiData[currentOutput?.id || ""].connections}
        </div>
    {/if} -->
{/if}

{#if currentOutput?.omt}
    <Title label="OMT" icon="omt" />

    <InputRow>
        <SelectField label="settings.frame_rate" value={currentOutput.omtData?.framerate || "30"} defaultValue="30" options={framerates} on:change={(e) => updateOmtData(e.detail, "framerate")} />
    </InputRow>

    <InputRow>
        <TextField label="inputs.name" value={currentOutput.omtData?.name || `PulseFlow OMT${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} defaultValue={`PulseFlow OMT${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} on:change={(e) => updateOmtData(e.detail, "name")} />
        <SelectField label="settings.quality" value={currentOutput.omtData?.quality || "Default"} defaultValue="Default" options={omtQualities} on:change={(e) => updateOmtData(e.detail, "quality")} />
    </InputRow>

    <ToggleField label="settings.transparent" checked={currentOutput.transparent} defaultValue={true} on:change={(e) => updateOutput("transparent", e.detail)} />
{/if}

{#if currentOutput?.webrtc}
    <Title label="WebRTC" icon="broadcast" />

    <InputRow>
        <SelectField label="settings.frame_rate" value={currentOutput.webrtcData?.fps?.toString() || "30"} defaultValue="30" options={framerates} on:change={(e) => updateWebrtcData(e.detail, "fps")} />
        <TextField label="Bitrate (kbps)" value={currentOutput.webrtcData?.bitrate?.toString() || "4000"} defaultValue="4000" placeholder="4000" on:change={(e) => updateWebrtcData(e.detail, "bitrate")} />
    </InputRow>
    <TextField label="WHIP Endpoint URL" value={currentOutput.webrtcData?.url || ""} placeholder="e.g. https://live.restream.io/whip/live/YOUR_KEY" on:change={(e) => updateWebrtcData(e.detail, "url")} pasteBtn />
    <TextField label="Bearer Token (Optional)" value={currentOutput.webrtcData?.token || ""} placeholder="Authorization token" on:change={(e) => updateWebrtcData(e.detail, "token")} pasteBtn />
    <!-- <ToggleField label="settings.transparent" checked={currentOutput.transparent} defaultValue={false} on:change={(e) => updateOutput("transparent", e.detail)} /> -->

    {#if currentOutput?.enabled && currentOutput?.webrtcData?.url}
        <div style="padding-bottom: 10px;">
            <Button variant="outline" icon={currentOutput.webrtcData?.streaming ? "stop" : "record"} style="width: 100%; justify-content: center; {currentOutput.webrtcData?.streaming ? 'background: #b60707 !important;' : ''}" on:click={() => (currentOutput?.webrtcData?.streaming ? stopStreaming(currentOutput.id, true) : startStreaming(currentOutput?.id))} white>
                {translateText(currentOutput.webrtcData?.streaming ? "output.stop_streaming" : "output.start_streaming")}
            </Button>
        </div>
    {/if}
{/if}

{#if currentOutput?.rtmp}
    <Title label="RTMP" icon="broadcast" />

    <InputRow>
        <SelectField label="settings.frame_rate" value={currentOutput.rtmpData?.fps?.toString() || "30"} defaultValue="30" options={framerates} on:change={(e) => updateRtmpData(e.detail, "fps")} />
    </InputRow>

    <InputRow>
        <TextField label="settings.bitrate (kbps)" value={currentOutput.rtmpData?.bitrate?.toString() || "4000"} defaultValue="4000" placeholder="4000" on:change={(e) => updateRtmpData(e.detail, "bitrate")} />
        <SelectField label="actions.mode" value={currentOutput.rtmpData?.rateControl || "cbr"} options={rateControlOptions} on:change={(e) => updateRtmpData(e.detail, "rateControl")} />
    </InputRow>

    <InputRow style="margin-bottom: 10px;">
        <SelectField label="settings.video_encoder" value={currentOutput.rtmpData?.encoder || "auto"} defaultValue="auto" options={encoderOptions} on:change={(e) => updateRtmpData(e.detail, "encoder")} />
        <!-- <Button variant="outline" icon="refresh" title="Re-detect encoders" disabled={detectingEncoders} on:click={() => loadEncoders(true)} /> -->
    </InputRow>

    <div class="destinations">
        {#each currentOutput.rtmpData?.destinations || [] as destination (destination.id)}
            {@const status = $rtmpStatus[currentOutput?.id || ""]?.[destination.id]}

            <div class="destination">
                <div style="display: flex;align-items: center;gap: 10px;padding-bottom: 4px;text-transform: uppercase;">
                    <span class="dot {status?.state || 'idle'}" data-title={status?.error || status?.state || "idle"}></span>
                    <div style="font-size: 0.8em; opacity: 0.5;">{extractPlatformName(destination.url) || ""}</div>
                </div>

                {#if (currentOutput.rtmpData?.destinations || []).length > 1 || destination.enabled === false}
                    <InputRow>
                        <CheckboxField label="settings.enabled" checked={destination.enabled} defaultValue={true} style="flex: 1;" on:change={(e) => updateDestination(destination.id, "enabled", e.detail)} />
                        {#if !destination.enabled || !destination.url}
                            <Button variant="outline" icon="delete" title="settings.remove" on:click={() => removeDestination(destination.id)} red />
                        {/if}
                    </InputRow>
                {/if}

                <TextField label="Stream URL" value={destination.url} placeholder="e.g. rtmp://a.rtmp.youtube.com/live2" on:change={(e) => updateDestination(destination.id, "url", e.detail)} pasteBtn />
                <TextField label="Stream key" value={destination.key} type="password" on:change={(e) => updateDestination(destination.id, "key", e.detail)} pasteBtn />

                <!-- kept visible after recovery: a destination that reconnects repeatedly still looks
                     "live" between drops, so the count is the only signal that it is struggling -->
                {#if status?.restarts}
                    <div class="destination-warning">
                        {status.restarts === 1 ? "Reconnected once" : `Reconnected ${status.restarts} times`}{status.lastIssue && !status.error ? ` — ${status.lastIssue}` : ""}
                    </div>
                {/if}
                {#if status?.error}
                    <div class="destination-error">{status.error}</div>
                {/if}
            </div>
        {/each}

        <Button variant="outline" icon="add" disabled={(currentOutput.rtmpData?.destinations || []).some((a) => !a.url)} on:click={() => addDestination()}>
            {translateText("settings.add_destination")}
        </Button>
    </div>

    {#if currentOutput?.enabled && hasStreamableDestination(currentOutput.rtmpData)}
        <div style="padding: 10px 0;">
            <Button variant="outline" icon={currentOutput.rtmpData?.streaming ? "stop" : "record"} style="width: 100%; justify-content: center; {currentOutput.rtmpData?.streaming ? 'background: #b60707 !important;' : ''}" on:click={() => (currentOutput?.rtmpData?.streaming ? stopRtmpStreaming(currentOutput.id, true) : startRtmpStreaming(currentOutput?.id))} white>
                {translateText(currentOutput.rtmpData?.streaming ? "output.stop_streaming" : "output.start_streaming")}
            </Button>
        </div>
    {/if}
{/if}

<style>
    .hint {
        padding: 0 10px 10px;
        font-size: 0.8em;
        opacity: 0.5;
    }

    /* Stream destinations */

    .destinations {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .destination {
        display: flex;
        flex-direction: column;

        padding: 8px;
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
    }

    .dot {
        flex-shrink: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #6b6b6b;
    }
    .dot.connecting,
    .dot.reconnecting {
        background-color: #e0a800;
    }
    .dot.live {
        background-color: var(--success);
    }
    .dot.error {
        background-color: #b60707;
    }

    .destination-warning {
        padding-top: 4px;
        font-size: 0.8em;
        color: #e0bc50;
    }
    .destination-error {
        padding-top: 4px;
        color: #ff8080;
        font-size: 0.8em;
    }
</style>

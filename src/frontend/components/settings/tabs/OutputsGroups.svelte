<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import type { Output } from "../../../../types/Output"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { checkPrimaryOutputRouting, createOutputAudioChannel } from "../../../audio/routing/audioRoutingInit"
    import { activeTriggerFunction, currentOutputSettings, os, outputs, popupData, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { waitForPopupData } from "../../../utils/popup"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { clone, keysToID, sortByName, sortObject } from "../../helpers/array"
    import { addOutput, checkFFmpeg, enableStageOutput, refreshOut } from "../../helpers/output"
    import HiddenInput from "../../inputs/HiddenInput.svelte"

    // prevent "resetting" rename if output changed while renaming
    $: updatedOutputs = $outputs
    let currentOutputs = clone($outputs)
    $: {
        let newOutputs = clone(updatedOutputs)
        Object.values(newOutputs).map((a) => {
            delete a.out
            return a
        })
        let currOutputs = clone(currentOutputs)
        Object.values(currOutputs).map((a) => {
            delete a.out
            return a
        })

        if (JSON.stringify(newOutputs) !== JSON.stringify(currOutputs)) {
            currentOutputs = clone(updatedOutputs)
        }
    }

    ///

    // F5.5: agrupar en "Audiencia" y "Stage"
    // normalizar los campos opcionales que usa el template (id/name), así el snippet no recibe `undefined`
    type OutputTabData = Output & { id: string; name: string }
    let audienceOutputs: OutputTabData[] = []
    let stageOutputs: OutputTabData[] = []
    $: audienceOutputs = sortByName(keysToID(currentOutputs).filter((a) => !a.stageOutput)).map((a) => ({ ...a, id: a.id || "", name: a.name || "" }))
    $: stageOutputs = sortByName(keysToID(currentOutputs).filter((a) => !!a.stageOutput)).map((a) => ({ ...a, id: a.id || "", name: a.name || "" }))

    let outputsList: (Output & { name: string })[] = []
    $: outputsList = sortObject(sortByName(keysToID(currentOutputs)), "stageOutput")

    $: if (outputsList.length && (!$currentOutputSettings || !currentOutputs[$currentOutputSettings])) currentOutputSettings.set(outputsList.find((a) => a.enabled)?.id || outputsList[0].id || "")

    let currentOutput: Output | null = null
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...currentOutputs[$currentOutputSettings] }

    // nombre de la salida para el indicador de monitor
    $: currentOutputName = (($currentOutputSettings && currentOutputs[$currentOutputSettings]?.name) || "") as string

    // monitor conectado a esta salida (NDI muestra las conexiones activas)
    $: monitorOutputs = $outputs[$currentOutputSettings || ""]?.ndiData?.connections || 0

    function updateOutput(key: string, value: any, outputId = currentOutput?.id || "") {
        if (!outputId || !$outputs[outputId]) return

        if (key === "style") setTimeout(refreshOut)

        outputs.update((a: any) => {
            const out = a[outputId]

            // Update value
            if (key.includes(".")) {
                const [p1, p2] = key.split(".")
                out[p1][p2] = value
                if (p2 === "lines" && !Number(value)) delete out[p1][p2]
            } else {
                out[key] = value
            }

            if (key === "enabled" && value) {
                send(OUTPUT, ["CREATE"], { ...out, id: outputId })
                // checkWindowCapture()
                AudioAnalyser.recorderActivate()
            }

            const captureTypeKeys = ["blackmagic", "ndi", "omt", "webrtc", "rtmp"]
            // macOS: always on top outputs are a different window type (panel)
            const macWindowType = key === "alwaysOnTop" && $os.platform === "darwin"
            if (out.enabled && (captureTypeKeys.includes(key) || key === "transparent" || key === "invisible" || macWindowType)) {
                if (value && captureTypeKeys.includes(key)) newToast("toast.output_capture_enabled")
                // Recreate window for options fixed at creation (see Outputs.svelte)
                send(OUTPUT, ["CREATE"], { id: outputId, ...out })
            } else if (out.enabled && key === "alwaysOnTop") {
                send(OUTPUT, ["SET_VALUE"], { id: outputId, key, value })
            }

            return a
        })
    }

    // CREATE

    $: if ($activeTriggerFunction === "create_output") createOutput()
    async function createOutput(e?: { detail?: { ctrl?: boolean; stage?: boolean } }) {
        const skipPopup = e?.detail?.ctrl

        // F5.5: crear un stage screen elige un layout de stage
        if (e?.detail?.stage) {
            const stageLayouts = sortByName(keysToID($stageShows))
            if (!stageLayouts.length) return

            const stageId = stageLayouts.length > 1 ? (await waitForPopupData("select_stage_layout")) || stageLayouts[0].id : stageLayouts[0].id
            if (!stageId) return

            const outputId = enableStageOutput({ stageOutput: stageId, name: $stageShows[stageId]?.name || "" })
            updateOutput("enabled", true, outputId)
            return
        }

        // input type (normal/stage)
        const stageLayouts = keysToID($stageShows)
        const type = stageLayouts.length && !skipPopup ? await waitForPopupData("choose_output_input") : "normal"
        if (!type) return

        // data (style/layout)
        let styleId = ""
        let stageId = ""
        if (type === "stage") {
            const sorted = sortByName(stageLayouts)
            const firstId = sorted[0]?.id || ""
            stageId = stageLayouts.length > 1 ? (await waitForPopupData("select_stage_layout")) || firstId : firstId
        } else if (Object.keys($styles).length && !skipPopup) {
            popupData.set({ outputId: currentOutput?.id, skip: true })
            styleId = await waitForPopupData("select_style")
        }

        // output type (local/network)
        let setup = { localType: "window", networkType: "" }
        if (!skipPopup) setup = (await waitForPopupData("choose_output_type")) || setup
        const { localType, networkType } = setup

        // FFmpeg check for RTMP
        if (networkType === "rtmp" && !(await checkFFmpeg())) return

        // create
        let outputId = ""
        if (type === "stage") {
            toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
            outputId = enableStageOutput({ stageOutput: stageId, name: $stageShows[stageId]?.name || "" })
        } else {
            let name = ""
            if (networkType && !localType) {
                if (networkType === "ndi") name = "NDI"
                else if (networkType === "omt") name = "OMT"
                else if (networkType === "webrtc") name = "WebRTC"
                else if (networkType === "rtmp") name = "RTMP"
            }

            outputId = addOutput(false, styleId, false, name)
        }

        // apply settings
        if (!skipPopup) {
            if (localType !== "window") {
                updateOutput("invisible", true, outputId)
                if (!localType && (networkType === "ndi" || networkType === "omt")) updateOutput("transparent", true, outputId)
            }

            if (localType === "blackmagic") updateOutput("blackmagic", true, outputId)
            if (networkType === "ndi") updateOutput("ndi", true, outputId)
            else if (networkType === "omt") updateOutput("omt", true, outputId)
            else if (networkType === "webrtc") updateOutput("webrtc", true, outputId)
            else if (networkType === "rtmp") updateOutput("rtmp", true, outputId)

            updateOutput("enabled", true, outputId)

            if (networkType) createOutputAudioChannel(outputId)
            else checkPrimaryOutputRouting()
        }
    }

    let edit: any
</script>

{#snippet outputTab(tab: OutputTabData)}
    <div class="output-tab context #output_screen" class:active={$currentOutputSettings === tab.id} on:click={() => currentOutputSettings.set(tab.id)} on:keydown={() => {}} role="tab" tabindex={0}>
        <HiddenInput value={tab.name} id={"output_" + tab.id} on:edit={(e) => updateOutput("name", e.detail.value, tab.id || "")} bind:edit />

        <div class="right-icons">
            {#if tab.stageOutput}<Icon id="stage" size={0.7} right title={translateText("menu.stage")} />{/if}
            {#if !tab.invisible}<Icon id="hdmi" size={0.6} white title={translateText("settings.window")} />{/if}
            {#if tab.blackmagic}<Icon id="blackmagic" size={0.6} white title="Blackmagic Design" />{/if}
            {#if tab.ndi}<Icon id="ndi" size={0.6} white title="NDI" />{/if}
            {#if tab.omt}<Icon id="omt" size={0.6} white title="OMT" />{/if}
            {#if tab.webrtc}<Icon id="broadcast" size={0.6} white title="WebRTC" />{/if}
            {#if tab.rtmp}<Icon id="broadcast" size={0.6} white title="RTMP" />{/if}
        </div>

        {#if tab.color}
            <div class="color" style="--color: {tab.color};"></div>
        {/if}
    </div>
{/snippet}

<div class="group-tabs">
    <h4>{translateText("looks.audience")}</h4>

    {#if audienceOutputs.length}
        {#each audienceOutputs as tab (tab.id)}
            {@render outputTab(tab)}
        {/each}
    {/if}

    <button class="add" on:click={() => createOutput()} title={translateText("settings.new_output")}>
        <Icon id="add" size={1.1} white={false} />
        {translateText("settings.new_output")}
    </button>
</div>

<div class="group-tabs">
    <h4>{translateText("menu.stage")}</h4>

    {#if stageOutputs.length}
        {#each stageOutputs as tab (tab.id)}
            {@render outputTab(tab)}
        {/each}
    {/if}

    <button class="add" on:click={() => createOutput({ detail: { stage: true } })} title={translateText("looks.create_stage_screen")}>
        <Icon id="add" size={1.1} white={false} />
        {translateText("looks.create_stage_screen")}
    </button>
</div>

{#if currentOutput}
    <div class="status">
        <span class="dot" class:live={currentOutput.enabled !== false}></span>
        {translateText(currentOutput.enabled !== false ? "looks.open" : "looks.closed")}

        <span class="monitor" title={translateText("looks.monitor")}>
            <Icon id={currentOutput.ndi ? "ndi" : "hdmi"} size={0.8} white={false} />
            {currentOutput.ndi ? monitorOutputs : currentOutputName || "—"}
        </span>
    </div>
{/if}

<style>
    .group-tabs {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 0 5px 10px;
    }

    .group-tabs h4 {
        margin: 6px 0 2px;
        padding-left: 6px;
        font-size: 0.8em;
        font-weight: 600;
        text-transform: uppercase;
        opacity: 0.5;
    }

    .output-tab {
        position: relative;

        display: flex;
        align-items: center;

        height: 40px;
        padding: 0 8px 0 14px;
        border-radius: var(--radius, 10px);

        cursor: pointer;
        transition: background-color 0.12s ease;
        overflow: hidden;
    }
    .output-tab:hover {
        background-color: var(--hover, var(--primary-lighter));
    }
    .output-tab.active {
        background-color: var(--primary-darker);
    }

    .right-icons {
        display: flex;
        gap: 2px;
        margin-left: auto;
        padding-left: 8px;
        opacity: 0.7;
    }

    .output-tab :global(.color) {
        position: absolute;
        left: 14px;
        bottom: 5px;

        width: calc(100% - 28px);
        height: 2px;

        background-color: var(--color);
    }

    .add {
        display: flex;
        align-items: center;
        gap: 6px;

        margin: 4px 0 0;
        padding: 8px 12px;

        background-color: transparent;
        color: inherit;
        font-family: inherit;
        font-size: 0.85em;
        text-align: left;

        border: 1px dashed var(--primary-lighter);
        border-radius: var(--radius, 10px);
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.12s ease;
    }
    .add:hover {
        opacity: 1;
    }

    .status {
        display: flex;
        align-items: center;
        gap: 8px;

        padding: 6px 12px;
        font-size: 0.8em;
        opacity: 0.6;
    }

    .status .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #6b6b6b;
    }
    .status .dot.live {
        background-color: #2ecc71;
    }

    .monitor {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: auto;
    }
</style>

<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { OUTPUT } from "../../../types/Channels"
    import { activePage, activePopup, activeStage, currentOutputSettings, dictionary, outputs, stageShows } from "../../stores"
    import { send } from "../../utils/request"
    import { translateText } from "../../utils/language"
    import { toggleOutputs } from "../helpers/output"
    import { clone } from "../helpers/array"
    import DisplayLayout from "./DisplayLayout.svelte"
    import ScreenOutputOptions from "./ScreenOutputOptions.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"
    import MaterialColorInput from "../inputs/MaterialColorInput.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import MaterialPopupButton from "../inputs/MaterialPopupButton.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"

    export let outputId: string
    export let displays: any[] = []

    const dispatch = createEventDispatcher()

    $: currentOutput = $outputs[outputId] || {}
    $: isStage = !!currentOutput.stageOutput || currentOutput.kind === "stage"
    $: stageId = currentOutput.stageLayout || currentOutput.stageOutput || ""
    $: typeOptions = [
        { value: "single", label: translateText("screen_config.single", $dictionary) },
        { value: "mirror", label: translateText("screen_config.mirror", $dictionary) },
        { value: "edge_blend", label: translateText("screen_config.edge_blend", $dictionary) }
    ]
    $: targetOptions = [
        { value: "full", label: translateText("screen_config.full", $dictionary) },
        { value: "custom", label: translateText("screen_config.custom", $dictionary) }
    ]
    $: screenOptions = [{ value: "", label: translateText("screen_config.none", $dictionary) }, ...displays.map((d) => ({ value: d.id?.toString() || d.label, label: String(d.label || d.id) }))]
    $: mirrorOptions = [
        { value: "", label: translateText("screen_config.choose", $dictionary) },
        ...Object.entries($outputs)
            .filter(([id, o]) => id !== outputId && !(o.stageOutput || o.kind === "stage"))
            .map(([id, o]) => ({ value: id, label: o.name || id }))
    ]
    $: if (outputId && $currentOutputSettings !== outputId) currentOutputSettings.set(outputId)

    function setStageLayout(id: string) {
        outputs.update((a) => {
            if (a[outputId]) {
                a[outputId].stageLayout = id
                a[outputId].stageOutput = id
            }
            return a
        })
    }
    function editStage() {
        activeStage.set({ id: stageId, items: [] })
        activePage.set("stage")
        activePopup.set(null)
    }

    function setOutputValue(key: string, value: any) {
        outputs.update((a) => {
            if (a[outputId]) (a[outputId] as any)[key] = value
            return a
        })
    }
    function setForcedResolution(side: "width" | "height", value: number) {
        outputs.update((a) => {
            const out = a[outputId]
            if (!out) return a
            const res = { width: out.forcedResolution?.width || 0, height: out.forcedResolution?.height || 0, [side]: Number(value) || 0 }
            if (!res.width || !res.height) delete out.forcedResolution
            else out.forcedResolution = res
            return a
        })
    }

    let activeTab = "hardware"

    function rename(e: any) {
        outputs.update((a) => {
            if (a[outputId]) a[outputId].name = e.target.value
            return a
        })
    }

    function toggleAlwaysOnTop(e: any) {
        outputs.update((a) => {
            if (a[outputId]) a[outputId].alwaysOnTop = e.detail
            return a
        })
    }

    function setScreen(e: any) {
        const disp = e.detail
        outputs.update((a) => {
            if (!a[outputId]) return a
            a[outputId].screen = disp.id?.toString() || null
            a[outputId].bounds = { x: disp.bounds.x, y: disp.bounds.y, width: disp.bounds.width, height: disp.bounds.height }
            a[outputId].display = { ...(a[outputId].display || {}), screen: a[outputId].screen, bounds: a[outputId].bounds }
            return a
        })
        setTimeout(() => {
            toggleOutputs([outputId], { state: true })
            send(OUTPUT, ["UPDATE_BOUNDS"], { id: outputId, ...currentOutput })
        }, 50)
    }

    function setOutputScreen(val: string) {
        const disp = displays.find((d) => d.id?.toString() === val || d.label === val)
        if (disp) setScreen({ detail: disp })
        else
            outputs.update((a) => {
                const o = a[outputId]
                if (o) {
                    o.screen = val || null
                    if (o.display) o.display.screen = o.screen
                }
                return a
            })
    }

    function setBounds(key: "x" | "y" | "width" | "height", value: number) {
        outputs.update((a) => {
            if (a[outputId]) a[outputId].bounds[key] = Number(value)
            return a
        })
    }

    function toggleEnabled() {
        toggleOutputs([outputId], { state: !(currentOutput.enabled && currentOutput.active) })
    }

    // cropping
    let cropping: any = {}
    $: cropping = clone(currentOutput.cropping || {})
    function updateCropping(value: string | number, side: string) {
        outputs.update((a) => {
            if (!a[outputId]) return a
            if (!a[outputId].cropping) a[outputId].cropping = { top: 0, right: 0, bottom: 0, left: 0 }
            a[outputId].cropping![side] = Number(value)
            return a
        })
    }

    // aspect ratio (stored on output as aspectRatio like spec)
    $: aspectOptions = [
        { value: "", label: translateText("screen_config.original", $dictionary) },
        { value: "16:9", label: "16:9" },
        { value: "4:3", label: "4:3" },
        { value: "16:10", label: "16:10" },
        { value: "9:16", label: "9:16" }
    ]
    $: aspectValue = currentOutput.aspectRatio ? `${currentOutput.aspectRatio.width}:${currentOutput.aspectRatio.height}` : ""
    function setAspectRatio(val: string) {
        outputs.update((a) => {
            if (!a[outputId]) return a
            if (val === "") delete a[outputId].aspectRatio
            else a[outputId].aspectRatio = { width: Number(val.split(":")[0]) || 16, height: Number(val.split(":")[1]) || 9 }
            return a
        })
    }

    // edge blend
    let blending: any = {}
    $: blending = currentOutput.blending || {}
    function updateBlending(value: string | number, side: string) {
        outputs.update((a) => {
            if (!a[outputId]) return a
            if (!a[outputId].blending) a[outputId].blending = { left: 0, right: 0, rotate: 90, opacity: 50, centered: false, offset: 0 }
            a[outputId].blending![side] = Number(value)
            return a
        })
    }
</script>

<div class="header">
    <input class="name-input" value={currentOutput.name || ""} on:change={rename} />
    <div class="res">{currentOutput.bounds?.width || 0} × {currentOutput.bounds?.height || 0}</div>
    <MaterialToggleSwitch label="settings.always_on_top" checked={currentOutput.alwaysOnTop !== false} defaultValue={true} on:change={toggleAlwaysOnTop} />
</div>

{#if !isStage}
    <div class="row">
        <MaterialDropdown label="screen_config.type" value={currentOutput.screenType || "single"} options={typeOptions} on:change={(e) => setOutputValue("screenType", e.detail)} />
    </div>
    {#if currentOutput.screenType === "mirror"}
        <div class="row">
            <MaterialDropdown label="screen_config.mirror_of" value={currentOutput.mirrorOf || ""} options={mirrorOptions} on:change={(e) => setOutputValue("mirrorOf", e.detail || undefined)} />
        </div>
    {/if}
{:else}
    <div class="row">
        <MaterialPopupButton label="stage.stage_layout" value={stageId} name={$stageShows[stageId]?.name} icon="stage" popupId="select_stage_layout" on:change={(e) => setStageLayout(e.detail)} />
        {#if $stageShows[stageId]}
            <MaterialButton title="titlebar.edit" icon="edit" on:click={editStage} />
        {/if}
    </div>
{/if}

<div class="canvas">
    <div class="canvas-title">{translateText("screen_config.monitors")}</div>
    <DisplayLayout {displays} width={620} height={240} fill assignedId={currentOutput.screen || currentOutput.display?.screen || null} selectable={true} on:select={setScreen} />
    <div class="canvas-info">
        {#if currentOutput.screen}
            <span>Asignado: {currentOutput.screen}</span>
        {/if}
    </div>
</div>

<div class="tabs">
    <Button variant={activeTab === "hardware" ? "default" : "ghost"} size="sm" onclick={() => (activeTab = "hardware")}>{translateText("screen_config.hardware")}</Button>
    <Button variant={activeTab === "cropping" ? "default" : "ghost"} size="sm" onclick={() => (activeTab = "cropping")}>{translateText("screen_config.cropping")}</Button>
    <Button variant={activeTab === "sending" ? "default" : "ghost"} size="sm" onclick={() => (activeTab = "sending")}>{translateText("screen_config.sending")}</Button>
</div>

{#if activeTab === "hardware"}
    <div class="tab-panel">
        <div class="row">
            <MaterialDropdown label="screen_config.output" value={currentOutput.screen || currentOutput.display?.screen || ""} options={screenOptions} on:change={(e) => setOutputScreen(e.detail)} />
        </div>
        <div class="row">
            <MaterialDropdown label="screen_config.target" value={currentOutput.target || "full"} options={targetOptions} on:change={(e) => setOutputValue("target", e.detail)} />
        </div>
        {#if currentOutput.target === "custom"}
            <div class="row">
                <MaterialNumberInput label="X" value={currentOutput.bounds?.x || 0} min={null} on:change={(e) => setBounds("x", e.detail)} />
                <MaterialNumberInput label="Y" value={currentOutput.bounds?.y || 0} min={null} on:change={(e) => setBounds("y", e.detail)} />
                <MaterialNumberInput label="screen.width" value={currentOutput.bounds?.width || 0} on:change={(e) => setBounds("width", e.detail)} />
                <MaterialNumberInput label="screen.height" value={currentOutput.bounds?.height || 0} on:change={(e) => setBounds("height", e.detail)} />
            </div>
        {/if}
        <div class="info-box">
            <div>{translateText("screen_config.info_name")}: {currentOutput.name || outputId}</div>
            <div>{translateText("screen_config.info_size")}: {currentOutput.bounds?.width || 0} × {currentOutput.bounds?.height || 0}</div>
            <div>{translateText("screen_config.aspect_ratio")}: {((currentOutput.bounds?.width || 16) / (currentOutput.bounds?.height || 9)).toFixed(2)}{Math.abs((currentOutput.bounds?.width || 16) / (currentOutput.bounds?.height || 9) - 16 / 9) < 0.01 ? " (16:9)" : ""}</div>
        </div>
        <div class="actions">
            <MaterialButton on:click={() => dispatch("refreshDisplays")}>{translateText("screen_config.identify")}</MaterialButton>
            <MaterialButton on:click={toggleEnabled}>{translateText(currentOutput.enabled && currentOutput.active ? "screen_config.turn_off" : "screen_config.turn_on")}</MaterialButton>
        </div>
        <MaterialToggleSwitch label="settings.invisible_window" checked={!!currentOutput.invisible} defaultValue={false} on:change={(e) => setOutputValue("invisible", e.detail)} />
        <MaterialToggleSwitch label="settings.transparent" checked={!!currentOutput.transparent} defaultValue={false} on:change={(e) => setOutputValue("transparent", e.detail)} />
        <MaterialToggleSwitch label="context.hide_from_preview" checked={!!currentOutput.hideFromPreview} defaultValue={false} on:change={(e) => setOutputValue("hideFromPreview", e.detail)} />
        <MaterialColorInput label="edit.color" value={currentOutput.color || "#F0008C"} defaultValue="#F0008C" on:change={(e) => setOutputValue("color", e.detail)} />
        <div class="label">{translateText("settings.resolution")}</div>
        <MaterialNumberInput label="screen.width" value={currentOutput.forcedResolution?.width || 0} defaultValue={0} max={8192} on:change={(e) => setForcedResolution("width", e.detail)} />
        <MaterialNumberInput label="screen.height" value={currentOutput.forcedResolution?.height || 0} defaultValue={0} max={8192} on:change={(e) => setForcedResolution("height", e.detail)} />
    </div>
{:else if activeTab === "cropping"}
    <div class="tab-panel">
        {#if !isStage}
            <div class="row">
                <MaterialDropdown label="screen_config.aspect_ratio" value={aspectValue} options={aspectOptions} on:change={(e) => setAspectRatio(e.detail)} />
            </div>
        {/if}
        <div class="row">
            <div class="label">{translateText("screen_config.cropping")}</div>
            <div style="flex:1; display:flex; gap:4px;">
                <MaterialNumberInput label="screen_config.top" value={cropping.top || 0} on:change={(e) => updateCropping(e.detail, "top")} />
                <MaterialNumberInput label="screen_config.right" value={cropping.right || 0} on:change={(e) => updateCropping(e.detail, "right")} />
                <MaterialNumberInput label="screen_config.bottom" value={cropping.bottom || 0} on:change={(e) => updateCropping(e.detail, "bottom")} />
                <MaterialNumberInput label="screen_config.left" value={cropping.left || 0} on:change={(e) => updateCropping(e.detail, "left")} />
            </div>
        </div>
        {#if !isStage && currentOutput.screenType === "edge_blend"}
            <div class="row">
                <div class="label">Edge blend</div>
                <div style="flex:1; display:flex; gap:4px;">
                    <MaterialNumberInput label="screen_config.left" value={blending.left || 0} on:change={(e) => updateBlending(e.detail, "left")} />
                    <MaterialNumberInput label="screen_config.right" value={blending.right || 0} on:change={(e) => updateBlending(e.detail, "right")} />
                    <MaterialNumberInput label="screen_config.rotation" value={blending.rotate ?? 90} on:change={(e) => updateBlending(e.detail, "rotate")} />
                    <MaterialNumberInput label="screen_config.opacity" value={blending.opacity ?? 50} on:change={(e) => updateBlending(e.detail, "opacity")} />
                </div>
            </div>
        {/if}
    </div>
{:else if activeTab === "sending"}
    <div class="tab-panel scroll">
        <div class="section">
            <div class="section-title">NDI</div>
            <MaterialToggleSwitch
                label="NDI"
                checked={!!currentOutput.ndi}
                defaultValue={false}
                on:change={(e) =>
                    outputs.update((a) => {
                        if (a[outputId]) a[outputId].ndi = e.detail
                        return a
                    })}
            />
        </div>
        <div class="section">
            <div class="section-title">OMT</div>
            <MaterialToggleSwitch
                label="OMT"
                checked={!!currentOutput.omt}
                defaultValue={false}
                on:change={(e) =>
                    outputs.update((a) => {
                        if (a[outputId]) a[outputId].omt = e.detail
                        return a
                    })}
            />
        </div>
        <div class="section">
            <div class="section-title">Blackmagic</div>
            <MaterialToggleSwitch
                label="Blackmagic"
                checked={!!currentOutput.blackmagic}
                defaultValue={false}
                on:change={(e) =>
                    outputs.update((a) => {
                        if (a[outputId]) a[outputId].blackmagic = e.detail
                        return a
                    })}
            />
        </div>
        <div class="section">
            <div class="section-title">WebRTC</div>
            <MaterialToggleSwitch
                label="WebRTC"
                checked={!!currentOutput.webrtc}
                defaultValue={false}
                on:change={(e) =>
                    outputs.update((a) => {
                        if (a[outputId]) a[outputId].webrtc = e.detail
                        return a
                    })}
            />
        </div>
        <div class="section">
            <div class="section-title">RTMP</div>
            <MaterialToggleSwitch
                label="RTMP"
                checked={!!currentOutput.rtmp}
                defaultValue={false}
                on:change={(e) =>
                    outputs.update((a) => {
                        if (a[outputId]) a[outputId].rtmp = e.detail
                        return a
                    })}
            />
        </div>
        <ScreenOutputOptions />
    </div>
{/if}

<style>
    /* cabecera en una sola línea: el nombre se achica, la resolución y el estado no se cortan */
    .header {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        white-space: nowrap;
    }
    .name-input {
        background: transparent;
        border: 1px solid var(--border-color, var(--primary-lighter));
        color: var(--text);
        padding: 4px 6px;
        border-radius: var(--radius, 4px);
        flex: 1;
        min-width: 0;
    }
    .res {
        flex-shrink: 0;
        opacity: 0.7;
        font-size: 0.9em;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .label {
        width: 80px;
        opacity: 0.8;
        font-size: 0.9em;
    }
    .canvas {
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 4px);
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }
    .canvas-title {
        align-self: flex-start;
        opacity: 0.8;
        font-size: 0.9em;
    }
    .canvas-info {
        align-self: flex-start;
        opacity: 0.7;
        font-size: 0.8em;
    }
    /* pestañas: si no entran en el ancho, la tira scrollea sin cortar letras */
    .tabs {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        scrollbar-width: none;
    }
    .tab-panel {
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 4px);
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        min-height: 0;
        /* único scroll del detalle: el contenido de la pestaña */
        overflow-y: auto;
    }
    /* dos columnas de campos cuando hay ancho (>= ~640 px del modal); una si no */
    .tab-panel:has(> .row) {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        align-content: start;
    }
    .tab-panel > .info-box,
    .tab-panel > .actions,
    .tab-panel > .section {
        grid-column: 1 / -1;
    }
    .info-box {
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 4px);
        padding: 8px;
        font-size: 0.9em;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .actions {
        display: flex;
        gap: 6px;
        margin-top: auto;
    }
    .scroll {
        overflow: auto;
    }
    .section {
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 4px);
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .section-title {
        font-size: 0.9em;
        opacity: 0.8;
    }
</style>

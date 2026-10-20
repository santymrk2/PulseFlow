<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { OUTPUT } from "../../../types/Channels"
    import { activePage, activePopup, activeStage, currentOutputSettings, outputs, stageShows } from "../../stores"
    import { send } from "../../utils/request"
    import { toggleOutputs } from "../helpers/output"
    import { clone } from "../helpers/array"
    import DisplayLayout from "./DisplayLayout.svelte"
    import ScreenOutputOptions from "./ScreenOutputOptions.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialPopupButton from "../inputs/MaterialPopupButton.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"

    export let outputId: string
    export let displays: any[] = []

    const dispatch = createEventDispatcher()

    $: currentOutput = $outputs[outputId] || {}
    $: isStage = !!currentOutput.stageOutput || currentOutput.kind === "stage"
    $: stageId = currentOutput.stageLayout || currentOutput.stageOutput || ""
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
    function setAspectRatio(e: any) {
        const val = e.detail?.id || e.target?.value
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
        <div class="label">Tipo</div>
        <select
            class="select"
            value={currentOutput.screenType || "single"}
            on:change={(e) =>
                outputs.update((a) => {
                    if (a[outputId]) a[outputId].screenType = (e.target as HTMLSelectElement).value as any
                    return a
                })}
        >
            <option value="single">Única</option>
            <option value="mirror">Espejo</option>
            <option value="edge_blend">Edge blend</option>
        </select>
    </div>
    {#if currentOutput.screenType === "mirror"}
        <div class="row">
            <div class="label">Espejar de</div>
            <select
                class="select"
                value={currentOutput.mirrorOf || ""}
                on:change={(e) =>
                    outputs.update((a) => {
                        if (a[outputId]) a[outputId].mirrorOf = (e.target as HTMLSelectElement).value || undefined
                        return a
                    })}
            >
                <option value="">Elegir</option>
                {#each Object.entries($outputs) as [id, o]}
                    {#if id !== outputId && !(o.stageOutput || o.kind === "stage")}
                        <option value={id}>{o.name || id}</option>
                    {/if}
                {/each}
            </select>
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
    <div class="canvas-title">Monitores</div>
    <DisplayLayout {displays} width={620} height={320} assignedId={currentOutput.screen || currentOutput.display?.screen || null} selectable={true} on:select={setScreen} />
    <div class="canvas-info">
        {#if currentOutput.screen}
            <span>Asignado: {currentOutput.screen}</span>
        {/if}
    </div>
</div>

<div class="tabs">
    <button class="tab" class:active={activeTab === "hardware"} on:click={() => (activeTab = "hardware")}>Hardware</button>
    <button class="tab" class:active={activeTab === "cropping"} on:click={() => (activeTab = "cropping")}>Recorte</button>
    <button class="tab" class:active={activeTab === "sending"} on:click={() => (activeTab = "sending")}>Envío</button>
</div>

{#if activeTab === "hardware"}
    <div class="tab-panel">
        <div class="row">
            <div class="label">Salida</div>
            <select
                class="select"
                value={currentOutput.screen || currentOutput.display?.screen || ""}
                on:change={(e) => {
                    const val = (e.target as HTMLSelectElement).value
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
                }}
            >
                <option value="">Ninguna</option>
                {#each displays as d}
                    <option value={d.id?.toString() || d.label}>{d.label || d.id}</option>
                {/each}
            </select>
        </div>
        <div class="row">
            <div class="label">Destino</div>
            <select
                class="select"
                value={currentOutput.target || "full"}
                on:change={(e) =>
                    outputs.update((a) => {
                        if (a[outputId]) a[outputId].target = (e.target as HTMLSelectElement).value as any
                        return a
                    })}
            >
                <option value="full">Completo</option>
                <option value="custom">Personalizado</option>
            </select>
        </div>
        {#if currentOutput.target === "custom"}
            <div class="row">
                <div class="label">x,y,w,h</div>
                <input
                    class="input"
                    type="number"
                    value={currentOutput.bounds?.x || 0}
                    on:change={(e) =>
                        outputs.update((a) => {
                            if (a[outputId]) a[outputId].bounds.x = Number((e.target as HTMLInputElement).value)
                            return a
                        })}
                />
                <input
                    class="input"
                    type="number"
                    value={currentOutput.bounds?.y || 0}
                    on:change={(e) =>
                        outputs.update((a) => {
                            if (a[outputId]) a[outputId].bounds.y = Number((e.target as HTMLInputElement).value)
                            return a
                        })}
                />
                <input
                    class="input"
                    type="number"
                    value={currentOutput.bounds?.width || 0}
                    on:change={(e) =>
                        outputs.update((a) => {
                            if (a[outputId]) a[outputId].bounds.width = Number((e.target as HTMLInputElement).value)
                            return a
                        })}
                />
                <input
                    class="input"
                    type="number"
                    value={currentOutput.bounds?.height || 0}
                    on:change={(e) =>
                        outputs.update((a) => {
                            if (a[outputId]) a[outputId].bounds.height = Number((e.target as HTMLInputElement).value)
                            return a
                        })}
                />
            </div>
        {/if}
        <div class="info-box">
            <div>Nombre: {currentOutput.name || outputId}</div>
            <div>Tamaño: {currentOutput.bounds?.width || 0} × {currentOutput.bounds?.height || 0}</div>
            <div>Relación: {((currentOutput.bounds?.width || 16) / (currentOutput.bounds?.height || 9)).toFixed(2)}{Math.abs((currentOutput.bounds?.width || 16) / (currentOutput.bounds?.height || 9) - 16 / 9) < 0.01 ? " (16:9)" : ""}</div>
        </div>
        <div class="actions">
            <MaterialButton on:click={() => dispatch("refreshDisplays")}>Identificar pantallas</MaterialButton>
            <MaterialButton on:click={toggleEnabled}>{currentOutput.enabled && currentOutput.active ? "Apagar" : "Encender"}</MaterialButton>
        </div>
    </div>
{:else if activeTab === "cropping"}
    <div class="tab-panel">
        {#if !isStage}
            <div class="row">
                <div class="label">Relación</div>
                <select class="select" on:change={setAspectRatio}>
                    <option value="">Original</option>
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="16:10">16:10</option>
                    <option value="9:16">9:16</option>
                </select>
            </div>
        {/if}
        <div class="row">
            <div class="label">Recorte</div>
            <div style="flex:1; display:flex; gap:4px;">
                <input class="input" type="number" placeholder="T" value={cropping.top || 0} on:change={(e) => updateCropping((e.target as HTMLInputElement).value, "top")} />
                <input class="input" type="number" placeholder="R" value={cropping.right || 0} on:change={(e) => updateCropping((e.target as HTMLInputElement).value, "right")} />
                <input class="input" type="number" placeholder="B" value={cropping.bottom || 0} on:change={(e) => updateCropping((e.target as HTMLInputElement).value, "bottom")} />
                <input class="input" type="number" placeholder="L" value={cropping.left || 0} on:change={(e) => updateCropping((e.target as HTMLInputElement).value, "left")} />
            </div>
        </div>
        {#if !isStage && currentOutput.screenType === "edge_blend"}
            <div class="row">
                <div class="label">Edge blend</div>
                <div style="flex:1; display:flex; gap:4px;">
                    <input class="input" type="number" placeholder="L" value={blending.left || 0} on:change={(e) => updateBlending((e.target as HTMLInputElement).value, "left")} />
                    <input class="input" type="number" placeholder="R" value={blending.right || 0} on:change={(e) => updateBlending((e.target as HTMLInputElement).value, "right")} />
                    <input class="input" type="number" placeholder="Rot" value={blending.rotate ?? 90} on:change={(e) => updateBlending((e.target as HTMLInputElement).value, "rotate")} />
                    <input class="input" type="number" placeholder="Op" value={blending.opacity ?? 50} on:change={(e) => updateBlending((e.target as HTMLInputElement).value, "opacity")} />
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
    .header {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .name-input {
        background: transparent;
        border: 1px solid var(--border-color, var(--primary-lighter));
        color: var(--text);
        padding: 4px 6px;
        border-radius: var(--radius, 4px);
        flex: 1;
    }
    .res {
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
    .select {
        flex: 1;
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--border-color, var(--primary-lighter));
        padding: 4px 6px;
        border-radius: var(--radius, 4px);
    }
    .input {
        flex: 1;
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--border-color, var(--primary-lighter));
        padding: 4px 6px;
        border-radius: var(--radius, 4px);
    }
    .canvas {
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 4px);
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
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
    .tabs {
        display: flex;
        gap: 6px;
    }
    .tab {
        background: transparent;
        border: 1px solid var(--border-color, var(--primary-lighter));
        color: var(--text);
        padding: 4px 10px;
        border-radius: var(--radius, 4px);
        cursor: pointer;
        font-size: 0.9em;
    }
    .tab.active {
        background-color: var(--primary-lighter);
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

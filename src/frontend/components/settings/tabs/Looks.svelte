<script lang="ts">
    import type { LookScreen } from "../../../../types/Settings"
    import { activeLook, looks, outputs, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { save } from "../../../utils/save"
    import { keysToID, sortByName } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import { applyLook, createLook, deleteLook, isStageOutput } from "../../helpers/looks"
    import Icon from "../../helpers/Icon.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    // LOOK SELECTION

    let selectedLook = ""
    $: if (!selectedLook || !$looks[selectedLook]) selectedLook = $activeLook && $looks[$activeLook] ? $activeLook : Object.keys($looks)[0] || ""
    $: currentLook = $looks[selectedLook] || null

    $: lookOptions = Object.entries($looks).map(([id, look]) => ({ value: id, label: look.name }))

    // SCREENS GRID: una columna por pantalla de audiencia (F10; las de stage no aparecen)

    $: audienceScreens = sortByName(keysToID($outputs).filter((a) => !isStageOutput(a)))

    const layerOptions = [
        { label: "looks.media", icon: "image", value: "media" },
        { label: "looks.slide", icon: "slide", value: "slide" },
        { label: "looks.overlays", icon: "overlays", value: "overlays" }
    ]

    const defaultCell = (): LookScreen => ({ layers: { media: true, slide: true, overlays: true } })

    function getCell(outputId: string): LookScreen {
        return currentLook?.screens?.[outputId] || defaultCell()
    }

    // tema: ⊘ (sin override) o un template
    $: themeOptions = [{ value: "", label: `⊘ ${translateText("main.none")}` }, ...sortByName(keysToID($templates)).map((a) => ({ value: a.id, label: a.name }))]

    // LOOK EDITING (los cambios se aplican al tocar "Guardar" en la ventana de F10.6;
    // en esta pestaña de Settings se guardan al instante, como antes)

    function updateLookScreen(outputId: string, patch: Partial<LookScreen>) {
        if (!selectedLook) return

        looks.update((a) => {
            if (!a[selectedLook]) return a
            const cell = { ...(a[selectedLook].screens?.[outputId] || defaultCell()), ...patch }
            a[selectedLook] = { ...a[selectedLook], screens: { ...(a[selectedLook].screens || {}), [outputId]: cell } }
            return a
        })
        save()
    }

    function toggleLayer(outputId: string, layer: "media" | "slide" | "overlays") {
        const layers = { ...getCell(outputId).layers }
        layers[layer] = !layers[layer]
        updateLookScreen(outputId, { layers })
    }

    function updateLookName(name: string) {
        if (!selectedLook) return

        looks.update((a) => {
            if (!a[selectedLook]) return a
            a[selectedLook] = { ...a[selectedLook], name }
            return a
        })
        save()
    }

    function handleCreate() {
        let name = newLookName.trim() || `${translateText("looks.looks")} ${Object.keys($looks).length + 1}`
        newLookName = ""

        const id = createLook(name)
        selectedLook = id
        applyLook(id)
    }
    let newLookName = ""
</script>

<div class="looks">
    <InputRow>
        <MaterialDropdown label="looks.looks" value={selectedLook} options={lookOptions} on:change={(e) => (selectedLook = e.detail)} />
        {#if currentLook}
            <MaterialTextInput label="looks.name" value={currentLook.name} on:change={(e) => updateLookName(e.detail)} />
        {/if}
    </InputRow>

    <InputRow>
        <MaterialTextInput bind:value={newLookName} label="looks.new" placeholder={translateText("looks.new")} />
        <MaterialButton title="looks.new" icon="add" on:click={handleCreate} />
        <MaterialButton title="actions.delete" icon="delete" red disabled={!currentLook || selectedLook === "default"} on:click={() => deleteLook(selectedLook)} />
        <MaterialButton variant="contained" icon="play" disabled={!currentLook} on:click={() => applyLook(selectedLook)}>
            <T id="looks.make_live" />
        </MaterialButton>
    </InputRow>

    {#if !audienceScreens.length}
        <p class="hint">{translateText("looks.no_screens")}</p>
    {:else}
        <div class="grid">
            {#each audienceScreens as output (output.id)}
                {@const cell = getCell(output.id)}

                <div class="screen">
                    <div class="screen-name">
                        <Icon id="screen" size={1.1} white />
                        <span>{output.name || translateText("settings.output_screen")}</span>
                    </div>

                    <MaterialDropdown label="looks.theme" value={cell.theme || ""} options={themeOptions} allowEmpty on:change={(e) => updateLookScreen(output.id, { theme: e.detail || undefined })} />

                    <div class="layers">
                        {#each layerOptions as layer}
                            <MaterialButton icon={layer.icon} title={layer.label} on:click={() => toggleLayer(output.id, layer.value as "media" | "slide" | "overlays")}>
                                <div class="highlight" class:active={!!cell.layers?.[layer.value as "media" | "slide" | "overlays"]}></div>
                            </MaterialButton>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .looks {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
    }

    .hint {
        padding: 0 10px 10px;
        font-size: 0.8em;
        opacity: 0.5;
    }

    /* grid: una columna por pantalla de audiencia */

    .grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .screen {
        display: flex;
        flex-direction: column;
        gap: 6px;

        flex: 1;
        min-width: 240px;

        padding: 10px;
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 8px);
    }

    .screen-name {
        display: flex;
        align-items: center;
        gap: 6px;

        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* toggles de capas (mismo indicador que MaterialToggleButtons) */

    .layers {
        display: flex;
        gap: 4px;
    }

    .layers :global(button) {
        position: relative;
        flex: 1;
    }

    .highlight {
        position: absolute;
        bottom: 5px;
        left: 50%;
        transform: translateX(-50%);

        height: 2px;
        width: 50%;

        background-color: var(--primary-lighter);
        transition: 0.2s background-color ease;
    }
    .highlight.active {
        background-color: var(--secondary);

        box-shadow: 0 0 3px rgb(255 255 255 / 0.2);
    }
</style>

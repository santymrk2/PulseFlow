<script lang="ts">
    import { uid } from "uid"
    import { activeLook, looks, outputs, styles } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { confirmCustom } from "../../../utils/popup"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { applyLook, createLook, deleteLook } from "../../helpers/looks"
    import { defaultLayers } from "../../helpers/output"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import { save } from "../../../utils/save"

    // LOOK SELECTION

    let selectedLook = ""
    $: if (!selectedLook || !$looks[selectedLook]) selectedLook = $activeLook && $looks[$activeLook] ? $activeLook : Object.keys($looks)[0] || ""
    $: currentLook = $looks[selectedLook] || null

    $: lookOptions = Object.entries($looks).map(([id, look]) => ({ value: id, label: look.name }))

    // SCREENS GRID (columnas = pantallas de audiencia, fila 1 = estilo, fila 2 = capas)

    $: audienceScreens = sortByName(keysToID($outputs).filter((a) => !a.stageOutput))

    const layerOptions = [
        { label: "preview.background", icon: "image", value: "background" },
        { label: "preview.slide", icon: "slide", value: "slide" },
        { label: "preview.overlays", icon: "overlays", value: "overlays" }
    ]

    function getStyleId(outputId: string): string {
        return currentLook?.screens?.[outputId] || $outputs[outputId]?.style || ""
    }

    function getStyleLayers(styleId: string): string[] {
        const layers = $styles[styleId]?.layers
        return Array.isArray(layers) ? layers : defaultLayers
    }

    $: styleOptions = [{ value: "", label: translateText("main.none") }, ...sortByName(keysToID($styles)).map((a) => ({ value: a.id, label: a.name }))]

    // LOOK EDITING

    function updateLookName(name: string) {
        if (!selectedLook) return

        looks.update((a) => {
            if (!a[selectedLook]) return a
            a[selectedLook] = { ...a[selectedLook], name }
            return a
        })
        save()
    }

    function updateLookScreen(outputId: string, styleId: string) {
        if (!selectedLook) return

        looks.update((a) => {
            if (!a[selectedLook]) return a
            a[selectedLook] = { ...a[selectedLook], screens: { ...(a[selectedLook].screens || {}), [outputId]: styleId } }
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

    // LAYERS

    function isStyleUsedByOtherLooks(styleId: string) {
        return Object.entries($looks).some(([id, look]) => id !== selectedLook && Object.values(look.screens || {}).includes(styleId))
    }

    function duplicateStyle(styleId: string): string {
        const sourceStyle = $styles[styleId]
        if (!sourceStyle) return styleId

        const lookName = currentLook?.name || ""
        const newId = uid()
        const newStyle = { ...clone(sourceStyle), name: sourceStyle.name ? `${sourceStyle.name} (${lookName})` : lookName }

        history({ id: "UPDATE", newData: { data: newStyle }, oldData: { id: newId }, location: { page: "settings", id: "settings_style" } })
        return newId
    }

    async function toggleLayer(outputId: string, styleId: string, layer: string, layers: string[]) {
        // un estilo compartido con otros looks se duplica para este look en vez de cambiar para todos
        if (styleId && isStyleUsedByOtherLooks(styleId)) {
            const duplicate = await confirmCustom(translateText("looks.duplicate_style_message"))
            if (!duplicate) return

            styleId = duplicateStyle(styleId)
            updateLookScreen(outputId, styleId)
            layers = getStyleLayers(styleId)
        }

        if (!styleId || !$styles[styleId]) return

        const newLayers = layers.includes(layer) ? layers.filter((a) => a !== layer) : [...layers, layer]
        history({ id: "UPDATE", newData: { key: "layers", data: newLayers }, oldData: { id: styleId }, location: { page: "settings", id: "settings_style", override: "style_layers" } })
    }
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
                {@const styleId = getStyleId(output.id)}
                {@const layers = getStyleLayers(styleId)}

                <div class="screen">
                    <div class="screen-name">
                        <Icon id="screen" size={1.1} white />
                        <span>{output.name || translateText("settings.output_screen")}</span>
                    </div>

                    <MaterialDropdown label="edit.style" value={styleId} options={styleOptions} on:change={(e) => updateLookScreen(output.id, e.detail)} allowEmpty />

                    <div class="layers">
                        {#each layerOptions as layer}
                            <MaterialButton icon={layer.icon} title={layer.label} disabled={!styleId} on:click={() => toggleLayer(output.id, styleId, layer.value, layers)}>
                                <div class="highlight" class:active={layers.includes(layer.value)}></div>
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

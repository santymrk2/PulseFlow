<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Output } from "../../../types/Output"
    import type { Look, LookScreen } from "../../../types/Settings"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import InputRow from "../input/InputRow.svelte"
    import MaterialColorInput from "../inputs/MaterialColorInput.svelte"
    import NumberField from "../../lib/components/ui/number-field/number-field.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"

    // F10.6 — "Más opciones": el resto de los campos del LookScreen por pantalla
    // (fondo, ajuste de medios, desenfoque, volumen, líneas, metadata). Colapsado
    // por defecto. Es donde terminan las opciones avanzadas del viejo Estilo.

    export let screens: (Output & { id: string })[] = []
    export let draft: Look

    const dispatch = createEventDispatcher<{ cell: { outputId: string; patch: Partial<LookScreen> } }>()

    const t = translateText

    let open = false

    $: hasContent = screens.length > 0 && !!draft

    function getCell(outputId: string): LookScreen {
        return draft?.screens?.[outputId] || { layers: { media: true, slide: true, overlays: true } }
    }

    function patch(outputId: string, data: Partial<LookScreen>) {
        dispatch("cell", { outputId, patch: data })
    }
</script>

{#if hasContent}
    <details class="advanced" bind:open>
        <summary>
            <Icon id={open ? "expand" : "collapse"} size={0.8} />
            <span>{t("looks.more_options")}</span>
        </summary>

        <div class="advanced-body">
            {#each screens as screen (screen.id)}
                {@const cell = getCell(screen.id)}
                <div class="screen-block">
                    <div class="screen-title">
                        <Icon id="screen" size={0.8} white />
                        <span>{screen.name || t("settings.output_screen")}</span>
                    </div>

                    <MaterialColorInput label="edit.background_color" value={cell.background || "#000000"} defaultValue="#000000" on:input={(e) => patch(screen.id, { background: e.detail })} />

                    <InputRow>
                        <MaterialToggleSwitch label="settings.clear_style_background_on_text" checked={!!cell.clearStyleBackgroundOnText} defaultValue={false} on:change={(e) => patch(screen.id, { clearStyleBackgroundOnText: e.detail })} />
                    </InputRow>

                    <InputRow>
                        <NumberField label="media.volume (%)" value={cell.volume ?? 100} defaultValue={100} max={100} on:change={(e) => patch(screen.id, { volume: e.detail })} />
                        <NumberField label="looks.lines" value={cell.lines ?? 0} defaultValue={0} on:change={(e) => patch(screen.id, { lines: e.detail })} />
                    </InputRow>

                    <InputRow>
                        <NumberField label="looks.blur_amount" value={cell.blurAmount ?? 0} defaultValue={0} on:change={(e) => patch(screen.id, { blurAmount: e.detail })} />
                        <NumberField label="looks.blur_opacity" value={cell.blurOpacity ?? 0} defaultValue={0} max={100} on:change={(e) => patch(screen.id, { blurOpacity: e.detail })} />
                    </InputRow>

                    <InputRow>
                        <MaterialToggleSwitch label="looks.show_as_faded" checked={!!cell.showAsFaded} defaultValue={false} on:change={(e) => patch(screen.id, { showAsFaded: e.detail })} />
                    </InputRow>
                </div>
            {/each}
        </div>
    </details>
{/if}

<style>
    .advanced {
        margin-top: 10px;
        border-top: 1px solid var(--border-color, var(--primary-lighter));
        padding-top: 8px;
    }

    summary {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 0.85em;
        opacity: 0.8;
        list-style: none;
        user-select: none;
    }
    summary::-webkit-details-marker {
        display: none;
    }
    summary:hover {
        opacity: 1;
    }

    .advanced-body {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 10px;
    }

    .screen-block {
        display: flex;
        flex-direction: column;
        gap: 6px;

        flex: 1;
        min-width: 220px;

        padding: 10px;
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 8px);
    }

    .screen-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 0.85em;
    }
</style>

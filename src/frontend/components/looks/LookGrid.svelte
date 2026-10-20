<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Output } from "../../../types/Output"
    import type { Look, LookScreen } from "../../../types/Settings"
    import { templates } from "../../stores"
    import { translateText } from "../../utils/language"
    import { keysToID, sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import MaterialCheckbox from "../inputs/MaterialCheckbox.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import LookAdvanced from "./LookAdvanced.svelte"

    // F10.6 — grilla: una columna por pantalla de audiencia, filas =
    // Presentación (tema), Slide, Media y Overlays. "Más opciones" despliega el
    // resto de los campos del LookScreen (fondo, líneas, metadata, …).

    export let screens: (Output & { id: string })[] = []
    export let draft: Look

    const dispatch = createEventDispatcher<{ cell: { outputId: string; patch: Partial<LookScreen> } }>()

    const t = translateText

    $: themeOptions = [{ value: "", label: `⊘ ${t("main.none")}` }, ...sortByName(keysToID($templates)).map((a) => ({ value: a.id, label: a.name }))]

    function getCell(outputId: string): LookScreen {
        return draft?.screens?.[outputId] || { layers: { media: true, slide: true, overlays: true } }
    }

    function patch(outputId: string, data: Partial<LookScreen>) {
        dispatch("cell", { outputId, patch: data })
    }

    function toggleLayer(outputId: string, layer: "media" | "slide" | "overlays") {
        const cell = getCell(outputId)
        const layers = { ...cell.layers, [layer]: !cell.layers?.[layer] }
        patch(outputId, { layers })
    }
</script>

<div class="grid" style="--columns: {screens.length}">
    <!-- encabezado: una columna por pantalla -->
    <div class="row header">
        <div class="row-label"></div>
        {#each screens as screen (screen.id)}
            <div class="cell header-cell">
                <Icon id="screen" size={0.9} white />
                <span>{screen.name || t("settings.output_screen")}</span>
            </div>
        {/each}
    </div>

    <!-- fila: Presentación (tema) -->
    <div class="row">
        <div class="row-label">{t("looks.presentation")}</div>
        {#each screens as screen (screen.id)}
            {@const cell = getCell(screen.id)}
            <div class="cell">
                <MaterialDropdown label="looks.theme" value={cell.theme || ""} options={themeOptions} allowEmpty on:change={(e) => patch(screen.id, { theme: e.detail || undefined })} />
            </div>
        {/each}
    </div>

    <!-- fila: Slide -->
    <div class="row">
        <div class="row-label">{t("looks.slide")}</div>
        {#each screens as screen (screen.id)}
            {@const cell = getCell(screen.id)}
            <div class="cell centered">
                <MaterialCheckbox checked={!!cell.layers?.slide} label="looks.slide" center on:change={() => toggleLayer(screen.id, "slide")} />
            </div>
        {/each}
    </div>

    <!-- fila: Media -->
    <div class="row">
        <div class="row-label">{t("looks.media")}</div>
        {#each screens as screen (screen.id)}
            {@const cell = getCell(screen.id)}
            <div class="cell centered">
                <MaterialCheckbox checked={!!cell.layers?.media} label="looks.media" center on:change={() => toggleLayer(screen.id, "media")} />
            </div>
        {/each}
    </div>

    <!-- fila: Overlays -->
    <div class="row">
        <div class="row-label">{t("looks.overlays")}</div>
        {#each screens as screen (screen.id)}
            {@const cell = getCell(screen.id)}
            <div class="cell centered">
                <MaterialCheckbox checked={!!cell.layers?.overlays} label="looks.overlays" center on:change={() => toggleLayer(screen.id, "overlays")} />
            </div>
        {/each}
    </div>

    <!-- más opciones (colapsable): el resto de LookScreen por pantalla -->
    <LookAdvanced {screens} {draft} on:cell={(e) => dispatch("cell", e.detail)} />
</div>

<style>
    .grid {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: min-content;
    }

    .row {
        display: grid;
        grid-template-columns: 140px repeat(var(--columns), minmax(140px, 1fr));
        align-items: center;
        gap: 8px;
        min-height: 34px;
    }

    .row.header {
        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
    }

    .row-label {
        font-size: 0.85em;
        opacity: 0.7;
        padding-inline-start: 4px;
    }

    .cell {
        display: flex;
        align-items: center;
        padding: 2px 4px;
    }
    .cell.centered {
        justify-content: center;
    }

    .header-cell {
        gap: 6px;
        font-weight: 600;
        font-size: 0.9em;
        justify-content: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>

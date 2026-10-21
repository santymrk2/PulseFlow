<script lang="ts">
    // Pestaña Overlays del panel derecho: todos los overlays y efectos para sacarlos al aire (clic) o quitarlos si ya están
    // activos. Es el reemplazo de la pestaña Overlays del cajón inferior, que pasó al Overlay editor.
    import type { Output } from "../../../../types/Output"
    import { effects, outLocked, overlayCategories, overlays } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortByName } from "../../helpers/array"
    import { toggleEffectOutput, toggleOverlayOutput } from "../../helpers/overlayOutput"
    import T from "../../helpers/T.svelte"

    export let currentOutput: Output

    const profile = getAccess("overlays")

    $: activeOverlayIds = currentOutput?.out?.overlays || []
    $: activeEffectIds = currentOutput?.out?.effects || []

    $: overlayList = sortByName(keysToID($overlays).filter((a) => a && profile[a.category || ""] !== "none"))
    $: effectList = sortByName(keysToID($effects))

    const categoryName = (id: string | null | undefined) => {
        const name = id ? $overlayCategories[id]?.name : ""
        return name?.includes(".") ? translateText(name) : name || ""
    }
</script>

{#if overlayList.length}
    <div class="list">
        {#each overlayList as overlay (overlay.id)}
            <button type="button" class="row" class:active={activeOverlayIds.includes(overlay.id)} disabled={$outLocked} onclick={() => toggleOverlayOutput(overlay.id)}>
                <span class="name">{overlay.name || "—"}</span>
                <span class="category">{categoryName(overlay.category)}</span>
            </button>
        {/each}
    </div>
{/if}

{#if effectList.length}
    <div class="title"><T id="tabs.effects" /></div>
    <div class="list">
        {#each effectList as effect (effect.id)}
            <button type="button" class="row" class:active={activeEffectIds.includes(effect.id)} disabled={$outLocked} onclick={() => toggleEffectOutput(effect.id)}>
                <span class="name">{effect.name || "—"}</span>
            </button>
        {/each}
    </div>
{/if}

{#if !overlayList.length && !effectList.length}
    <div class="empty"><T id="empty.general" /></div>
{/if}

<style>
    .list {
        display: flex;
        flex-direction: column;
    }
    .title {
        padding: 6px 12px 4px;
        font-size: var(--text-2xs);
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.6;
        border-top: 1px solid var(--border);
    }
    .row {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        width: 100%;
        height: 28px;
        padding: 0 12px;
        border: 0;
        border-left: 2px solid transparent;
        background: transparent;
        color: var(--text);
        font-size: var(--text-sm);
        text-align: start;
    }
    .row:hover:not(:disabled) {
        background: var(--bg-hover);
    }
    /* en el aire: relleno y barra de acento, como la fila activa de las listas del panel izquierdo */
    .row.active {
        background: var(--secondary-opacity);
        border-left-color: var(--secondary);
    }
    .row:disabled {
        opacity: 0.5;
    }
    .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .category {
        font-size: var(--text-xs);
        color: var(--text-muted);
    }
    .empty {
        padding: 12px;
        opacity: 0.5;
    }
</style>

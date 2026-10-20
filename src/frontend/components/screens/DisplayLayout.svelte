<script lang="ts">
    /**
     * Dibujo reutilizable de la disposición de monitores (F10.0e).
     *
     * Recibe los monitores (de `GET_DISPLAYS`, en píxeles lógicos) y un tamaño de
     * contenedor, calcula la disposición con `computeDisplayLayout` y dibuja cada
     * monitor con su número, nombre y resolución. Marca el principal y el asignado.
     * Es presentacional: el clic sobre un monitor se reenvía por `on:select`.
     */
    import { createEventDispatcher } from "svelte"
    import { computeDisplayLayout, type LayoutDisplay } from "./displayLayout"
    import Icon from "../helpers/Icon.svelte"

    export let displays: LayoutDisplay[] = []
    /** Ancho del contenedor en px. */
    export let width = 480
    /** Alto del contenedor en px. */
    export let height = 320
    /** Id del monitor asignado a la salida actual (se resalta). */
    export let assignedId: string | null = null
    /** Si es `false`, los monitores no son clicables. */
    export let selectable = true
    /** Si es `true`, el dibujo ocupa el ancho del contenedor (`width` deja de mandar) y no sale del panel. */
    export let fill = false

    let box = 0

    const dispatch = createEventDispatcher<{ select: LayoutDisplay }>()

    // con `fill` se toma el ancho real del panel y el alto guarda la proporción de `width`×`height`
    $: drawWidth = fill && box ? box : width
    $: drawHeight = fill && box ? Math.round((box * height) / width) : height
    $: layout = computeDisplayLayout(displays, { width: drawWidth, height: drawHeight })

    function resolution(display: LayoutDisplay) {
        const { width, height } = display.bounds
        return `${width}×${height}`
    }
</script>

<div class="displayLayout" class:fill bind:clientWidth={box} style={fill ? `height: ${drawHeight}px;` : `width: ${drawWidth}px;height: ${drawHeight}px;`}>
    {#each layout.displays as item (item.display.id)}
        <div
            class="monitor"
            class:primary={item.display.primary}
            class:assigned={assignedId === item.display.id}
            class:selectable
            style="left: {item.x}px;top: {item.y}px;width: {item.width}px;height: {item.height}px;"
            role={selectable ? "button" : "none"}
            tabindex={selectable ? 0 : -1}
            data-title={item.display.label || `Display ${item.number}`}
            on:click={() => selectable && dispatch("select", item.display)}
            on:keydown={(e) => (selectable && (e.key === "Enter" || e.key === " ") ? dispatch("select", item.display) : null)}
        >
            <span class="number">{item.number}</span>
            {#if item.display.primary}
                <span class="badge primary" data-title="primary"><Icon id="star" size={0.8} /></span>
            {/if}
            {#if assignedId === item.display.id}
                <span class="badge assigned" data-title="assigned"><Icon id="check" size={0.8} /></span>
            {/if}
            {#if item.width > 90}
                <span class="meta">
                    <span class="name">{item.display.label || `Display ${item.number}`}</span>
                    <span class="res">{resolution(item.display)}</span>
                </span>
            {/if}
        </div>
    {/each}
</div>

<style>
    .displayLayout {
        position: relative;
        overflow: hidden;
        max-width: 100%;
    }
    .displayLayout.fill {
        width: 100%;
    }
    .monitor {
        position: absolute;
        box-sizing: border-box;
        border: 2px solid var(--primary-lighter, var(--border-color));
        border-radius: 6px;
        background-color: var(--primary-darker);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
    .monitor.selectable {
        cursor: pointer;
    }
    .monitor.selectable:hover {
        border-color: var(--primary);
    }
    .monitor.primary {
        border-style: dashed;
    }
    .monitor.assigned {
        border-color: var(--secondary, var(--primary));
        box-shadow: 0 0 0 2px var(--secondary, var(--primary));
    }
    .number {
        font-size: 1.6em;
        font-weight: bold;
        opacity: 0.85;
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
    }
    .badge {
        position: absolute;
        display: flex;
        align-items: center;
        color: var(--text);
    }
    .badge.primary {
        top: 2px;
        left: 4px;
        opacity: 0.7;
    }
    .badge.assigned {
        top: 2px;
        right: 4px;
        color: var(--secondary, var(--primary));
    }
    .meta {
        position: absolute;
        bottom: 2px;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 0.62em;
        opacity: 0.75;
        pointer-events: none;
        white-space: nowrap;
        overflow: hidden;
    }
    .meta .res {
        opacity: 0.7;
    }
</style>

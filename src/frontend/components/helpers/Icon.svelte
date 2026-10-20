<script lang="ts">
    import type { Selected } from "../../../types/Main"
    import { activePopup, localeDirection, selected } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { customIcons } from "../../values/customIcons"
    import icons from "../../values/icons"
    import { fadeColor } from "./color"

    export let id: string
    export let color: string = ""
    export let title = ""
    export let size = 1
    export let white = false
    export let right = false
    export let fill = false
    export let custom = false
    export let select = false
    export let selectData: Selected | null = null
    export let box = 24
    export let boxed = false

    $: width = size * (boxed ? 1.2 : 1) + "rem"
    $: height = size * (boxed ? 1.2 : 1) + "rem"

    $: icon = custom || !icons[id] ? customIcons[id] : icons[id]

    const iconsToBeFlipped = ["back"] // Add more icons that need to be flipped horizontally if needed
    const flip = $localeDirection === "rtl" && iconsToBeFlipped.includes(id)

    const click = () => {
        if (!select) return

        if (selectData && !$selected.data.includes(selectData.data[0])) selected.set(selectData)
        activePopup.set("icon")
    }

    $: if (boxed && !color) color = "#ffffff"
</script>

{#if select}
    <svg class={$$props.class} class:flip class:white class:right class:fill class:select class:boxed on:click={click} on:keydown={triggerClickOnEnterSpace} tabindex={0} role="button" style="{$$props.style || ''};{color ? `color: ${color};` : ''}{boxed && color ? `background-color: ${fadeColor(color, 0.3)};` : ''}min-width: {width};{boxed ? `min-height: ${height};` : ''}" {width} {height} viewBox="0 0 {box} {box}" data-title={title}>
        {@html icon ? icon : icons.noIcon}
    </svg>
{:else}
    <svg class={$$props.class} class:flip class:white class:right class:fill class:boxed style="{$$props.style || ''};{color ? `color: ${color};` : ''}{boxed && color ? `background-color: ${fadeColor(color, 0.3)};` : ''}min-width: {width};{boxed ? `min-height: ${height};` : ''}" {width} {height} viewBox="0 0 {box} {box}" data-title={title}>
        {@html icon ? icon : icons.noIcon}
    </svg>
{/if}

<style>
    /* docs/design/kit.md: íconos en gris, el activo/hover pasa a --text (`white` = currentColor) */
    svg {
        fill: var(--text-muted);
    }

    svg.select {
        cursor: pointer;
    }

    svg.select:hover {
        background-color: var(--hover);
    }

    svg.white {
        /* fill: var(--secondary-text); */
        fill: currentColor;
    }

    svg.right {
        margin-inline-end: 0.5em;
    }

    svg.fill {
        width: 100%;
        height: 100%;
    }

    svg.flip {
        transform: scaleX(-1);
    }

    svg.boxed {
        padding: 0.2em;
        border-radius: 0.3em;
    }
</style>

<script lang="ts">
    // Modo legacy (no runes) a propósito: los padres usan `on:click` sobre este
    // componente y Svelte 5 sólo reenvía esas directivas en componentes legacy.
    export let active = false
    export let outlineColor: string | null = null
    export let outline = false
    export let title = ""
    export let center = false
    export let border = false
    export let dark = false
    export let bold = true
    export let red = false
    export let redHover = false
    export let brighterHover = false
    export let style = ""
    export let tabindex: number | null | undefined = undefined
    export let disabled: boolean | null | undefined = undefined
    let className = ""
    export { className as class }
</script>

<button {...$$restProps} data-title={title} {disabled} tabindex={tabindex ?? (active ? -1 : 0)} style="{outlineColor ? 'outline-offset: -2px;outline: 2px solid ' + outlineColor + ' !important;' : ''}{style}" class:active class:outline class:center class:border class:bold class:dark class:red class:redHover class:brighterHover class={className} on:click on:dblclick on:mousedown on:contextmenu on:keydown on:focus on:blur on:mouseenter on:mouseleave>
    <slot />
</button>

<style>
    button {
        position: relative;
        background-color: inherit;
        color: inherit;
        font-family: inherit;
        font-size: 0.9em;
        border: none;
        display: flex;
        align-items: center;
        padding: 0.25em 0.8em;
        border-radius: var(--radius, 6px);

        transition:
            background-color 0.15s ease,
            border 0.15s ease;
    }
    button.dark {
        background-color: var(--primary-darker);
    }
    button.center {
        justify-content: center;
        text-align: center;
    }
    button.center :global(p) {
        text-align: center;
    }
    button.bold {
        font-weight: 600;
        letter-spacing: 0.5px;
        padding: 0.3em 0.8em;
        /* text-transform: uppercase; */
    }

    /* red */
    button.red:not(:disabled) {
        background-color: rgb(255 0 0 / 0.25);
    }
    button.red:hover:not(:disabled):not(.active) {
        background-color: rgb(255 0 0 / 0.35);
    }
    button.red:active:not(:disabled):not(.active),
    button.red:focus:not(:disabled):not(.active) {
        background-color: rgb(255 0 0 / 0.3);
    }

    button:not(:disabled):not(.active) {
        cursor: pointer;
    }
    button:hover:not(:disabled):not(.active) {
        background-color: var(--hover);
    }
    button:hover.brighterHover:not(:disabled):not(.active) {
        background-color: rgb(255 255 255 / 0.3);
    }
    button:hover.redHover:not(:disabled):not(.active) {
        background-color: rgb(255 0 0 / 0.3);
    }
    button:active:not(:disabled):not(.active),
    button:focus:not(.active) {
        background-color: var(--focus);
    }
    button.active {
        /* background-color: var(--secondary-opacity); */
        /* background-color: var(--primary-darkest); */
        background-color: var(--primary-darker);
        color: var(--text);
        outline: none;
    }
    button.dark.active {
        background-color: var(--primary-darkest);
    }
    button.active.border {
        outline-offset: -2px;
        /* outline: 2px solid var(--secondary); */
        outline: 2px solid var(--primary-lighter);
    }

    button.outline {
        outline-offset: -2px;
        outline: 2px solid var(--secondary) !important;
    }

    button :global(div) {
        padding-inline-start: 0.8em;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow-x: hidden;
        line-height: 150%;
    }

    button :global(svg) {
        /* padding: 0 0.5em; */
        /* padding-left: 0.2em; */
        box-sizing: content-box;
        border: 0 !important; /* remove CombinedInput border */
    }
    /* button.active :global(svg) {
        fill: var(--text);
    } */

    button:disabled {
        opacity: 0.5;
        /* this is to prevent interfearing with mouse event listeners */
        pointer-events: none;
    }
</style>

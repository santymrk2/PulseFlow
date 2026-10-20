<script lang="ts">
    import { special } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"

    export let side: "right" | "left" | "center" = "right"
    export let onlyOne = false
    export let round = false
    export let arrow = false
    export let bottom = 10

    let open = false

    $: isOptimized = $special.optimizedMode
</script>

<!-- in:fade={{ duration: 80 }} -->
<div class="row {side}" class:isOptimized class:onlyOne class:round style="bottom: {bottom}px;{$$props.style || ''}" on:mousedown>
    {#if arrow}
        <Button style={open ? "" : "opacity: 0.6;"} class="expand" title={open ? "actions.close" : "create_show.more_options"} isActive={open} on:click={() => (open = !open)}>
            <Icon class="submenu_{open ? 'close' : 'open'}" id="arrow_back_modern" size={0.9} white={!open} />
        </Button>

        <div class="divider"></div>

        {#if open}
            <!-- transition:slide={{ duration: 500, axis: "x" }} -->
            <div class="menu">
                <slot name="menu" />
            </div>

            <!-- <div class="divider"></div> -->
        {/if}
    {/if}

    <slot {open} />
</div>

<style>
    /* barra flotante: rectángulo con borde de 1 px (docs/design/kit.md); sin píldora, degradé ni botón redondo */
    .row {
        --size: 32px;
        --padding: 12px;

        display: flex;
        background-color: var(--bg-elevated);
        border: 1px solid var(--border-strong);
        box-shadow: var(--shadow-float);

        height: var(--size);

        position: absolute;
        bottom: var(--padding);

        border-radius: var(--radius);
        overflow: hidden;
        z-index: 199; /* over edit items */

        max-width: calc(100% - 22px);
    }
    .row:has(.overflow) {
        overflow: visible;
    }
    .row:has(.overflow-interact) {
        bottom: 0 !important;
        height: calc(var(--size) + var(--padding));
        border: none;
        box-shadow: none;
        background: transparent;
    }
    .row:has(.overflow-interact) :global(button) {
        box-shadow: var(--shadow-float);
    }

    .row.right {
        right: var(--padding);
    }
    .row.left {
        left: var(--padding);
    }
    .row.center {
        left: 50%;
        transform: translateX(-50%);
    }

    .row :global(.divider) {
        height: 100%;
        width: 1px;
        background-color: var(--border);
    }

    .row :global(button) {
        background-color: transparent !important;
        height: calc(var(--size) - 2px);
        padding: 0 12px !important;
        border-radius: 0;
    }
    .row.onlyOne :global(button) {
        padding: 0 16px !important;
    }
    .row.round :global(button) {
        aspect-ratio: 1;
    }
    .row :global(button.isActive) {
        background-color: var(--bg-active) !important;
        cursor: pointer;
    }

    .row :global(button.expand.isActive) {
        background-color: transparent !important;
        border: none !important;
        cursor: pointer;
    }
    .row :global(button.expand svg) {
        transition: 0.3s transform ease;
    }
    .row :global(button.expand.isActive svg) {
        transform: rotate(180deg);
    }

    .menu {
        display: flex;
        flex-direction: column;
    }
</style>

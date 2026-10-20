<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { activePopup } from "../../stores"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    export let title = ""
    export let width = 960
    export let height = 620
    export let closable = true

    const dispatch = createEventDispatcher()

    function close() {
        if (!closable) return
        dispatch("close")
        activePopup.set(null)
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key !== "Escape") return
        if (!closable) return
        e.preventDefault()
        e.stopPropagation()
        close()
    }

    onMount(() => {
        window.addEventListener("keydown", onKeydown, true)
    })

    onDestroy(() => {
        window.removeEventListener("keydown", onKeydown, true)
    })
</script>

<div class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal" style="width: {width}px; height: {height}px; max-width: calc(100vw - 40px); max-height: calc(100vh - 40px);">
        <div class="modal-header">
            <div class="header-title">{title}</div>
            {#if closable}
                <MaterialButton class="modal-close" icon="close" iconSize={1.2} title="actions.close" on:click={close} />
            {/if}
        </div>
        <div class="modal-body">
            <slot />
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: absolute;
        inset: 0;
        background-color: rgb(0 0 0 / 0.6);
        z-index: 5000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(2px);
    }

    .modal {
        position: relative;
        background-color: var(--primary);
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 8px);
        box-shadow: 0 10px 40px rgb(0 0 0 / 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .modal-header {
        height: 36px;
        min-height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
        background-color: var(--primary-darker);
    }

    .header-title {
        font-size: 0.9em;
        color: var(--text);
        text-align: center;
        opacity: 0.9;
    }

    .modal :global(.modal-close) {
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        padding: 4px !important;
        height: 28px;
        aspect-ratio: 1;
        border-radius: var(--radius, 4px);
    }

    .modal-body {
        flex: 1;
        display: flex;
        min-height: 0;
    }
</style>

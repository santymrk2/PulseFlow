<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { fade, scale } from "svelte/transition"
    import { activePopup, os, special } from "../../stores"
    import { MENU_BAR_HEIGHT } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"

    // Base de modales (F10): ventana propia centrada, no un diálogo chico como
    // Popup.svelte. La usan "Looks" (F10.6) y "Configuración de pantallas" (F10.3).
    // Si al integrar existe components/main/Modal.svelte con la misma API, este
    // archivo se reemplaza por ese.

    export let title = ""
    export let width = 720
    export let height = 480
    /** true: clic afuera NO cierra (evita perder cambios sin guardar). */
    export let lockOutsideClick = true

    const dispatch = createEventDispatcher()

    $: isWindows = $os.platform === "win32"
    $: isOptimized = $special.optimizedMode

    function close() {
        dispatch("close")
        activePopup.set(null)
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.stopPropagation()
            close()
        }
    }

    let modal: HTMLDivElement
    onMount(() => {
        modal?.focus()
    })
</script>

<svelte:window on:keydown={onKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<div class="modal-backdrop" style={isWindows ? `height: calc(100% - ${MENU_BAR_HEIGHT}px);` : null} transition:fade={{ duration: isOptimized ? 20 : 100 }} on:mousedown={(e) => (lockOutsideClick ? null : e.target === e.currentTarget && close())}>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
    <div class="modal" bind:this={modal} tabindex="-1" role="dialog" aria-label={translateText(title)} style="--modal-width: {width}px; --modal-height: {height}px;" transition:scale={{ duration: isOptimized ? 50 : 200 }}>
        <div class="modal-titlebar" data-tauri-drag-region>
            <span class="modal-title">{translateText(title)}</span>
            <button class="modal-close" title={translateText("actions.close [esc]")} on:click={close}>
                <Icon id="close" size={1.1} />
            </button>
        </div>

        <div class="modal-body">
            <slot />
        </div>

        {#if $$slots.footer}
            <div class="modal-footer">
                <slot name="footer" />
            </div>
        {/if}
    </div>
</div>

<style>
    .modal-backdrop {
        position: absolute;
        inset: 0;
        z-index: 5000;

        display: flex;
        align-items: center;
        justify-content: center;

        padding: 20px;

        background-color: rgb(0 0 0 / 0.55);
        backdrop-filter: blur(4px);
    }

    .modal {
        position: relative;
        display: flex;
        flex-direction: column;

        width: min(var(--modal-width), calc(100vw - 40px));
        height: min(var(--modal-height), calc(100vh - 40px));

        background-color: var(--primary);
        border: 2px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 10px);
        box-shadow: 0 0 5px 5px rgb(0 0 0 / 0.2);

        overflow: hidden;
        outline: none;
    }

    /* barra de título propia de 36 px (igual que las ventanas de ProPresenter) */

    .modal-titlebar {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;

        flex: 0 0 36px;
        height: 36px;

        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
        background-color: var(--primary-darker);
    }

    .modal-title {
        font-size: 0.85em;
        font-weight: 600;
        opacity: 0.8;
        pointer-events: none;
    }

    .modal-close {
        position: absolute;
        inset-inline-end: 6px;
        top: 50%;
        transform: translateY(-50%);

        display: flex;
        align-items: center;
        justify-content: center;

        height: 26px;
        width: 26px;
        padding: 0;

        color: var(--text);
        background: none;
        border: none;
        border-radius: var(--radius, 4px);
        cursor: pointer;
    }
    .modal-close:hover {
        background-color: var(--primary-lightest, rgb(255 255 255 / 0.1));
    }

    .modal-body {
        flex: 1;
        min-height: 0;
        display: flex;
        overflow: hidden;
    }

    .modal-footer {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;

        padding: 10px 14px;
        border-top: 1px solid var(--border-color, var(--primary-lighter));
        background-color: var(--primary-darker);
    }
</style>

<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { fade, scale } from "svelte/transition"
    import { activePopup, os, special } from "../../stores"
    import { MENU_BAR_HEIGHT } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"

    // Base única de modales de pantalla completa (F12.1): "Configuración de pantallas" y "Looks".
    // Vive fuera de Popup.svelte, que sólo sirve para diálogos chicos.

    export let title = ""
    export let width = 960
    export let height = 620
    /** false: el modal se puede cerrar sin confirmar (no usado hoy). */
    export let closable = true
    /** true: clic afuera NO cierra (evita perder cambios sin guardar). */
    export let lockOutsideClick = true
    /** false: el modal no es el popup activo (ej. Configuración) y cerrarlo no debe tocar `activePopup`. */
    export let managesPopup = true
    /** true: Esc pasa de largo (hay otro popup encima que lo necesita). */
    export let blockEscape = false

    const dispatch = createEventDispatcher()

    $: isWindows = $os.platform === "win32"
    $: isOptimized = $special.optimizedMode

    function close() {
        if (!closable) return
        dispatch("close")
        if (managesPopup) activePopup.set(null)
    }

    // capture: Esc cierra el modal sin llegar a utils/shortcuts.ts (que limpia la salida con Esc)
    function onKeydown(e: KeyboardEvent) {
        if (e.key !== "Escape" || blockEscape) return
        e.preventDefault()
        e.stopPropagation()
        close()
    }

    let card: HTMLDivElement
    onMount(() => {
        window.addEventListener("keydown", onKeydown, true)
        card?.focus()
    })

    onDestroy(() => {
        window.removeEventListener("keydown", onKeydown, true)
    })

    function backdropMousedown(e: MouseEvent) {
        if (lockOutsideClick) return
        if (e.target === e.currentTarget) close()
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" style={isWindows ? `height: calc(100% - ${MENU_BAR_HEIGHT}px);` : null} transition:fade={{ duration: isOptimized ? 20 : 100 }} on:mousedown={backdropMousedown}>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="modal" bind:this={card} tabindex="-1" role="dialog" aria-modal="true" aria-label={translateText(title)} style="--modal-width: {width}px; --modal-height: {height}px;" transition:scale={{ duration: isOptimized ? 50 : 200 }}>
        <header class="modal-header">
            <span class="modal-title">{translateText(title)}</span>
            {#if closable}
                <button class="modal-close" title={translateText("actions.close [esc]")} on:click={close}>
                    <Icon id="close" size={1.1} />
                </button>
            {/if}
        </header>

        <div class="modal-body">
            <slot />
        </div>

        {#if $$slots.footer}
            <footer class="modal-footer">
                <slot name="footer" />
            </footer>
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

        padding: 16px;

        background-color: var(--backdrop);
        backdrop-filter: blur(2px);
    }

    .modal {
        position: relative;
        display: flex;
        flex-direction: column;

        /* 960×620 como ProPresenter; si la ventana es chica se reduce con 16 px de margen */
        width: min(var(--modal-width), calc(100vw - 32px));
        height: min(var(--modal-height), calc(100vh - 32px));

        background-color: var(--primary);
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius-modal, 8px);
        box-shadow: var(--shadow-float);

        overflow: hidden;
        outline: none;
    }

    /* cabecera fija de 44 px: título a la izquierda, ✕ a la derecha */

    .modal-header {
        flex: 0 0 44px;
        height: 44px;

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        padding: 0 8px 0 16px;
        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
        background-color: var(--primary-darker);
    }

    .modal-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .modal-close {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;

        width: 28px;
        height: 28px;
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

    /* el cuerpo ocupa el resto; cada modal decide qué parte scrollea */

    .modal-body {
        flex: 1;
        min-height: 0;
        display: flex;
        overflow: hidden;
    }

    /* pie fijo de 52 px (botones Aplicar / Duplicar / Borrar) */

    .modal-footer {
        flex: 0 0 52px;
        height: 52px;

        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;

        padding: 0 16px;
        border-top: 1px solid var(--border-color, var(--primary-lighter));
        background-color: var(--primary-darker);
    }
</style>

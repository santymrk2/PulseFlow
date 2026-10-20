<script lang="ts">
    // Modo legacy (no runes) a propósito: los padres usan `on:click` sobre este
    // componente y Svelte 5 sólo reenvía esas directivas en componentes legacy.
    import { onMount } from "svelte"
    import { translateText } from "../../utils/language"
    import Icon from "./Icon.svelte"

    export let icon: string
    export let size = 5
    export let title = "media.play"
    export let hide = false
    export let style = ""

    // fade out (to show itself)
    let reveal = true
    onMount(startFade)
    function startFade() {
        setTimeout(() => {
            reveal = false
        }, 800)
    }
</script>

<div {...$$restProps} {style} role="none" data-title={hide ? "" : translateText(title)} on:click on:dblclick on:mousedown on:contextmenu>
    <slot />

    <div class="overlay" class:reveal class:hidden={hide}>
        <Icon id={icon} {size} white />
    </div>
</div>

<style>
    div {
        width: 100%;
        height: 100%;
        position: relative;
    }

    .overlay.reveal {
        opacity: 0.2;
        transition: 2s opacity;
    }

    .overlay {
        cursor: pointer;
        position: absolute;
        top: 0;
        opacity: 0;
        transition: 0.2s opacity;
        background-color: rgb(0 0 0 / 0.5);

        display: flex;
        align-items: center;
        justify-content: center;
    }
    .overlay:hover {
        opacity: 0.8;
    }
    .overlay.hidden {
        transition: 0.4s opacity;
        cursor: default;
        opacity: 0;
    }
</style>

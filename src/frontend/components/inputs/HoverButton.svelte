<script lang="ts">
    import { onMount, type Snippet } from "svelte"
    import type { HTMLAttributes } from "svelte/elements"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"

    interface Props extends HTMLAttributes<HTMLDivElement> {
        icon: string
        size?: number
        title?: string
        hide?: boolean
        children?: Snippet
    }

    let {
        icon,
        size = 5,
        title = "media.play",
        hide = false,
        children,
        style = "",
        ...restProps
    }: Props = $props()

    // fade out (to show itself)
    let reveal = $state(true)
    onMount(startFade)
    function startFade() {
        setTimeout(() => {
            reveal = false
        }, 800)
    }
</script>

<div {...restProps} {style} role="none" data-title={hide ? "" : translateText(title)}>
    {@render children?.()}

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

<script lang="ts">
    import type { Snippet } from "svelte"
    import type { HTMLAttributes } from "svelte/elements"

    interface Props extends HTMLAttributes<HTMLDivElement> {
        faded?: boolean
        absolute?: boolean
        padding?: number
        size?: number
        style?: string
        children?: Snippet
    }

    let { faded = false, absolute = false, padding = 0, size = 1, style = "", children, class: className = "", ...restProps }: Props = $props()
</script>

<div {...restProps} style="font-size: {size}em;padding: {padding}px;{style}" class="loader {className}" class:faded class:absolute>
    {@render children?.()}
</div>

<style>
    div {
        display: flex;
        height: 100%;
        width: 100%;
        overflow-y: auto;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
    }

    .faded {
        opacity: 0.5;
        overflow: hidden;
    }

    .absolute {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
</style>

<script lang="ts">
    // Isla React dentro de Svelte (F24.3).
    import { onDestroy, onMount } from "svelte"
    import { createElement, type ElementType } from "react"
    import { createRoot, type Root } from "react-dom/client"

    export let component: ElementType
    export let props: Record<string, unknown> = {}

    let host: HTMLDivElement
    let root: Root | null = null

    onMount(() => {
        root = createRoot(host)
        root.render(createElement(component, props))
    })

    $: if (root) root.render(createElement(component, props))

    onDestroy(() => {
        const current = root
        root = null
        // desmontar fuera del ciclo de Svelte evita el aviso de React por desmontar durante un render
        queueMicrotask(() => current?.unmount())
    })
</script>

<div bind:this={host} style="display: contents"></div>

<script lang="ts">
    import { cn } from "$lib/utils.js"
    import type { Snippet } from "svelte"

    // Grupo de botones de la barra superior: cápsula de 32 px con borde y radio completo.
    // Dentro van botones `ghost` de tamaño `sm` (28 px) o `icon-sm`.
    let {
        class: className = "",
        children
    }: {
        class?: string
        children?: Snippet
    } = $props()
</script>

<div data-slot="capsule" class={cn("flex h-8 shrink-0 items-center gap-0.5 rounded-full border border-border bg-card p-0.5", className)}>
    {@render children?.()}
</div>

<script lang="ts">
    import { cn } from "$lib/utils.js"
    import type { Snippet } from "svelte"

    // Grupo de botones de la barra superior: 32 px con borde de 1 px y el mismo radio que los botones normales
    // (`--radius`), sin fondo propio; los botones de adentro usan el radio chico para que las esquinas encajen.
    // Dentro van botones `ghost` de tamaño `sm` (28 px) o `icon-sm`.
    let {
        class: className = "",
        children
    }: {
        class?: string
        children?: Snippet
    } = $props()
</script>

<div data-slot="capsule" class={cn("flex h-8 shrink-0 items-center gap-0.5 rounded-md border border-border p-0.5 [&>button]:rounded-sm", className)}>
    {@render children?.()}
</div>

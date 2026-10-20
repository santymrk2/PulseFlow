<script lang="ts">
    import { cn } from "$lib/utils.js"
    import type { Snippet } from "svelte"

    // Fila etiqueta + control. Normal: etiqueta a la izquierda de ancho fijo `labelWidth`
    // y control al resto. `stacked`: etiqueta arriba del control.
    let {
        class: className = "",
        label = "",
        labelWidth = 140,
        stacked = false,
        children
    }: {
        class?: string
        label?: string
        labelWidth?: number
        stacked?: boolean
        children?: Snippet
    } = $props()
</script>

<div data-slot="field" class={cn("flex gap-2", stacked ? "flex-col items-stretch" : "items-center", className)}>
    {#if label}
        <span class="text-xs text-muted-foreground" style={stacked ? undefined : `flex: 0 0 ${labelWidth}px; width: ${labelWidth}px;`}>{label}</span>
    {/if}
    <div class="min-w-0 flex-1">
        {@render children?.()}
    </div>
</div>

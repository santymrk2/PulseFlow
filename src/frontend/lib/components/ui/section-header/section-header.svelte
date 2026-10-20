<script lang="ts">
    import { cn } from "$lib/utils.js"
    import type { Snippet } from "svelte"

    // Título de sección: 11 px, mayúsculas, alto 28 px. `actions` va a la derecha (ej. "+").
    let {
        class: className = "",
        children,
        actions
    }: {
        class?: string
        children?: Snippet
        actions?: Snippet
    } = $props()
</script>

<div data-slot="section-header" class={cn("flex h-7 shrink-0 items-center justify-between gap-2 px-3 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase", className)}>
    <span class="min-w-0 truncate">{@render children?.()}</span>
    {#if actions}
        <div class="flex shrink-0 items-center gap-1">
            {@render actions()}
        </div>
    {/if}
</div>

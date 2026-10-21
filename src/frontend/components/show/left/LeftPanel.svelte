<script lang="ts">
    import type { Snippet } from "svelte"

    // Marco de un panel de la columna izquierda: barra de título propia (más clara que el
    // fondo, con contador y pastilla de contexto) y cuerpo con scroll. La línea gruesa entre
    // paneles la pone el contenedor (`LeftColumn`).
    let {
        title,
        count,
        context,
        actions,
        children
    }: {
        title: string
        count?: number | null
        context?: string
        actions?: Snippet
        children?: Snippet
    } = $props()
</script>

<section class="flex min-h-0 flex-1 flex-col" data-slot="left-panel">
    <header class="flex h-7 shrink-0 items-center justify-between gap-2 border-b border-border bg-muted px-3 text-[11px] font-semibold tracking-[0.08em] text-foreground uppercase">
        <span class="flex min-w-0 items-center gap-2">
            <span class="truncate">{title}</span>
            {#if context}
                <span class="max-w-[9rem] truncate rounded-full bg-primary px-2 text-[10px] font-semibold tracking-normal text-primary-foreground normal-case">{context}</span>
            {/if}
            {#if count !== undefined && count !== null}
                <span class="font-normal tracking-normal text-muted-foreground">{count}</span>
            {/if}
        </span>
        {#if actions}
            <span class="flex shrink-0 items-center gap-1">{@render actions()}</span>
        {/if}
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto">
        {@render children?.()}
    </div>
</section>

<script lang="ts">
    import { cn } from "$lib/utils.js"
    import type { Snippet } from "svelte"
    import type { HTMLButtonAttributes } from "svelte/elements"

    // Ítem de 28 px. `checked` muestra una marca a la izquierda (ej. el look activo).
    let {
        class: className = "",
        checked = false,
        children,
        onclick,
        ...restProps
    }: HTMLButtonAttributes & {
        checked?: boolean
        children?: Snippet
    } = $props()
</script>

<button type="button" role="menuitem" data-slot="menu-item" class={cn("flex h-7 w-full items-center gap-2 border-0 bg-transparent px-3 text-left text-[13px] whitespace-nowrap text-popover-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50", className)} {onclick} {...restProps}>
    <span class="w-3 shrink-0 text-xs text-primary">{checked ? "✓" : ""}</span>
    <span class="min-w-0 flex-1 truncate">{@render children?.()}</span>
</button>

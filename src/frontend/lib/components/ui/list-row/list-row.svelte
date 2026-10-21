<script lang="ts">
    import { cn } from "$lib/utils.js"
    import type { Snippet } from "svelte"
    import type { HTMLButtonAttributes } from "svelte/elements"

    // Fila de lista de 28 px. Ícono y texto a la izquierda; `active` marca la fila con
    // fondo suave y una barra de 2 px a la izquierda. `trailing` va a la derecha (contador, acción).
    let {
        class: className = "",
        active = false,
        icon,
        trailing,
        children,
        onclick,
        ...restProps
    }: HTMLButtonAttributes & {
        active?: boolean
        icon?: Snippet
        trailing?: Snippet
        children?: Snippet
    } = $props()
</script>

<button type="button" data-slot="list-row" aria-current={active ? "true" : undefined} class={cn("relative flex h-7 w-full min-w-0 items-center gap-2 border-0 bg-transparent pr-2 pl-3 text-left text-[13px] text-foreground transition-colors hover:bg-accent/50", active && "bg-accent before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary", className)} {onclick} {...restProps}>
    {#if icon}
        <span class="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">
            {@render icon()}
        </span>
    {/if}
    <span class="min-w-0 flex-1 truncate">{@render children?.()}</span>
    {#if trailing}
        <span class="flex shrink-0 items-center text-xs text-muted-foreground">
            {@render trailing()}
        </span>
    {/if}
</button>

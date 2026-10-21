<script lang="ts">
    import { cn } from "$lib/utils.js"
    import type { Snippet } from "svelte"

    // Desplegable simple. El padre pone un contenedor `relative` alrededor del disparador
    // y este menú, que se abre debajo de él. Se cierra con clic afuera (fuera del padre) y Esc.
    let {
        open = false,
        class: className = "",
        onclose,
        children
    }: {
        open?: boolean
        class?: string
        onclose?: () => void
        children?: Snippet
    } = $props()

    let menu: HTMLDivElement | undefined = $state()

    $effect(() => {
        if (!open) return

        function onPointerDown(e: MouseEvent) {
            const anchor = menu?.parentElement
            if (anchor && !anchor.contains(e.target as Node)) onclose?.()
        }

        // capture: Esc cierra el menú sin llegar a utils/shortcuts.ts
        function onKeydown(e: KeyboardEvent) {
            if (e.key !== "Escape") return
            e.stopPropagation()
            onclose?.()
        }

        window.addEventListener("mousedown", onPointerDown, true)
        window.addEventListener("keydown", onKeydown, true)
        return () => {
            window.removeEventListener("mousedown", onPointerDown, true)
            window.removeEventListener("keydown", onKeydown, true)
        }
    })
</script>

{#if open}
    <div bind:this={menu} role="menu" data-slot="menu" class={cn("absolute end-0 top-full z-50 mt-1 min-w-44 overflow-hidden rounded-[var(--radius)] border border-border bg-popover py-1 text-popover-foreground shadow-lg", className)}>
        {@render children?.()}
    </div>
{/if}

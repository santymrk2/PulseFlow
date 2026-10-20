<script lang="ts">
    import { cn, type WithElementRef } from "$lib/utils.js"
    import type { Snippet } from "svelte"
    import type { HTMLButtonAttributes } from "svelte/elements"
    import { type VariantProps, tv } from "tailwind-variants"

    export const buttonVariants = tv({
        base: "inline-flex cursor-pointer items-center justify-center gap-2 border border-transparent bg-transparent text-foreground whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                // Audiencia / Stage: rojo mientras está activo (`aria-pressed="true"`)
                live: "bg-muted text-foreground hover:bg-accent aria-pressed:border-destructive/50 aria-pressed:bg-transparent aria-pressed:text-destructive"
            },
            size: {
                // medidas del kit (docs/design/kit.md): 28 compacto, 32 normal
                default: "h-8 px-3 py-2 has-[>svg]:px-2.5 text-[13px]",
                sm: "h-7 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2 text-xs",
                lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
                icon: "size-7",
                "icon-sm": "size-6"
            }
        },
        defaultVariants: {
            variant: "default",
            size: "default"
        }
    })

    type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]
    type ButtonSize = VariantProps<typeof buttonVariants>["size"]

    let {
        class: className,
        variant = "default" as ButtonVariant,
        size = "default" as ButtonSize,
        ref = $bindable(null),
        children,
        ...restProps
    }: WithElementRef<HTMLButtonAttributes, HTMLButtonElement> & {
        variant?: ButtonVariant
        size?: ButtonSize
        children?: Snippet
    } = $props()
</script>

<button bind:this={ref} data-slot="button" class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
    {@render children?.()}
</button>

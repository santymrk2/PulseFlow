<script lang="ts">
    // Botón único de la app (F14.8a). Reemplaza al `MaterialButton`, al `Button` legacy y al botón shadcn.
    //
    // Contrato de eventos (docs/design/kit.md): `on:click` / `on:dblclick` con el `detail` de abajo
    // (modificadores y objetivo) y, además, el atributo nativo `onclick` con el `MouseEvent`.
    // Los padres no se reescriben a callbacks: AGENTS.md prohíbe migrar a runes de forma masiva.
    import { createEventDispatcher, type Snippet } from "svelte"
    import type { HTMLButtonAttributes } from "svelte/elements"
    import Icon from "../../../../components/helpers/Icon.svelte"
    import { dictionary } from "../../../../stores"
    import { translateText } from "../../../../utils/language"

    export interface ButtonClickDetail {
        ctrl: boolean
        shift: boolean
        alt: boolean
        doubleClick: boolean
        target: EventTarget
    }

    interface Props extends HTMLButtonAttributes {
        /** `ghost` por defecto: es lo que casi toda la interfaz usa. `live` = Audiencia/Stage (rojo mientras `aria-pressed`). */
        variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link" | "live"
        /** 24 · 28 (por defecto, compacto) · 32 (formularios) · cuadrados de 28 y 24. */
        size?: "xs" | "sm" | "md" | "icon" | "icon-sm"
        title?: string
        info?: string
        icon?: string
        iconSize?: number
        /** Íconos en `currentColor` (por defecto, cuando el botón no tiene texto). */
        white?: boolean
        isActive?: boolean
        showOutline?: boolean
        /** Pestaña vertical: barra de 2 px a la izquierda cuando está activa. */
        tab?: boolean
        /** Texto y borde rojos (peligro). */
        red?: boolean
        /** Fondo rojo sólo al pasar el mouse (quitar). */
        redHover?: boolean
        bold?: boolean
        /** Alineación del contenido; `start` para botones tipo fila. */
        align?: "center" | "start"
        children?: Snippet
    }

    let { variant = "ghost", size = "sm", title = "", info = "", icon = "", iconSize = 1, children, white = !children, isActive = false, showOutline = false, tab = false, red = false, redHover = false, bold = false, align = "center", disabled = false, class: className = "", style = "", onclick: onclickProp, ...restProps }: Props = $props()

    let button = $state<HTMLButtonElement | null>(null)

    const dispatch = createEventDispatcher<{
        click: ButtonClickDetail
        dblclick: ButtonClickDetail
    }>()

    function click(e: MouseEvent, double = false) {
        const targetElem = e.target as HTMLElement | null
        if (targetElem?.closest(".edit")) return
        if (targetElem?.closest("button") !== button) return

        // defocus button to avoid accidental space/enter presses
        if (document.activeElement?.tagName === "BUTTON") {
            ;(document.activeElement as HTMLElement)?.blur()
        }

        dispatch(double ? "dblclick" : "click", { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey, doubleClick: e.detail === 2, target: e.target as EventTarget })
    }

    function handleClick(e: MouseEvent) {
        onclickProp?.(e as MouseEvent & { currentTarget: EventTarget & HTMLButtonElement })
        click(e)
    }

    function handleKey(e: KeyboardEvent) {
        if (disabled || !button) return
        const targetElem = e.target as HTMLElement | null
        if (targetElem?.closest("button") !== button) return

        if (e.key === "Enter" || e.key === " ") click(e as unknown as MouseEvent)
    }
</script>

<button data-title={title ? translateText(title, $dictionary) : undefined} {...restProps} bind:this={button} class="btn {variant} {size} {className}" class:isActive class:showOutline class:white class:tab class:red class:redHover class:bold class:start={align === "start"} class:iconOnly={!children && !!icon} tabindex={disabled ? -1 : 0} aria-disabled={disabled} {disabled} {style} onkeydown={handleKey} onclick={handleClick} ondblclick={(e) => click(e, true)}>
    {#if icon}
        <Icon id={icon} size={iconSize} white={white || isActive || variant === "default"} />
    {/if}

    {@render children?.()}

    {#if info}
        <span class="info">{info}</span>
    {/if}
</button>

<style>
    /* En la capa `components`: las utilidades de Tailwind (`w-full`, `justify-start`) y los CSS de los padres le ganan. */
    @layer components {
        .btn {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-sizing: border-box;
            min-height: 28px;
            padding: 0 12px;
            border: 1px solid transparent;
            border-radius: var(--radius);
            background: transparent;
            color: var(--text);
            font-family: inherit;
            font-size: var(--text-sm);
            font-weight: 500;
            white-space: nowrap;
            cursor: pointer;
            user-select: none;
            appearance: none;
            outline: none;
            overflow: hidden;
            transition:
                background-color 0.12s ease-out,
                border-color 0.12s ease-out,
                color 0.12s ease-out,
                opacity 0.12s ease-out;
        }
        .btn.start {
            justify-content: flex-start;
        }
        .btn.bold {
            font-weight: 600;
        }

        /* tamaños */
        .btn.xs {
            min-height: 24px;
            padding: 0 8px;
            font-size: var(--text-xs);
        }
        .btn.md {
            min-height: 32px;
        }
        .btn.icon {
            min-width: 28px;
            min-height: 28px;
            padding: 0;
        }
        .btn.icon-sm {
            min-width: 24px;
            min-height: 24px;
            padding: 0;
        }
        .btn.iconOnly {
            padding: 0 7px;
        }
        .btn.xs.iconOnly {
            padding: 0 5px;
        }

        /* variantes */
        .btn.default {
            background: var(--action);
            color: var(--action-text);
        }
        .btn.default:hover:not(:disabled) {
            background: var(--action-hover);
        }
        .btn.secondary {
            background: var(--bg-active);
        }
        .btn.secondary:hover:not(:disabled) {
            background: var(--bg-selected);
        }
        .btn.outline {
            border-color: var(--border-strong);
        }
        .btn.outline:hover:not(:disabled),
        .btn.ghost:hover:not(:disabled) {
            background: var(--bg-hover);
        }
        .btn.link {
            padding-inline: 0;
        }
        .btn.link:hover:not(:disabled) {
            text-decoration: underline;
            text-underline-offset: 4px;
        }
        .btn.live {
            border-color: var(--border);
        }
        .btn.live:hover:not(:disabled) {
            background: var(--bg-hover);
        }
        .btn.live[aria-pressed="true"] {
            color: var(--danger);
            border-color: var(--danger-border);
        }

        /* peligro: texto y borde rojos, nunca relleno (el blanco sobre rojo no pasa AA) */
        .btn.destructive,
        .btn.red {
            background: transparent;
            color: var(--danger);
            border-color: var(--danger-border);
        }
        .btn.destructive:hover:not(:disabled),
        .btn.red:hover:not(:disabled),
        .btn.redHover:hover:not(:disabled) {
            background: var(--red);
        }

        /* estados */
        .btn.isActive {
            background: var(--bg-active);
            cursor: default;
        }
        .btn.tab {
            justify-content: space-between;
            border-radius: 0;
            border-left: 2px solid transparent;
        }
        .btn.tab.isActive {
            border-left-color: var(--text);
        }
        .btn.showOutline {
            outline: 1px solid var(--ring);
            outline-offset: -1px;
        }
        .btn:focus-visible:not(:disabled) {
            outline: 1px solid var(--ring);
            outline-offset: 2px;
        }
        .btn:disabled {
            opacity: 0.5;
            pointer-events: none;
        }

        .btn.white :global(svg) {
            fill: currentColor;
        }
        .info {
            opacity: 0.7;
            font-size: 0.9em;
            margin-inline-start: 2px;
            font-weight: normal;
        }
    }
</style>

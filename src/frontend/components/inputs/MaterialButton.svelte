<script lang="ts">
    import { createEventDispatcher, type Snippet } from "svelte"
    import type { HTMLButtonAttributes } from "svelte/elements"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { dictionary } from "../../stores"

    interface CustomClickDetail {
        ctrl: boolean
        shift: boolean
        alt: boolean
        doubleClick: boolean
        target: EventTarget | null
    }

    interface Props extends HTMLButtonAttributes {
        variant?: "contained" | "outlined" | "text"
        title?: string
        info?: string
        icon?: string
        iconSize?: number
        white?: boolean
        isActive?: boolean
        showOutline?: boolean
        disabled?: boolean
        gradient?: boolean
        small?: boolean
        tab?: boolean
        red?: boolean
        children?: Snippet
    }

    let { variant = "text", title = "", info = "", icon = "", iconSize = 1, children, white = !children, isActive = false, showOutline = false, disabled = false, gradient = false, small = false, tab = false, red = false, class: className = "", style = "", ...restProps }: Props = $props()

    let button = $state<HTMLButtonElement | null>(null)
    let ripples = $state<{ x: number; y: number; size: number; id: number }[]>([])

    const dispatch = createEventDispatcher<{
        click: CustomClickDetail
        dblclick: CustomClickDetail
    }>()

    function click(e: MouseEvent, double = false) {
        const targetElem = e.target as HTMLElement | null
        if (targetElem?.closest(".edit")) return
        if (targetElem?.closest("button") !== button) return

        const ctrl = e.ctrlKey || e.metaKey
        const shift = e.shiftKey
        const alt = e.altKey
        const doubleClick = e.detail === 2
        const target = e.target

        // defocus button to avoid accidental space/enter presses
        if (document.activeElement?.tagName === "BUTTON") {
            ;(document.activeElement as HTMLElement)?.blur()
        }

        dispatch(double ? "dblclick" : "click", { ctrl, shift, alt, doubleClick, target })
    }

    function dblclick(e: MouseEvent) {
        click(e, true)
    }

    function triggerRipple(e: MouseEvent) {
        if (disabled || !button) return
        const targetElem = e.target as HTMLElement | null
        if (targetElem?.closest(".edit")) return
        if (targetElem?.closest("button") !== button) return

        const rect = button.getBoundingClientRect()
        const size = Math.max(rect.width, rect.height)
        const x = (e.clientX ?? rect.width / 2) - rect.left - size / 2
        const y = (e.clientY ?? rect.height / 2) - rect.top - size / 2

        const ripple = {
            x,
            y,
            size,
            id: Date.now() + Math.random()
        }

        ripples = [...ripples, ripple]
    }

    function handleKey(e: KeyboardEvent) {
        if (disabled || !button) return
        const targetElem = e.target as HTMLElement | null
        if (targetElem?.closest("button") !== button) return

        if (e.key === "Enter" || e.key === " ") {
            click(e as unknown as MouseEvent)
        }
    }

    function handleAnimationEnd(id: number) {
        ripples = ripples.filter((r) => r.id !== id)
    }
</script>

<button
    {...restProps}
    bind:this={button}
    class="{variant} {className}"
    tabindex={disabled ? -1 : 0}
    aria-disabled={disabled}
    data-title={translateText(title, $dictionary)}
    class:isActive
    class:showOutline
    class:white
    class:small
    class:tab
    class:red
    {disabled}
    style="
    background: {variant === 'contained' ? (gradient ? 'linear-gradient(160deg, #8000f0 0%, #9000f0 10%, #b300f0 30%, #d100db 50%, #f0008c 100%)' : 'var(--secondary)') : variant === 'outlined' ? 'var(--primary-darkest)' : 'transparent'};
    color: {variant === 'contained' ? 'var(--secondary-text)' : white ? 'var(--text)' : 'var(--text)'};
    border-color: {white ? 'rgb(255 255 255 / 0.08)' : variant === 'outlined' ? 'var(--primary-lighter)' : 'transparent'};
    {style}
  "
    onmousedown={triggerRipple}
    onkeydown={handleKey}
    onclick={click}
    ondblclick={dblclick}
>
    {#if icon}
        <Icon id={icon} size={iconSize} white={white || isActive || variant === "contained"} />
    {/if}

    {@render children?.()}

    {#if info}
        <span class="info">{info}</span>
    {/if}

    {#each ripples as { x, y, size, id } (id)}
        <span class="ripple" style="top: {y}px; left: {x}px; width: {size}px; height: {size}px;" onanimationend={() => handleAnimationEnd(id)} />
    {/each}
</button>

<style>
    button {
        position: relative;
        overflow: hidden;
        outline: none;
        border: none;
        padding: 0.75rem 1.25rem;
        /* font-size: 1.05rem; */
        font-size: 0.9em;
        font-weight: 500;
        font-family: inherit;
        border-radius: var(--radius, 6px);
        cursor: pointer;
        transition:
            opacity 0.4s ease,
            box-shadow 0.2s ease,
            background 0.2s ease,
            border 0.1s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        appearance: none;

        gap: 8px;
        white-space: nowrap;

        min-height: 25px;
    }
    button.small {
        padding: 0.25rem 1.25rem;
        font-size: 0.9em;
    }

    button.isActive {
        background-color: var(--primary-darkest) !important;
        /* background-color: var(--primary-lighter) !important; */
        border-bottom: 2px solid var(--secondary) !important;
        cursor: default;
    }

    button.tab.isActive {
        border: none !important;
        border-left: 4px solid var(--secondary) !important;
    }
    button.tab:not(.outlined) {
        border-left: 4px solid var(--primary-darker);
        border-radius: 0;

        justify-content: space-between;
    }

    button.showOutline {
        --outline-color: var(--secondary);
        outline: 2px solid var(--outline-color);
        outline-offset: -2px;
    }

    button:not(.contained):not(.isActive):not(:disabled):hover {
        background: var(--bg-hover) !important;
    }
    button:not(.contained):not(.isActive):not(:disabled):active {
        background: var(--bg-hover) !important;
    }
    button:not(.contained):not(.isActive):not(:disabled):active:hover {
        background: var(--bg-hover) !important;
    }
    button.contained:not(:disabled):hover {
        filter: brightness(1.05);
    }
    button.contained:not(:disabled):active {
        filter: brightness(1.09);
    }
    button.contained:not(:disabled):active:hover {
        filter: brightness(1.13);
    }

    button.contained {
        color: var(--secondary-text);
        filter: saturate(0.8);
    }

    button.outlined {
        background: transparent;
        border: 1px solid currentColor;
    }

    button.text {
        background: transparent;
        color: inherit;
    }

    button:disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    button.contained:disabled {
        background: var(--primary-lighter) !important;
    }
    button:not(.white).outlined:disabled {
        /* border-color: var(--primary-darkest) !important; */
        /* border-color: var(--text) !important; */
        color: var(--text) !important;
    }
    button:not(.white).outlined:disabled :global(svg) {
        fill: var(--text) !important;
    }

    button:hover:not(:disabled) {
        box-shadow: 0px 3px 6px rgba(0, 0, 0, 0.2);
    }

    button:focus-visible:not(:disabled) {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
    }

    button.white :global(svg) {
        fill: currentColor;
    }

    .ripple {
        position: absolute;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.25);
        transform: scale(0);
        animation: ripple 600ms ease-out forwards;
        pointer-events: none;
        will-change: transform, opacity;
    }

    @keyframes ripple {
        to {
            transform: scale(2.5);
            opacity: 0;
        }
    }

    .info {
        opacity: 0.7;
        font-size: 0.9em;
        margin-inline-start: 2px;
        font-weight: normal;
    }

    /* red */

    button.red:not(:disabled) {
        background-color: var(--red) !important;
    }
    button.red:not(.contained):not(.isActive):not(:disabled):hover {
        background: var(--red) !important;
    }
    button.red:not(.contained):not(.isActive):not(:disabled):active {
        background: var(--red) !important;
    }
    button.red:not(.contained):not(.isActive):not(:disabled):active:hover {
        background: var(--red) !important;
    }
</style>

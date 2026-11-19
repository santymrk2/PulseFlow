import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { Option } from "../../../../../types/Main"
import { cn } from "../../../core/lib/utils"
import { dictionary, language } from "../../../core/stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import { useSlide } from "../../helpers/useSlide"
import { triggerClickOnEnterSpace } from "../../helpers/triggerClickOnEnterSpace"
import { useStore } from "../../hooks/useStore"
import styles from "./Dropdown.module.css"

// `on:click` (dispatch "click" con la Option elegida) → onClick(option).
// `transition:slide` (200 ms) con useSlide. Cierra con mousedown afuera, como <svelte:window on:mousedown>.
export interface DropdownProps {
    options: Option[]
    id?: string
    disabled?: boolean
    center?: boolean
    arrow?: boolean
    value: string
    activeId?: string
    title?: string
    flags?: boolean
    up?: boolean
    className?: string
    style?: CSSProperties
    onClick?: (option: Option) => void
}

function formatId(value: string) {
    return "id_" + value?.replace(/[\W_]+/g, "")
}

export function Dropdown({ options, id = "", disabled = false, center = false, arrow = false, value, activeId = "", title = "", flags = false, up = false, className = "", style, onClick }: DropdownProps) {
    useStore(language) // el texto depende del idioma (mismo `$language` del Svelte)
    const dict = useStore(dictionary)
    const [active, setActive] = useState(false)
    const self = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const slide = useSlide<HTMLDivElement>(active, 200)
    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    const normalizedValue = value || options[0]?.name || "—"

    // Wheel nativo y no-pasivo: el onWheel de React es pasivo y no deja hacer preventDefault
    useEffect(() => {
        const el = trigger.current
        if (!el) return

        function wheel(e: WheelEvent) {
            const ctrl = e.ctrlKey || e.metaKey
            if (disabled || arrow || nextScrollTimeout.current || !ctrl) return
            e.preventDefault()

            let index = options.findIndex((a) => (activeId ? a.id === activeId : a.name === value))
            if (e.deltaY > 0) index = Math.min(options.length - 1, index + 1)
            else index = Math.max(0, index - 1)
            onClick?.(options[index])

            // don't start timeout if scrolling with mouse
            if (e.deltaY >= 100 || e.deltaY <= -100) return
            nextScrollTimeout.current = setTimeout(() => {
                nextScrollTimeout.current = null
            }, 500)
        }

        el.addEventListener("wheel", wheel, { passive: false })
        return () => el.removeEventListener("wheel", wheel)
    })

    useEffect(() => {
        function mousedown(e: MouseEvent) {
            const target = e.target instanceof Element ? e.target : null
            if (target?.closest(".dropdownElem") !== self.current) setActive(false)
        }
        window.addEventListener("mousedown", mousedown)
        return () => window.removeEventListener("mousedown", mousedown)
    }, [])

    useEffect(() => {
        if (!active) return
        const optionId = formatId(value)
        if (!optionId) return

        const timeout = setTimeout(() => {
            // dropdown does not have a scroll bar if not much content, return so parent is not scrolled!
            if (!self.current || options.length < 10) return
            self.current.querySelector("#" + optionId)?.scrollIntoView()
        }, 10)
        return () => clearTimeout(timeout)
    }, [active]) // como `$: if (active)` en Svelte: sólo al abrir

    function select(option: Option) {
        if (disabled) return
        setActive(false)
        // allow dropdown to close before updating, so svelte visual bug don't duplicate inputs on close transition in boxstyle edit etc.
        setTimeout(() => onClick?.(option), 50)
    }

    return (
        <div ref={self} className={cn("dropdownElem", styles.root, disabled && styles.disabled, center && styles.center, flags && styles.flags, className)} style={{ position: "relative", ...style }}>
            <button ref={trigger} className={styles.trigger} style={arrow ? { justifyContent: "center" } : undefined} id={id} data-title={title} onClick={() => (disabled ? null : setActive(!active))}>
                {arrow ? <Icon id="expand" size={1.2} white /> : translateText(normalizedValue, dict) || value}
            </button>
            {slide.mounted ? (
                <div ref={slide.ref} className={cn(styles.dropdown, up && styles.up, arrow && styles.arrow)} style={style}>
                    {options.map((option, i) => (
                        <span key={i} id={formatId(option.name)} className={cn(styles.option, (activeId && option?.id ? option.id === activeId : option.name === value) && styles.active)} style={option.style ? cssTextToStyle(option.style) : undefined} role="option" aria-selected={activeId ? option.id === activeId : option.name === value} tabIndex={0} onClick={() => select(option)} onKeyDown={triggerClickOnEnterSpace}>
                            {translateText(option.name, dict) || option.name}
                            {option.extra ? <> ({option.extra})</> : null}
                            {option.extraInfo ? <div className={styles.extra}>{option.extraInfo}</div> : null}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

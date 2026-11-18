import { useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { cn } from "../../../lib/utils"
import { Icon } from "../../helpers/Icon"
import styles from "./Button.module.css"

// Port de ui/button/button.svelte (F14.8a). Contrato de eventos (docs/design/kit.md): onClick y onDblClick reciben
// el `detail` de modificadores y objetivo, y el evento como segundo argumento.
export interface ButtonClickDetail {
    ctrl: boolean
    shift: boolean
    alt: boolean
    doubleClick: boolean
    target: EventTarget
}

// Con teclado (Enter/espacio) el evento es un KeyboardEvent: en Svelte también dispara `click`, y el tipo lo refleja.
export type ButtonEvent = MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>

export const BUTTON_VARIANT = {
    ghost: "ghost",
    default: "default",
    secondary: "secondary",
    outline: "outline",
    destructive: "destructive",
    link: "link",
    live: "live"
} as const
export type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT]

export const BUTTON_SIZE = { xs: "xs", sm: "sm", md: "md", icon: "icon", "icon-sm": "icon-sm" } as const
export type ButtonSize = (typeof BUTTON_SIZE)[keyof typeof BUTTON_SIZE]

export const BUTTON_ALIGN = { center: "center", start: "start" } as const
export type ButtonAlign = (typeof BUTTON_ALIGN)[keyof typeof BUTTON_ALIGN]

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onDoubleClick"> {
    variant?: ButtonVariant
    size?: ButtonSize
    title?: string
    info?: string
    icon?: string
    iconSize?: number
    white?: boolean
    isActive?: boolean
    showOutline?: boolean
    tab?: boolean
    red?: boolean
    redHover?: boolean
    bold?: boolean
    align?: ButtonAlign
    // `onclick=` de Svelte: nativo, sin guarda, se llama antes que onClick
    onNativeClick?: (event: MouseEvent<HTMLButtonElement>) => void
    // `on:click` de Svelte: con guarda (ignora clicks dentro de `.edit` o de un botón anidado) y con `detail`
    onClick?: (detail: ButtonClickDetail, event: ButtonEvent) => void
    onDblClick?: (detail: ButtonClickDetail, event: ButtonEvent) => void
    children?: ReactNode
    className?: string
}

export function Button({ variant = "ghost", size = "sm", title = "", info = "", icon = "", iconSize = 1, children, white = !children, isActive = false, showOutline = false, tab = false, red = false, redHover = false, bold = false, align = "center", disabled = false, className, style, onNativeClick, onClick, onDblClick, ...rest }: ButtonProps) {
    const button = useRef<HTMLButtonElement>(null)
    // El aro de foco es sólo para teclado: al volver de un diálogo nativo el foco queda con :focus-visible
    const [pointerFocus, setPointerFocus] = useState(false)

    function dispatch(event: ButtonEvent, double: boolean) {
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest(".edit")) return
        if (target?.closest("button") !== button.current) return

        // Desenfoca el botón para que un Enter o espacio posterior no lo vuelva a disparar por accidente
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()

        const detail: ButtonClickDetail = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey, alt: event.altKey, doubleClick: event.detail === 2, target: event.target }
        if (double) onDblClick?.(detail, event)
        else onClick?.(detail, event)
    }

    // Mismo orden que handleClick de button.svelte: primero el nativo sin guarda, después el despacho con guarda
    function handleClick(event: MouseEvent<HTMLButtonElement>) {
        onNativeClick?.(event)
        dispatch(event, false)
    }

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        setPointerFocus(false)
        if (disabled || !button.current) return
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest("button") !== button.current) return

        if (event.key === "Enter" || event.key === " ") dispatch(event, false)
    }

    return (
        <button
            {...rest}
            ref={button}
            title={title || undefined}
            data-title={title || undefined}
            className={cn(styles.btn, styles[variant === "outline" ? "outlined" : variant], styles[size], className, pointerFocus && styles.pointerFocus, isActive && styles.isActive, isActive && "isActive", showOutline && styles.showOutline, white && styles.white, tab && styles.tab, red && styles.red, redHover && styles.redHover, bold && styles.bold, align === "start" && styles.start, !children && icon && styles.iconOnly)}
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            disabled={disabled}
            style={style}
            onKeyDown={handleKeyDown}
            onPointerDown={() => setPointerFocus(true)}
            onBlur={() => setPointerFocus(false)}
            onClick={handleClick}
            onDoubleClick={(event) => dispatch(event, true)}
        >
            {icon ? <Icon id={icon} size={iconSize} white={white || isActive || variant === "default"} /> : null}
            {children}
            {info ? <span className={styles.info}>{info}</span> : null}
        </button>
    )
}

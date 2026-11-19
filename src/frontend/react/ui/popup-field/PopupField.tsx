import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react"
import type { Popups } from "../../../../types/Main"
import { cn } from "../../../shared/core/lib/utils"
import { activePopup, popupData } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { Icon } from "../../helpers/Icon"
import { Button } from "../button/Button"
import styles from "./PopupField.module.css"

// dispatch("change", any) → onChange(any) (null al borrar, defaultValue al restablecer, el valor
// previo al deshacer, lo que mande el popup vía `trigger`). Abre `popupId` con los mismos stores: popupData = { ...data, active: value, id, trigger }
// y activePopup = popupId, o llama a `openEvent` si existe. Sin useStore(dictionary): el Svelte tampoco se suscribe.
export interface PopupFieldProps<T> {
    id?: string
    label: string
    value: T
    defaultValue?: T | null
    name: string
    icon?: string
    data?: Record<string, unknown> | null
    popupId: Popups
    openEvent?: (() => void) | null
    disabled?: boolean
    allowEmpty?: boolean
    style?: CSSProperties
    onChange?: (value: T | null) => void
}

export function PopupField<T>({ id = "", label, value, defaultValue = null, name, icon = "", data = null, popupId, openEvent = null, disabled = false, allowEmpty = false, style, onChange }: PopupFieldProps<T>) {
    const [resetFromValue, setResetFromValue] = useState<T | null>(null)
    // `trigger` vive en popupData mientras el popup esté abierto: llama siempre al onChange más reciente
    const latest = useRef(onChange)
    useEffect(() => {
        latest.current = onChange
    })

    function openPopup() {
        if (disabled) return

        if (openEvent) {
            openEvent()
            return
        }

        popupData.set({ ...(data || {}), active: value, id, trigger: (newValue: T) => latest.current?.(newValue) })
        activePopup.set(popupId)
    }

    // SELECT

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (disabled) return

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openPopup()
        }
    }

    function handleClick(event: MouseEvent<HTMLDivElement>) {
        if ((event.target as Element).closest(".remove")) return
        openPopup()
    }

    // RESET

    function reset() {
        setResetFromValue(value)
        onChange?.(defaultValue)
        setTimeout(() => setResetFromValue(null), 3000)
    }

    function undoReset() {
        onChange?.(resetFromValue)
        setResetFromValue(null)
    }

    return (
        <div id={id} className={cn("textfield", styles.textfield, disabled && styles.disabled)} data-title={translateText(`popup.${popupId}`)} style={style}>
            <div className={styles.background} />

            <div className={cn("input", "edit", styles.input, styles.buttonTrigger)} role="button" tabIndex={disabled ? undefined : 0} onClick={handleClick} onKeyDown={handleKeyDown}>
                <span className={styles.selectedText} data-title={value ? translateText(name) : ""} {...(value && name ? { dangerouslySetInnerHTML: { __html: translateText(name) } } : {})}>
                    {value && !name ? <span style={{ opacity: 0.7, fontStyle: "italic" }}>{translateText("main.unnamed")}</span> : null}
                </span>

                <div className={styles.arrow}>
                    {icon ? (
                        <Icon id={icon} white />
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 0h24v24H0z" fill="none" />
                            <path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z" />
                        </svg>
                    )}
                </div>
            </div>

            <label className={cn(styles.label, value && styles.selected)}>{translateText(label)}</label>
            <span className={styles.underline} />

            {allowEmpty && value && !disabled ? (
                <div className={cn("remove", styles.remove)}>
                    <Button disabled={disabled} onClick={() => onChange?.(null)} title="clear.general" white>
                        <Icon id="close" white />
                    </Button>
                </div>
            ) : null}
            {defaultValue ? (
                <div className={cn("remove", styles.remove)}>
                    {JSON.stringify(value) !== JSON.stringify(defaultValue) ? (
                        <Button disabled={disabled} onClick={reset} title="actions.reset" white>
                            <Icon id="reset" white />
                        </Button>
                    ) : resetFromValue ? (
                        <Button onClick={undoReset} title="actions.undo" white>
                            <Icon id="undo" white />
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}

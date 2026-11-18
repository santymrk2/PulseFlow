import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react"
import { uid } from "uid"
import { cn } from "../../../lib/utils"
import { addOpacityToGradient, getGradientOpacity } from "../../../components/edit/scripts/edit"
import { defaultColors, defaultGradients, getContrast, hexToRgb, rgbToHex, splitRgb } from "../../../components/helpers/color"
import { activePopup, popupData, special } from "../../../stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { useDerivedState } from "../../hooks/useDerivedState"
import { useFreshStore } from "../../hooks/useFreshStore"
import { Tabs } from "../../main/Tabs"
import { Button } from "../button/Button"
import { NumberField } from "../number-field/NumberField"
import { BLACK, rgbWithAlpha } from "./colorData"
import styles from "./ColorField.module.css"

// Port de ui/color-field/color-field.svelte. dispatch("change", string) → onChange(string); dispatch("input", string) → onInput(string).
// Elegir un color despacha change y luego input. El selector nativo (<input type="color">) despacha input por tecla y change NATIVO, como `on:input`/`on:change`.
// `hexValue` y `opacity` son locales y se recalculan desde `value` cuando el padre lo cambia (el `$: hexValue = getHexValue(value)` del original).
// Stores: lee `special`; escribe popupData y activePopup ("color_gradient", y "manage_colors" de vuelta en editMode) con lo mismo que el Svelte.
// La barra de pestañas usa el port React (P11c): `onActiveChange` reemplaza la deducción del botón pulsado.
// Las listas de colores no tenían key en el Svelte: se usa la posición.
export interface ColorFieldProps {
    value?: string
    defaultValue?: string
    label: string
    noLabel?: boolean
    allowGradients?: boolean
    allowOpacity?: boolean
    allowEmpty?: boolean
    alwaysVisible?: boolean
    editMode?: boolean
    disabled?: boolean
    height?: number
    width?: number
    style?: CSSProperties
    onChange?: (value: string) => void
    onInput?: (value: string) => void
}

interface ColorItem {
    name: string
    value: string
}
type ListItem = ColorItem | "BREAK"
interface LocalColor {
    hexValue: string
    opacity: number
}

const TABS = { normal: { name: "color.normal", icon: "color" }, gradient: { name: "color.gradient", icon: "gradient" } }
const TABS_STYLE = "flex: 1;border-top-left-radius: 8px;border-top-right-radius: 8px;"

function getHexValue(value: string): LocalColor {
    if (typeof value !== "string") return { hexValue: BLACK, opacity: 100 }

    if (value.includes("gradient")) return { hexValue: value, opacity: getGradientOpacity(value) * 100 }

    if (value.startsWith("#")) return { hexValue: value, opacity: 100 }
    if (value.includes("rgb")) return { hexValue: rgbToHex(value), opacity: splitRgb(value).a * 100 }

    return { hexValue: value, opacity: 100 }
}

function getCurrentMode(value: string) {
    if (typeof value === "string" && value.includes("gradient")) return "gradient"
    return "normal"
}

interface ColorLists {
    customColors?: string[]
    disabledColors?: string[]
    customColorsGradient?: string[]
    disabledColorsGradient?: string[]
}

// sólo las cuatro listas que se leen (no todo `special`: hay decenas de campos de color montados a la vez)
function copyColorLists(value: ColorLists): ColorLists {
    return { customColors: [...(value.customColors ?? [])], disabledColors: [...(value.disabledColors ?? [])], customColorsGradient: [...(value.customColorsGradient ?? [])], disabledColorsGradient: [...(value.disabledColorsGradient ?? [])] }
}

export function ColorField({ value = BLACK, defaultValue = "", label, noLabel = false, allowGradients = false, allowOpacity = false, allowEmpty = false, alwaysVisible = false, editMode = false, disabled = false, height = 0, width = 0, style, onChange, onInput }: ColorFieldProps) {
    const sp = useFreshStore(special, copyColorLists) // ManageColors muta estos arrays en el lugar: cada emisión entrega copias de los que se leen
    const colorElem = useRef<HTMLDivElement>(null)
    const colorInput = useRef<HTMLInputElement>(null)
    const [pickerId] = useState(() => "picker_" + uid())
    const [{ hexValue, opacity }, setLocal] = useDerivedState(value, getHexValue)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [resetFromValue, setResetFromValue] = useState("")
    const [isOverflowing, setIsOverflowing] = useState(false)
    // `$: selectedMode = allowGradients ? getCurrentMode(hexValue) : "normal"`: se recalcula al cambiar hexValue o allowGradients; la pestaña pulsada manda hasta entonces
    const [selectedMode, setSelectedMode] = useDerivedState<string, string>(`${allowGradients}|${hexValue}`, () => (allowGradients ? getCurrentMode(hexValue) : "normal"))

    // Opacidad: timers del debounce y bandera `mounted` (en el Svelte son variables sueltas, no estado)
    const mounted = useRef(false)
    const updated = useRef<ReturnType<typeof setTimeout> | null>(null)
    const gotUpdate = useRef(false)

    // hexValue y opacity se asignan y se leen en el mismo evento (p. ej. `opacity = 100; selectColor("")`): se leen de `live`, que las asignaciones actualizan al instante
    const live = useRef({ hexValue, opacity })
    function assign(patch: Partial<LocalColor>) {
        live.current = { ...live.current, ...patch }
        setLocal(live.current)
    }

    function colorUpdate(color: string | null, clicked: boolean = false) {
        if (typeof color !== "string") return BLACK
        if (editMode) return color

        assign({ hexValue: color })
        let actualValue = color

        if (live.current.opacity === 0 && clicked) assign({ opacity: 100 })
        if (allowOpacity && live.current.opacity < 100) {
            if (color.includes("gradient")) actualValue = addOpacityToGradient(color, live.current.opacity / 100)
            else {
                const rgb = hexToRgb(color)
                actualValue = rgbWithAlpha(rgb, live.current.opacity / 100)
            }
        }

        if (clicked && actualValue === value) assign({ opacity: 100 }) // reset when clicking the active color

        return actualValue
    }

    function selectColor(c: string | null, close = true, clicked = false) {
        const actualValue = colorUpdate(c, clicked)

        onChange?.(actualValue)
        onInput?.(actualValue)

        if (close) setPickerOpen(false)
    }

    function togglePicker() {
        if (disabled) return
        setPickerOpen(!pickerOpen)
    }

    // Los listeners nativos, el trigger del popup y los timers viven fuera del render y leen siempre lo último
    function mousedown(e: globalThis.MouseEvent) {
        const target = e.target as Element
        if (target.closest("#" + pickerId) || (target.closest(".colorpicker") && !target.closest(".pickColor"))) return
        if (target.closest(".color")) return

        setPickerOpen(false)
    }

    function nativeChange(newValue: string) {
        onChange?.(colorUpdate(newValue))
    }

    function opacityChanged() {
        if (!allowOpacity || !mounted.current) return

        if (updated.current) {
            gotUpdate.current = true
            return
        }

        updated.current = setTimeout(() => {
            latest.current.selectColor(live.current.hexValue, false)
            updated.current = null
            if (gotUpdate.current) {
                gotUpdate.current = false
                latest.current.opacityChanged()
            }
        }, 50)
    }

    const latest = useRef({ selectColor, mousedown, nativeChange, opacityChanged })
    useEffect(() => {
        live.current = { hexValue, opacity }
        latest.current = { selectColor, mousedown, nativeChange, opacityChanged }
    })

    // `<svelte:window on:mousedown>`
    useEffect(() => {
        const handler = (e: globalThis.MouseEvent) => latest.current.mousedown(e)
        window.addEventListener("mousedown", handler)
        return () => window.removeEventListener("mousedown", handler)
    }, [])

    // `$: if (value) remount()`: tras un cambio de value, el reenvío de opacidad espera al siguiente tick
    useEffect(() => {
        if (!value) return
        mounted.current = false
        setTimeout(() => (mounted.current = true))
    }, [value])

    // `$: if (opacity !== undefined) opacityChanged()`
    useEffect(() => {
        opacityChanged()
    }, [opacity])

    // onMount
    useEffect(() => {
        mounted.current = true

        const el = colorElem.current
        if (!el) return
        setIsOverflowing(el.getBoundingClientRect().left + el.clientWidth / 2 + 200 > window.innerWidth)
    }, [])

    // El selector nativo: `bind:value={hexValue}` (el DOM sigue a hexValue) y `on:change` (evento nativo; el onChange de React dispararía por tecla)
    const hasNativePicker = (pickerOpen || alwaysVisible) && selectedMode !== "gradient"
    useEffect(() => {
        const el = colorInput.current
        if (!el) return
        if (el.value !== hexValue) el.value = hexValue
    }, [hexValue, hasNativePicker])
    useEffect(() => {
        const el = colorInput.current
        if (!el) return
        const change = () => latest.current.nativeChange(el.value)
        el.addEventListener("change", change)
        return () => el.removeEventListener("change", change)
    }, [hasNativePicker])

    function handleNativeInput(e: FormEvent<HTMLInputElement>) {
        const newValue = e.currentTarget.value
        assign({ hexValue: newValue }) // bind:value
        onInput?.(colorUpdate(newValue))
    }

    function reset() {
        setResetFromValue(hexValue)
        selectColor(defaultValue)
        setTimeout(() => setResetFromValue(""), 3000)
    }

    function undoReset() {
        selectColor(resetFromValue)
        setResetFromValue("")
    }

    function handleKey(event: KeyboardEvent<HTMLDivElement>) {
        if (disabled) return
        const target = event.target as Element

        if (event.key === "Escape") {
            if (!pickerOpen) return
            event.preventDefault()
            setPickerOpen(false)
            setTimeout(() => document.getElementById(pickerId)?.focus())
            return
        }

        if (event.key === "Enter" || event.key === " ") {
            const picker = target.closest(".colorpicker")
            if (picker) return

            const pickColor = target.closest(".pickColor")
            if (pickColor) {
                selectColor(pickColor.getAttribute("data-value"))
                document.getElementById(pickerId)?.focus()
                return
            }

            togglePicker()
        }
    }

    // GRADIENTS

    const disabledColors: string[] = sp.disabledColors || []
    const disabledGradientColors: string[] = sp.disabledColorsGradient || []

    const customColors: ColorItem[] = (sp.customColors || []).map((value: string) => ({ name: "", value }))
    let colorsList: ListItem[] = editMode ? [...defaultColors, "BREAK", ...customColors] : [...defaultColors, ...customColors]
    if (!editMode) colorsList = colorsList.filter((a) => a !== "BREAK" && !disabledColors.includes(a.value))

    const customGradients: ColorItem[] = (sp.customColorsGradient || []).map((value: string) => ({ name: "", value }))
    let gradientColorsList: ListItem[] = editMode ? [...defaultGradients, "BREAK", ...customGradients] : [...defaultGradients, ...customGradients]
    if (!editMode) gradientColorsList = gradientColorsList.filter((a) => a !== "BREAK" && !disabledGradientColors.includes(a.value))

    const opacityField = (
        <div className={styles.opacity}>
            <NumberField label="edit.opacity" value={Math.round(opacity)} max={100} onChange={(v) => assign({ opacity: Math.round(v ?? 0) })} showSlider />
        </div>
    )

    const outlineStyle = { "--outline-color": getContrast(hexValue), ...style } as CSSProperties

    return (
        <div id={pickerId} ref={colorElem} className={cn("textfield", styles.textfield, disabled && "disabled", disabled && styles.disabled)} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} style={outlineStyle} onKeyDown={handleKey}>
            {!alwaysVisible ? (
                <>
                    <div className={styles.background} onClick={togglePicker} />

                    <div className={styles.colorDisplay} data-title={`${noLabel ? translateText(label) + (value ? ": " : "") : ""}<i>${value}</i>`} style={{ background: value || "transparent", ...(noLabel ? { marginLeft: "var(--margin)" } : {}) }} onClick={togglePicker}></div>

                    {!noLabel || value === "" ? <label className={styles.label} dangerouslySetInnerHTML={{ __html: translateText(label) }} /> : null}
                    <span className={styles.underline} />
                </>
            ) : null}

            {pickerOpen || alwaysVisible ? (
                <div className={cn(styles.picker, isOverflowing && styles.isOverflowing, alwaysVisible && styles.alwaysVisible)} style={noLabel && !isOverflowing ? { left: 0, transform: "initial" } : undefined}>
                    {allowGradients || editMode ? <Tabs tabs={TABS} active={selectedMode} onActiveChange={setSelectedMode} style={TABS_STYLE} /> : null}

                    <div className={styles.pickerContent}>
                        {selectedMode === "gradient" ? (
                            <>
                                {gradientColorsList.map((color, i) => {
                                    if (color === "BREAK") return <div key={i} style={{ display: "block", margin: "10px", width: "100%" }}></div>

                                    const isCustom = editMode && customGradients.find((a) => a.value === color.value)
                                    const isDisabled = disabledGradientColors.includes(color.value)
                                    return (
                                        <div key={i} className={cn("pickColor", styles.pickColor, !editMode && hexValue === color.value && styles.active, isDisabled && styles.disabled)} data-title={color.name} style={{ background: color.value }} tabIndex={0} aria-label={`Select gradient ${color.name || color.value}`} onClick={() => selectColor(color.value, true, true)}>
                                            {editMode ? (
                                                <div className={cn(styles.hover, isDisabled && styles.visible)}>
                                                    <Icon id={isCustom ? "delete" : "disable"} white style={{ fill: getContrast(color.value) }} />
                                                </div>
                                            ) : null}
                                        </div>
                                    )
                                })}

                                {allowOpacity && value && hexValue.includes("gradient") ? opacityField : null}

                                <Button
                                    className={styles.customButton}
                                    style={{ width: "100%", marginTop: "5px", "--custom-bg": hexValue } as CSSProperties}
                                    onClick={() => {
                                        popupData.set({
                                            value: hexValue,
                                            trigger: (newValue: string) => {
                                                latest.current.selectColor(newValue)
                                                if (editMode) setTimeout(() => activePopup.set("manage_colors"))
                                            }
                                        })
                                        activePopup.set("color_gradient")
                                    }}
                                >
                                    <p style={{ color: "var(--outline-color)", maxWidth: "150px" }}>{translateText("actions." + (editMode ? "add_color" : "choose_custom"))}</p>
                                </Button>
                            </>
                        ) : (
                            <>
                                {allowEmpty ? (
                                    <div
                                        data-value={""}
                                        className={cn("pickColor", "noColor", styles.pickColor, styles.noColor, value === "" && styles.active)}
                                        data-title={translateText("settings.remove")}
                                        tabIndex={0}
                                        onClick={() => {
                                            assign({ opacity: 100 })
                                            selectColor("")
                                        }}
                                    >
                                        <Icon id="close" white />
                                    </div>
                                ) : null}
                                {colorsList.map((color, i) => {
                                    if (color === "BREAK") return <div key={i} style={{ display: "block", margin: "10px", width: "100%" }}></div>

                                    const isCustom = editMode && customColors.find((a) => a.value === color.value)
                                    const isDisabled = disabledColors.includes(color.value)
                                    return (
                                        <div key={i} data-value={color.value} className={cn("pickColor", styles.pickColor, !editMode && hexValue.toLowerCase() === color.value?.toLowerCase() && styles.active, isDisabled && styles.disabled)} data-title={color.name} tabIndex={0} style={{ background: color.value, "--outline-color": getContrast(color.value) } as CSSProperties} onClick={() => selectColor(color.value, true, true)}>
                                            {editMode ? (
                                                <div className={cn(styles.hover, isDisabled && styles.visible)}>
                                                    <Icon id={isCustom ? "delete" : "disable"} white style={{ fill: getContrast(color.value) }} />
                                                </div>
                                            ) : null}
                                        </div>
                                    )
                                })}

                                {allowOpacity && value && !hexValue.includes("gradient") ? opacityField : null}

                                <div className={cn("color", styles.color)} style={{ background: hexValue }}>
                                    <p style={{ color: "var(--outline-color)", maxWidth: "150px" }}>{translateText("actions." + (editMode ? "add_color" : "choose_custom"))}</p>
                                    <input ref={colorInput} className={cn("colorpicker", styles.colorpicker)} style={{ ...(height ? { height: height + "px" } : {}), ...(width ? { width: width + "px" } : {}) }} type="color" defaultValue={hexValue} onInput={handleNativeInput} />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : null}

            {defaultValue ? (
                <div className={cn("remove", styles.remove)}>
                    {hexValue !== defaultValue ? (
                        <Button onClick={reset} title="actions.reset" white>
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

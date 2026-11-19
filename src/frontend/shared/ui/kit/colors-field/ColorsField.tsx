import { useEffect, useRef, useState } from "react"
import { cn } from "../../../core/lib/utils"
import { hexToHSL, hslToHex } from "../../../utils/helpers/color"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { useDerivedState } from "../../hooks/useDerivedState"
import { Button } from "../button/Button"
import { ColorField } from "../color-field/ColorField"
import { InputRow } from "../input-row/InputRow"
import { DEFAULT_GRADIENT_COLORS, WHITE } from "../color-field/colorData"
import styles from "./ColorsField.module.css"

// Port de ui/colors-field/colors-field.svelte. dispatch("input", string[]) → onInput; dispatch("change", string[]) → onChange (siempre juntos: input y luego change,
// con una lista nueva). Los colores del campo salen de `value` (o de 4 por defecto si está vacío) y se editan localmente hasta que el padre pasa otro `value`.
// La lista de colores del menú no tenía key en el Svelte: se usa la posición.
export interface ColorsFieldProps {
    value?: string[]
    label?: string
    disabled?: boolean
    minColors?: number
    maxColors?: number
    onInput?: (value: string[]) => void
    onChange?: (value: string[]) => void
}

const NO_COLORS: string[] = [] // referencia estable: un `[]` nuevo por render reiniciaría la lista local

const toColors = (value: string[]) => (Array.isArray(value) && value.length ? [...value] : [...DEFAULT_GRADIENT_COLORS])

function getNextGradientColor(list: string[]): string {
    if (!list.length) return WHITE
    if (list.length === 1) {
        const hsl = hexToHSL(list[0])
        return hslToHex((hsl.h + 30) % 360, hsl.s || 60, Math.min(85, Math.max(15, hsl.l + 10)))
    }

    const c1 = list[list.length - 2]
    const c2 = list[list.length - 1]

    const hsl1 = hexToHSL(c1)
    const hsl2 = hexToHSL(c2)

    let dh = hsl2.h - hsl1.h
    if (dh > 180) dh -= 360
    if (dh < -180) dh += 360

    const ds = hsl2.s - hsl1.s
    const dl = hsl2.l - hsl1.l

    if (Math.abs(dh) < 1 && Math.abs(ds) < 1 && Math.abs(dl) < 1) {
        dh = 30
    }

    const nextH = (hsl2.h + dh + 360) % 360
    const nextS = Math.min(100, Math.max(5, hsl2.s + ds))
    const nextL = Math.min(95, Math.max(5, hsl2.l + dl))

    return hslToHex(nextH, nextS, nextL)
}

export function ColorsField({ value = NO_COLORS, label = "", disabled = false, minColors = 1, maxColors = 99, onInput, onChange }: ColorsFieldProps) {
    const [colors, setColors] = useDerivedState(value, toColors)
    const [open, setOpen] = useState(false)

    // Dos eventos seguidos (input y change) leen la lista ya actualizada
    const latest = useRef(colors)
    useEffect(() => {
        latest.current = colors
    })

    const gradientPreview = colors.length > 1 ? `linear-gradient(90deg, ${colors.join(", ")})` : colors[0] || WHITE

    function commit(next: string[]) {
        latest.current = next
        setColors(next)
        const emitted = [...next]
        onInput?.(emitted)
        onChange?.(emitted)
    }

    function updateColor(index: number, newColor: string) {
        if (disabled) return
        const next = [...latest.current]
        next[index] = newColor
        commit(next)
    }

    function addColor() {
        if (disabled || latest.current.length >= maxColors) return
        commit([...latest.current, getNextGradientColor(latest.current)])
    }

    function removeColor(index: number) {
        if (disabled || latest.current.length <= minColors) return
        const next = [...latest.current]
        next.splice(index, 1)
        commit(next)
    }

    return (
        <div className={cn("colors-input", styles.colorsInput, disabled && "disabled", disabled && styles.disabled)}>
            <InputRow
                arrow
                open={open}
                onOpenChange={setOpen}
                menu={
                    <>
                        {colors.map((color, i) => (
                            <InputRow key={i}>
                                <ColorField label={`${translateText("edit.color")} ${i + 1}`} value={color} onInput={(v) => updateColor(i, v)} onChange={(v) => updateColor(i, v)} allowOpacity />
                                {colors.length > minColors ? (
                                    <Button title="actions.delete" onClick={() => removeColor(i)}>
                                        <Icon id="delete" white />
                                    </Button>
                                ) : null}
                            </InputRow>
                        ))}

                        {colors.length < maxColors ? (
                            <Button variant="outline" icon="add" style={{ width: "100%", borderRadius: 0, padding: "8px", justifyContent: "center", backgroundColor: "var(--primary-darkest)" }} title="actions.add" onClick={addColor}>
                                <span style={{ fontSize: "var(--text-xs)" }}>{translateText("actions.add_color")}</span>
                            </Button>
                        ) : null}
                    </>
                }
            >
                <div className={styles.mainBar} onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === "Enter" && setOpen(!open)} role="button" tabIndex={0}>
                    <span className={styles.label}>{translateText(label || "settings.colors")}</span>
                    <div className={styles.gradientPreview} style={{ background: gradientPreview }}></div>
                </div>
            </InputRow>
        </div>
    )
}

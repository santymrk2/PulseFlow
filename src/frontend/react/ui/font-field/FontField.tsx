import { useEffect, useState, type CSSProperties } from "react"
import { get } from "svelte/store"
import type { DropdownOptions } from "../../../../types/Input"
import type { CustomFont } from "../../../../types/Show"
import { getFontName, getFontStyleList, getSystemFontsList, mergeCustomFonts } from "../../../components/helpers/fonts"
import { customFonts } from "../../../stores"
import { usePropState } from "../../hooks/usePropState"
import { InputRow } from "../input-row/InputRow"
import { SelectField } from "../select-field/SelectField"

// Port de ui/font-field/font-field.svelte. dispatch("change", string | null) → onChange (detalle del SelectField); dispatch("fontStyle", string) → onFontStyle.
// La lista se arma una vez al montar (como onMount); los estilos se recalculan sólo cuando cambian `value` o `enableFontStyles` (el `$:` del original).
export interface FontFieldProps {
    label: string
    value: string
    fontStyleValue?: string
    enableFontStyles?: boolean
    allowEmpty?: boolean
    customLocalFonts?: CustomFont[]
    style?: CSSProperties
    onChange?: (value: string | null) => void
    onFontStyle?: (value: string) => void
}

export function FontField({ label, value, fontStyleValue: fontStyleProp = "", enableFontStyles = false, allowEmpty = false, customLocalFonts = [], style, onChange, onFontStyle }: FontFieldProps) {
    const [allFontsList, setAllFontsList] = useState<DropdownOptions>([])
    const [fontsStylesList, setFontsStylesList] = useState<DropdownOptions>([])
    const [defaultFontStyleValue, setDefaultFontStyleValue] = useState("")
    const [fontStyleValue, setFontStyleValue] = usePropState(fontStyleProp)

    useEffect(() => {
        let alive = true
        getSystemFontsList().then((systemFontsList) => {
            if (alive) setAllFontsList(mergeCustomFonts(systemFontsList, [...get(customFonts), ...customLocalFonts]))
        })
        return () => {
            alive = false
        }
    }, [])

    // `$: if (value && enableFontStyles) updateStyles()`
    useEffect(() => {
        if (!value || !enableFontStyles) return
        const { fontStyles, defaultValue } = getFontStyleList(value)
        setFontsStylesList(fontStyles)
        setDefaultFontStyleValue(defaultValue)
    }, [value, enableFontStyles])

    function change(detail: string | null) {
        setFontStyleValue("")
        onChange?.(detail)
    }

    function styleChange(detail: string | null) {
        setFontStyleValue(detail as string)
        onFontStyle?.(detail as string)
    }

    const fontStylesVisible = enableFontStyles && value !== "CMGSans"
    const quotedValue = getFontName(value)

    return (
        <InputRow style={style}>
            <SelectField label={label} options={allFontsList} value={quotedValue} style={fontStylesVisible ? { maxWidth: "85%" } : undefined} onChange={change} allowEmpty={allowEmpty} />
            {fontStylesVisible ? <SelectField label="settings.font_style" disabled={fontsStylesList.length < 2} options={fontsStylesList} value={fontStyleValue || defaultFontStyleValue} onChange={styleChange} onlyArrow /> : null}
        </InputRow>
    )
}

import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { splitGradientValue } from "../../shared/utils/helpers/color"
import { activePopup, popupData } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { setPopupSubmit } from "../../shared/utils/popup"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { ColorField } from "../ui/color-field/ColorField"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { RadialField } from "../ui/radial-field/RadialField"
import { SelectField } from "../ui/select-field/SelectField"
import styles from "./ColorGradient.module.css"

// Port de components/main/popups/ColorGradient.svelte. Lee: popupData.value (al montar; sin "gradient" usa DEFAULT) y popupData.trigger (al guardar).
// Escribe: trigger(newValue) si existe, popupData = {} y activePopup = null (botón o Enter).
// parsedValue era un objeto mutado en el lugar (propio, sin alias de store): aquí se actualiza por copia. Las filas de colores no tenían key: se usa la posición.
const DEFAULT = "linear-gradient(120deg, rgb(255 128 212) 0%, rgb(193 47 106) 62%, rgb(167 19 45) 100%)"

type ParsedGradient = ReturnType<typeof splitGradientValue>

function loadGradient(): ParsedGradient {
    let value: string = get(popupData).value || ""
    if (!value.includes("gradient")) value = DEFAULT

    return splitGradientValue(value)
}

export function ColorGradient() {
    const [parsedValue, setParsedValue] = useState(loadGradient)
    const [activeType, setActiveType] = useState(() => parsedValue.type || "linear-gradient")
    const [activeShape, setActiveShape] = useState(() => parsedValue.shape || "circle")

    const currentDeg = activeType === "radial-gradient" ? activeShape : `${parsedValue.deg}deg`
    const currentColors = parsedValue.colors?.map(({ color, pos }) => `${color} ${pos}%`)
    const newValue = `${activeType}(${currentDeg},${currentColors.join(",")})`

    function change() {
        const data = get(popupData)
        if (data.trigger) data.trigger(newValue)
        popupData.set({})
        activePopup.set(null)
    }

    // Enter: el registro es uno solo y siempre guarda el valor actual
    const live = useRef(change)
    useEffect(() => {
        live.current = change
    })
    useEffect(() => setPopupSubmit(() => live.current()), [])

    const types = [
        { value: "linear-gradient", label: translateText("color.linear") },
        { value: "radial-gradient", label: translateText("color.radial") }
    ]
    const shapes = [
        { value: "circle", label: translateText("color.circle") },
        { value: "ellipse", label: translateText("color.ellipse") }
    ]

    function setColors(update: (colors: ParsedGradient["colors"]) => ParsedGradient["colors"]) {
        setParsedValue((previous) => ({ ...previous, colors: update(previous.colors.map((a) => ({ ...a }))) }))
    }

    function updateColor(index: number, patch: Partial<ParsedGradient["colors"][number]>) {
        setColors((colors) => {
            colors[index] = { ...colors[index], ...patch }
            return colors
        })
    }

    function moveUp(index: number) {
        setColors((colors) => {
            const currentColor = colors[index].color
            colors[index].color = colors[index - 1].color
            colors[index - 1].color = currentColor
            return colors
        })
    }

    function deleteColor(index: number) {
        setColors((colors) => {
            colors.splice(index, 1)
            return colors
        })
    }

    return (
        <>
            {/* preview */}
            <div className={styles.preview} style={{ background: newValue }}></div>

            <InputRow>
                <SelectField label="sort.type" value={activeType} options={types} onChange={(value) => value !== null && setActiveType(value)} />

                {activeType === "radial-gradient" ? <SelectField label="color.shape" value={activeShape} options={shapes} onChange={(value) => value !== null && setActiveShape(value)} /> : <RadialField label="color.angle" value={parsedValue.deg} onChange={(deg) => setParsedValue({ ...parsedValue, deg })} />}
            </InputRow>

            <div className={styles.colors} style={{ marginTop: "10px" }}>
                {parsedValue.colors.map((colorPart, i) => {
                    const pos = colorPart.pos || 0
                    const prevPos = parsedValue.colors[i - 1]?.pos || 0
                    const nextPos = parsedValue.colors[i + 1]?.pos || 100

                    return (
                        <InputRow key={i}>
                            <ColorField style={{ minWidth: "50%" }} label="edit.color" value={colorPart.color} onInput={(color) => updateColor(i, { color })} allowOpacity />
                            <NumberField label="settings.position" value={pos} min={prevPos} max={nextPos} onChange={(value) => updateColor(i, { pos: value })} currentProgress={pos} showSlider />
                            {i > 0 ? <Button icon="up" onClick={() => moveUp(i)} /> : null}
                            {parsedValue.colors.length > 2 ? (
                                <Button title={translateText("actions.delete")} onClick={() => deleteColor(i)}>
                                    <Icon id="delete" white />
                                </Button>
                            ) : null}
                        </InputRow>
                    )
                })}

                <Button variant="outline" icon="add" style={{ width: "100%" }} onClick={() => setColors((colors) => [...colors, { color: "#ffffff", pos: 100 }])} white>
                    <T id="settings.add" />
                </Button>
            </div>

            <Button variant="default" icon="save" onClick={change} style={{ width: "100%", marginTop: "20px" }}>
                <T id="actions.save" />
            </Button>
        </>
    )
}

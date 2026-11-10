import { useState } from "react"
import { get } from "svelte/store"
import type { Styles } from "../../../types/Settings"
import { activePopup, popupData, styles } from "../../stores"
import { cn } from "../../lib/utils"
import { T } from "../helpers/T"
import { useFreshStore } from "../hooks/useFreshStore"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import css from "./MaxLines.module.css"

// Port de components/main/popups/MaxLines.svelte. Lee popupData { active, styleId, trigger } (active y styleId al montar; trigger al elegir) y styles[styleId].
// Escribe: popupData.trigger(valor) al elegir (también el campo personalizado); si el valor elegido es el que ya estaba activo, popupData = {} y activePopup = null;
// styles[styleId].showAsFaded / lineOpacity / skipVirtualBreaks (en el lugar). Sin key en el original: las cinco opciones fijas van por su número.
// El Svelte guardaba `style` como alias del objeto del store y le asignaba la clave a mano; acá el estilo se lee del store en cada emisión (copia), que da lo mismo.
// Sin styleId, cambiar "mostrar como atenuado" tira un TypeError dentro de styles.update (a[""] no existe), igual que el Svelte: no se agrega una guarda nueva.
// Los `null` de NumberField (sólo con defaultValue) son inalcanzables: pasan a trigger / active tal cual.
const lines = [0, 1, 2, 3, 4]

export function MaxLines() {
    const [initial] = useState(() => {
        const data = get(popupData)
        const active: number | null = data.active || 0
        const styleId: string = data.styleId || ""
        return { active, styleId }
    })
    const { styleId } = initial
    const [active, setActive] = useState(initial.active)
    // los estilos se editan en el lugar dentro del store: cada emisión entrega una copia del estilo de este popup
    const style: Styles | undefined = useFreshStore(styles, (value) => ({ ...value, [styleId]: value[styleId] && { ...value[styleId] } }))[styleId]
    const [showMore, setShowMore] = useState(() => {
        const current = get(styles)[styleId]
        return !!current?.showAsFaded || !!current?.skipVirtualBreaks || Number(initial.active) > 4
    })

    function setValue(value: number | null) {
        const trigger = get(popupData).trigger
        if (!trigger) return

        trigger(value)

        const previousActive = JSON.stringify(active)
        setActive(value)
        if (previousActive !== JSON.stringify(value)) return

        popupData.set({})
        activePopup.set(null)
    }

    function updateStyle<K extends "showAsFaded" | "lineOpacity" | "skipVirtualBreaks">(key: K, value: Styles[K]) {
        styles.update((a) => {
            a[styleId][key] = value
            return a
        })
    }

    return (
        <>
            <Button className={cn("popup-options", showMore && "active")} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

            <div className={css.grid}>
                {lines.map((line) => {
                    const isActive = line === Number(active)

                    return (
                        <Button key={line} showOutline={isActive} isActive={isActive} onClick={() => setValue(line)}>
                            <div className={css.lines}>
                                {Array.from({ length: line ? line : 5 }, (_, index) => (
                                    <span key={index} className={css.line} style={line ? undefined : { opacity: 0.6 }}></span>
                                ))}
                            </div>

                            <p>{line === 0 ? <T id="settings.all_lines" /> : line}</p>
                        </Button>
                    )
                })}
            </div>

            {showMore ? (
                <>
                    <NumberField style={{ marginTop: "20px" }} label="actions.custom_key" value={active ?? undefined} min={0} max={99} onChange={setValue} />

                    <InputRow arrow={!!style?.showAsFaded} menu={<NumberField label="edit.opacity (%)" value={style?.lineOpacity ?? 50} min={0} max={99} onChange={(value) => updateStyle("lineOpacity", value ?? undefined)} />}>
                        <ToggleField label="edit.show_as_faded" style={{ width: "100%" }} checked={!!style?.showAsFaded} defaultValue={false} onChange={(checked) => updateStyle("showAsFaded", checked)} />
                    </InputRow>

                    {styleId ? <ToggleField label="edit.skip_virtual_breaks" checked={!!style?.skipVirtualBreaks} defaultValue={false} onChange={(checked) => updateStyle("skipVirtualBreaks", checked)} /> : null}
                </>
            ) : null}
        </>
    )
}

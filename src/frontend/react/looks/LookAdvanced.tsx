import { useState } from "react"
import type { Output } from "../../../types/Output"
import type { Look, LookScreen } from "../../../types/Settings"
import { translateText } from "../../shared/utils/language"
import { Icon } from "../helpers/Icon"
import { ColorField } from "../ui/color-field/ColorField"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./LookAdvanced.module.css"

// Port de components/looks/LookAdvanced.svelte (F24.14): "Más opciones", el resto de los campos del LookScreen por
// pantalla (fondo, ajuste de medios, desenfoque, volumen, líneas, metadata). Colapsado por defecto.
// el campo numérico puede entregar null (reset sin valor por defecto) y el Svelte lo pasaba tal cual
export type LookCellPatch = { [K in keyof LookScreen]?: LookScreen[K] | null }

export interface LookAdvancedProps {
    screens?: (Output & { id: string })[]
    draft: Look
    onCell?: (detail: { outputId: string; patch: LookCellPatch }) => void
}

const t = translateText

export function LookAdvanced({ screens = [], draft, onCell }: LookAdvancedProps) {
    const [open, setOpen] = useState(false)

    const hasContent = screens.length > 0 && !!draft

    function getCell(outputId: string): LookScreen {
        return draft?.screens?.[outputId] || { layers: { media: true, slide: true, overlays: true } }
    }

    function patch(outputId: string, data: LookCellPatch) {
        onCell?.({ outputId, patch: data })
    }

    if (!hasContent) return null

    return (
        <details className={styles.advanced} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
            <summary>
                <Icon id={open ? "expand" : "collapse"} size={0.8} />
                <span>{t("looks.more_options")}</span>
            </summary>

            <div className={styles["advanced-body"]}>
                {screens.map((screen) => {
                    const cell = getCell(screen.id)
                    return (
                        <div key={screen.id} className={styles["screen-block"]}>
                            <div className={styles["screen-title"]}>
                                <Icon id="screen" size={0.8} white />
                                <span>{screen.name || t("settings.output_screen")}</span>
                            </div>

                            <ColorField label="edit.background_color" value={cell.background || "#000000"} defaultValue="#000000" onInput={(value) => patch(screen.id, { background: value })} />

                            <InputRow>
                                <ToggleField label="settings.clear_style_background_on_text" checked={!!cell.clearStyleBackgroundOnText} defaultValue={false} onChange={(checked) => patch(screen.id, { clearStyleBackgroundOnText: checked })} />
                            </InputRow>

                            <InputRow>
                                <NumberField label="media.volume (%)" value={cell.volume ?? 100} defaultValue={100} max={100} onChange={(value) => patch(screen.id, { volume: value })} />
                                <NumberField label="looks.lines" value={cell.lines ?? 0} defaultValue={0} onChange={(value) => patch(screen.id, { lines: value })} />
                            </InputRow>

                            <InputRow>
                                <NumberField label="looks.blur_amount" value={cell.blurAmount ?? 0} defaultValue={0} onChange={(value) => patch(screen.id, { blurAmount: value })} />
                                <NumberField label="looks.blur_opacity" value={cell.blurOpacity ?? 0} defaultValue={0} max={100} onChange={(value) => patch(screen.id, { blurOpacity: value })} />
                            </InputRow>

                            <InputRow>
                                <ToggleField label="looks.show_as_faded" checked={!!cell.showAsFaded} defaultValue={false} onChange={(checked) => patch(screen.id, { showAsFaded: checked })} />
                            </InputRow>
                        </div>
                    )
                })}
            </div>
        </details>
    )
}

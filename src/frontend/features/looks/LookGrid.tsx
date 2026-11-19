import type { CSSProperties } from "react"
import type { Output } from "../../../types/Output"
import type { Look, LookScreen } from "../../../types/Settings"
import { keysToID, sortByName } from "../../shared/utils/helpers/array"
import { templates } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { Icon } from "../../shared/ui/helpers/Icon"
import { useFreshStore } from "../../shared/ui/hooks/useFreshStore"
import { CheckboxField } from "../../shared/ui/kit/checkbox-field/CheckboxField"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { LookAdvanced, type LookCellPatch } from "./LookAdvanced"
import styles from "./LookGrid.module.css"

// Port de components/looks/LookGrid.svelte (F24.14): una columna por pantalla de audiencia, filas = Presentación (tema),
// Slide, Media y Overlays. "Más opciones" despliega el resto de los campos del LookScreen.
export interface LookGridProps {
    screens?: (Output & { id: string })[]
    draft: Look
    onCell?: (detail: { outputId: string; patch: LookCellPatch }) => void
}

type Layer = "media" | "slide" | "overlays"

const t = translateText

export function LookGrid({ screens = [], draft, onCell }: LookGridProps) {
    const templatesValue = useFreshStore(templates)

    const themeOptions = [{ value: "", label: `⊘ ${t("main.none")}` }, ...sortByName(keysToID(templatesValue)).map((a) => ({ value: a.id, label: a.name }))]

    function getCell(outputId: string): LookScreen {
        return draft?.screens?.[outputId] || { layers: { media: true, slide: true, overlays: true } }
    }

    function patch(outputId: string, data: LookCellPatch) {
        onCell?.({ outputId, patch: data })
    }

    function toggleLayer(outputId: string, layer: Layer) {
        const cell = getCell(outputId)
        const layers = { ...cell.layers, [layer]: !cell.layers?.[layer] }
        patch(outputId, { layers })
    }

    const layerRow = (layer: Layer) => (
        <div className={styles.row}>
            <div className={styles["row-label"]}>{t(`looks.${layer}`)}</div>
            {screens.map((screen) => (
                <div key={screen.id} className={`${styles.cell} ${styles.centered}`}>
                    <CheckboxField checked={!!getCell(screen.id).layers?.[layer]} label={`looks.${layer}`} center onChange={() => toggleLayer(screen.id, layer)} />
                </div>
            ))}
        </div>
    )

    return (
        <div className={styles.grid} style={{ "--columns": screens.length } as CSSProperties}>
            {/* encabezado: una columna por pantalla */}
            <div className={`${styles.row} ${styles.header}`}>
                <div className={styles["row-label"]}></div>
                {screens.map((screen) => (
                    <div key={screen.id} className={`${styles.cell} ${styles["header-cell"]}`}>
                        <Icon id="screen" size={0.9} white />
                        <span>{screen.name || t("settings.output_screen")}</span>
                    </div>
                ))}
            </div>

            {/* fila: Presentación (tema) */}
            <div className={styles.row}>
                <div className={styles["row-label"]}>{t("looks.presentation")}</div>
                {screens.map((screen) => (
                    <div key={screen.id} className={styles.cell}>
                        <SelectField label="looks.theme" value={getCell(screen.id).theme || ""} options={themeOptions} allowEmpty onChange={(value) => patch(screen.id, { theme: value || undefined })} />
                    </div>
                ))}
            </div>

            {layerRow("slide")}
            {layerRow("media")}
            {layerRow("overlays")}

            {/* más opciones (colapsable): el resto de LookScreen por pantalla */}
            <LookAdvanced screens={screens} draft={draft} onCell={onCell} />
        </div>
    )
}

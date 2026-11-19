import { activeStage, outputs, stageShows } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { keysToID, sortByName } from "../../../shared/utils/helpers/array"
import { history } from "../../../shared/utils/helpers/history"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { CheckboxField } from "../../../shared/ui/kit/checkbox-field/CheckboxField"
import { ColorField } from "../../../shared/ui/kit/color-field/ColorField"
import { SelectField } from "../../../shared/ui/kit/select-field/SelectField"
import { TextField } from "../../../shared/ui/kit/text-field/TextField"
import { StageItemsList } from "./StageItemsList"
import styles from "./SlideStyle.module.css"

// (F24.19a).
// Los campos de UI despachan el valor directo (no un CustomEvent), así que `updateStageSettings` recibe el valor.
export function SlideStyle() {
    const currentActiveStage = useStore(activeStage)
    const currentOutputs = useStore(outputs)
    const currentStageShows = useStore(stageShows)

    const currentStage = currentStageShows[currentActiveStage.id || ""]
    const settings = currentStage?.settings || {}
    const outputsList = sortByName(keysToID(currentOutputs).filter((output) => !output.stageOutput)).map((output) => ({ value: output.id, label: output.name }))

    function updateStageSettings(value: unknown, key: string) {
        if (value === settings[key]) return
        history({ id: "UPDATE", newData: { data: value, key: "settings", subkey: key }, oldData: { id: currentActiveStage.id }, location: { page: "stage", id: "stage" } })
    }

    function updateStagePassword(value: unknown) {
        if (value === (currentStage?.password || "")) return
        history({ id: "UPDATE", newData: { data: value, key: "password" }, oldData: { id: currentActiveStage.id }, location: { page: "stage", id: "stage" } })
    }

    return (
        <div className={styles.tools}>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <SelectField label="stage.source_output" options={outputsList} value={settings.output || ""} onChange={(value) => updateStageSettings(value || "", "output")} allowEmpty />
                <TextField label="remote.password" type="password" value={currentStage?.password || ""} defaultValue="" onChange={(value) => updateStagePassword(value ?? "")} />
            </div>

            <div>
                <div className={styles.title}>
                    <span style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 12px" }}>
                        <Icon id="style" white />
                        <p>{translateText("edit.style")}</p>
                    </span>
                </div>

                <ColorField label="edit.background_color" value={settings.color || "#000000"} defaultValue="#000000" onInput={(value) => updateStageSettings(value, "color")} />

                <CheckboxField label="stage.labels" checked={settings.labels} onChange={(value) => updateStageSettings(value, "labels")} />
                {settings.labels ? <ColorField label="stage.label_color" value={settings.labelColor || "#ac9c35"} defaultValue="#ac9c35" onInput={(value) => updateStageSettings(value, "labelColor")} /> : null}
            </div>

            <StageItemsList />
        </div>
    )
}

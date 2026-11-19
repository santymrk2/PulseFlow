import { special } from "../../../shared/core/stores"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Center } from "../../../shared/ui/system/Center"
import { Clock } from "../../../shared/ui/system/Clock"
import { Date } from "../../../shared/ui/system/Date"
import { TextField } from "../../../shared/ui/kit/text-field/TextField"
import { ToggleField } from "../../../shared/ui/kit/toggle-field/ToggleField"
import styles from "./TemplateInfo.module.css"

// Port de components/drawer/info/TemplateInfo.svelte. Clock y Date son ports React (F24.18a).
export interface TemplateInfoProps {
    optionsOpen: boolean
}

function updateSpecial(value: unknown, key: string, allowEmpty = false) {
    special.update((a) => {
        if (!allowEmpty && !value) delete a[key]
        else a[key] = value
        return a
    })
}

export function TemplateInfo({ optionsOpen }: TemplateInfoProps) {
    const specialValue = useStore(special)

    return (
        <div className={styles.scroll}>
            {optionsOpen ? (
                <main style={{ overflowX: "hidden", padding: "10px" }}>
                    <TextField label="settings.capitalize_words" title="settings.comma_seperated" value={specialValue.capitalize_words || ""} defaultValue="Jesus, Lord" onChange={(value) => updateSpecial(value, "capitalize_words", true)} />
                    <ToggleField label="settings.style_template_preview" checked={specialValue.styleTemplatePreview !== false} defaultValue={true} onChange={(value) => updateSpecial(value, "styleTemplatePreview", true)} />
                </main>
            ) : (
                <Center>
                    <Clock />
                    <Date />
                </Center>
            )}
        </div>
    )
}

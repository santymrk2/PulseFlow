import { special } from "../../../stores"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import Clock from "../../../components/system/Clock.svelte"
import Date from "../../../components/system/Date.svelte"
import { TextField } from "../../ui/text-field/TextField"
import { ToggleField } from "../../ui/toggle-field/ToggleField"
import styles from "./TemplateInfo.module.css"

// Port de components/drawer/info/TemplateInfo.svelte. Clock y Date se migran en F24.18a: siguen como islas.
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
                    <SvelteIsland component={Clock} />
                    <SvelteIsland component={Date} />
                </Center>
            )}
        </div>
    )
}

import { dictionary, fullColors, groups, labelsDisabled, language, special, timeFormat } from "../../shared/core/stores"
import { sortByName } from "../../components/helpers/array"
import { getLanguageList, setLanguage, translateText } from "../../utils/language"
import { isGroupHidden } from "../../utils/profile"
import { useStore } from "../hooks/useStore"
import { PopupField } from "../ui/popup-field/PopupField"
import { SelectField } from "../ui/select-field/SelectField"
import { Title } from "../ui/title/Title"
import { ToggleField } from "../ui/toggle-field/ToggleField"

// Port de components/settings/tabs/General.svelte (F24.12)
function updateSpecial(value: unknown, key: string, allowEmpty = false) {
    special.update((a) => {
        if (!allowEmpty && !value) delete a[key]
        else a[key] = value

        return a
    })
}

// WIP set calendar starting day
// WIP change date format (DD.MM.YYYY, YYYY-MM-DD)

export function General() {
    const languageValue = useStore(language)
    const timeFormatValue = useStore(timeFormat)
    const labelsDisabledValue = useStore(labelsDisabled)
    const fullColorsValue = useStore(fullColors)
    const specialValue = useStore(special)
    const dict = useStore(dictionary)
    const groupsValue = useStore(groups)

    const groupsList: { label: string; color: string }[] = []
    Object.entries(groupsValue).forEach(([id, a]) => {
        if (isGroupHidden(id)) return
        groupsList.push({ label: a.default ? translateText(`groups.${a.name}`) || a.name : a.name, color: a.color })
    })

    const strings: string[] = []
    sortByName(groupsList, "label").forEach((a) => {
        if (a.label) strings.push(`<span style="color: ${a.color};">${a.label}</span>`)
    })
    const groupsString = strings.join(`<span style="opacity: 0.4;"> | </span>`)

    return (
        <>
            <SelectField label="settings.language" value={languageValue} options={getLanguageList()} onChange={(value) => setLanguage(value ?? "")} flags />
            <ToggleField label="settings.use24hClock" checked={timeFormatValue === "24"} onChange={(checked) => timeFormat.set(checked ? "24" : "12")} />
            <ToggleField label="settings.disable_labels" checked={labelsDisabledValue} defaultValue={false} onChange={(checked) => labelsDisabled.set(checked)} />
            <ToggleField label="settings.full_colors" checked={fullColorsValue} defaultValue={false} onChange={(checked) => fullColors.set(checked)} />

            {/* SLIDES */}

            {/* info.slides */}
            <Title label="tools.slide" icon="slide" />

            <PopupField label={translateText("popup.manage_groups", dict)} name={groupsString} value={groupsString ? "." : ""} popupId="manage_groups" icon="groups" />

            {/* shortcuts: */}
            <ToggleField label="settings.next_item_on_last_slide" checked={specialValue.nextItemOnLastSlide !== false} defaultValue={true} onChange={(checked) => updateSpecial(checked, "nextItemOnLastSlide", true)} />
            <ToggleField label="settings.slide_number_keys" checked={specialValue.numberKeys} defaultValue={false} onChange={(checked) => updateSpecial(checked, "numberKeys")} />
            <ToggleField label="settings.auto_shortcut_first_letter" checked={specialValue.autoLetterShortcut} defaultValue={false} onChange={(checked) => updateSpecial(checked, "autoLetterShortcut")} />

            {/* when disabled: no ./F2 to clear, F5 clears slide timer instead of next slide, no PageUp/PageDown/Home/End for slide navigation */}
            {/* <Checkbox checked={$special.disablePresenterControllerKeys} on:change={(e) => updateSpecial(e.target.checked, "disablePresenterControllerKeys")} /> */}
        </>
    )
}

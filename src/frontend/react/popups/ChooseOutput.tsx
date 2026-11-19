import { popupData } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { ChoiceGrid } from "../ui/choice-grid/ChoiceGrid"

// Port de components/main/popups/ChooseOutput.svelte. Escribe: popupData = { id: "choose_output_input", value: id }.
export function ChooseOutput() {
    const outputTypes = [
        { id: "normal", name: translateText("settings.normal"), icon: "display_settings" },
        { id: "stage", name: translateText("menu.stage"), icon: "stage" }
    ]

    return <ChoiceGrid options={outputTypes} onClick={(id) => popupData.set({ id: "choose_output_input", value: id })} />
}

import { popupData } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { ChoiceGrid } from "../ui/choice-grid/ChoiceGrid"

// Escribe: popupData = { id: "choose_style", value: id }.
export function ChooseStyle() {
    const styleTypes = [
        { id: "normal", name: translateText("settings.normal"), icon: "styles" },
        { id: "live", name: translateText("tabs.live"), icon: "camera" }
    ]

    return <ChoiceGrid options={styleTypes} onClick={(id) => popupData.set({ id: "choose_style", value: id })} />
}

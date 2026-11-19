import { activePopup } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { Button } from "../ui/button/Button"

// Port de components/settings/tabs/OtherButtons.svelte (F24.12)
export function OtherButtons() {
    return (
        <Button icon="reset" style={{ width: "100%", padding: "15px", borderTop: "2px solid var(--primary-lighter)" }} onClick={() => activePopup.set("reset_all")} white red>
            {translateText("settings.reset_all")}
        </Button>
    )
}

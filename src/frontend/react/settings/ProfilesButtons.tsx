import { get } from "../../shared/core/lib/store"
import { runActionId } from "../../components/actions/actions"
import { activeProfile, profiles, selectedProfile, special } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { translateText } from "../../shared/utils/language"
import { promptCustom } from "../../shared/utils/popup"
import { checkPassword } from "../../shared/utils/profile"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"

// Port de components/settings/tabs/ProfilesButtons.svelte (F24.13a)
export function ProfilesButtons() {
    const selected = useStore(selectedProfile)
    const active = useStore(activeProfile)
    const profilesValue = useStore(profiles)

    const profileId = selected || ""
    const profilesList = Object.keys(profilesValue).filter((a) => a !== "admin")
    const hasAdminPass = !!profilesValue.admin?.password

    async function setCurrentAsActive() {
        // require password if setting admin profile (and password exists)
        if (profileId === "" && hasAdminPass) {
            const pwd = await promptCustom(translateText("remote.password"), "password")
            const adminPassword = get(profiles).admin?.password || ""
            if (!checkPassword(pwd, adminPassword)) {
                newToast("remote.wrong_password")
                return
            }
        }

        activeProfile.set(profileId)

        // run action
        const actionId = get(profiles)[profileId]?.action
        if (actionId) runActionId(actionId, "profile")

        // store last used profile
        special.update((a) => {
            a.lastUsedProfile = profileId
            return a
        })
    }

    if (active === profileId || !profilesList.length) return null

    return (
        <Button variant="outline" style={{ padding: "6px 10px", fontSize: "0.85em" }} icon="check" onClick={() => setCurrentAsActive()} white>
            <T id="profile.set_active" />
        </Button>
    )
}

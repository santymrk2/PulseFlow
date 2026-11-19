import { activeProfile, os, profiles, special } from "../../shared/core/stores"
import { newToast, wait } from "../../shared/utils/common"
import { translateText } from "../../shared/utils/language"
import { confirmCustom, promptCustom } from "../../shared/utils/popup"
import { checkPassword } from "../../shared/utils/profile"
import { checkStartupActions, runActionId } from "../../components/actions/actions"
import { keysToID, sortByName } from "../../shared/utils/helpers/array"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"
import styles from "./ProfileSelector.module.css"

export function ProfileSelector() {
    const osValue = useStore(os)
    const profilesValue = useStore(profiles)

    const isWindows = osValue.platform === "win32"
    const profilesList = sortByName(keysToID(profilesValue).filter((a) => a.id !== "admin"))

    async function selectProfile(id: string) {
        if (id === "") {
            const adminPassword = profilesValue.admin?.password || ""
            if (adminPassword) {
                const pwd = await promptCustom(translateText("remote.password"), "password")
                if (!checkPassword(pwd, adminPassword)) {
                    newToast("remote.wrong_password")
                    return
                }
            } else if (!(await confirmCustom(translateText("profile.choose_admin")))) return
        }

        await wait(50)

        activeProfile.set(id)

        const actionId = profilesValue[id || "admin"]?.action
        if (actionId) runActionId(actionId, "profile")

        checkStartupActions()

        special.update((a) => {
            a.lastUsedProfile = id
            return a
        })
    }

    return (
        <div className={styles.profiles} style={{ top: isWindows ? "25px" : "0", height: isWindows ? "calc(100% - 25px)" : "100%" }}>
            <h1>PulseFlow</h1>
            <p style={{ opacity: 0.8, marginBottom: "20px" }}>
                <T id="profile.choose_profile" />
            </p>

            <div className={styles.flex}>
                {profilesList.map((profile) => (
                    <Button key={profile.id} title={`profile.set_active: <b>${profile.name}</b>`} style={{ padding: "1.8em", border: "1px solid var(--border)" }} onClick={() => void selectProfile(profile.id)}>
                        <div className={styles.profile}>
                            <Icon id="profiles" size={8} style={{ fill: profile.color || "white" }} white />
                            <p>{profile.name}</p>
                        </div>
                    </Button>
                ))}
            </div>

            <Button variant="outline" title="profile.set_active: <b>profile.admin</b>" style={{ marginTop: "20px" }} onClick={() => void selectProfile("")}>
                <Icon id="admin" size={2} white />
                <p>
                    <T id="profile.admin" />
                </p>
            </Button>
        </div>
    )
}

import { activeProfile, profiles, showChangeProfileMenu } from "../../shared/core/stores"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"
import styles from "./ProfileChangerMenu.module.css"

export function ProfileChangerMenu() {
    const active = useStore(activeProfile)
    const profilesValue = useStore(profiles)

    const isAdmin = !active
    const currentProfile = isAdmin ? "" : profilesValue[active || ""]?.name || ""

    return (
        <div className={styles.profileChangerMenu}>
            <p style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
                <Icon id="profiles" white />
                <span>{isAdmin ? <T id="profile.admin" /> : currentProfile}</span>
            </p>

            <Button
                variant="outline"
                onClick={() => {
                    activeProfile.set(null)
                    showChangeProfileMenu.set(false)
                }}
            >
                <T id="profile.change_profile" />
            </Button>
        </div>
    )
}

import { activeProfile, profiles, showChangeProfileMenu } from "../../stores"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
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

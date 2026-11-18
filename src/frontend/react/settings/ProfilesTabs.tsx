import { useEffect } from "react"
import { get } from "../../lib/store"
import { uid } from "uid"
import type { Profile } from "../../../types/Main"
import { clone, keysToID, sortByName } from "../../components/helpers/array"
import { generateLightRandomColor } from "../../components/helpers/color"
import { history } from "../../components/helpers/history"
import { activeProfile, activeTriggerFunction, profiles, selectedProfile } from "../../stores"
import { translateText } from "../../utils/language"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { HiddenInput } from "../ui/hidden-input/HiddenInput"
import { Tabs } from "../ui/tabs/Tabs"

// Port de components/settings/tabs/ProfilesTabs.svelte (F24.13a)
// Se arma al usarse y no al cargar el módulo: el nombre se traduce con el diccionario ya cargado.
const defaultProfile = (): Profile => ({ name: translateText("example.default"), color: "", image: "", access: {} })

// `bind:edit` del Svelte sólo escribía una variable local que nadie leía: no hay equivalente.
export function ProfilesTabs() {
    const profilesValue = useStore(profiles)
    const selected = useStore(selectedProfile)
    const active = useStore(activeProfile)
    const trigger = useStore(activeTriggerFunction)

    const profilesList = [{ id: "", color: "", name: translateText("profile.admin") }, ...sortByName(keysToID(profilesValue).filter((a) => a.id !== "admin"))]

    // `$: profileId = $selectedProfile ?? first` y, después, "set id after deletion"
    const chosen = selected ?? Object.keys(profilesValue)[0] ?? ""
    const profileId = chosen !== "" && !profilesValue[chosen] ? "" : chosen
    const currentProfile = (): Profile => profilesValue[profileId] || clone(defaultProfile())

    // UPDATE

    function updateProfile(value: string, key: string, currentId = "") {
        if (!currentId) currentId = profileId || "default"

        // create a profile if nothing exists
        profiles.update((a) => {
            if (!a[currentId]) a[currentId] = clone(currentProfile())

            return a
        })

        history({ id: "UPDATE", newData: { key, data: value }, oldData: { id: currentId }, location: { page: "settings", id: "settings_profile", override: "profile_" + key } })

        selectedProfile.set(currentId)
    }

    // CREATE

    function createProfile() {
        // WIP presets for presenter / creator / manager

        if (get(activeProfile) === null) activeProfile.set("")
        const newId = uid()
        history({ id: "UPDATE", newData: { data: clone(defaultProfile()), replace: { name: currentProfile().name + " 2", color: generateLightRandomColor() } }, oldData: { id: newId }, location: { page: "settings", id: "settings_profile" } })

        selectedProfile.set(newId)
    }

    useEffect(() => {
        if (trigger === "create_profile") setTimeout(createProfile)
    }, [trigger])

    return (
        <Tabs id="profile" tabs={profilesList} value={selected || ""} newLabel="new.profile" className={active ? "" : "context #profile_tab"} onOpen={(id) => selectedProfile.set(id)} onCreate={() => createProfile()}>
            {(tab) => (
                <>
                    {!tab.id ? <Icon id="admin" right white /> : <Icon id="profiles" style={{ fill: tab.color }} white right />}

                    {active === tab.id ? <Icon id="check" size={0.7} white right /> : null}
                    <HiddenInput value={tab.name} id={"profile_" + tab.id} onEdit={(e) => updateProfile(e.value, "name", tab.id)} />
                </>
            )}
        </Tabs>
    )
}

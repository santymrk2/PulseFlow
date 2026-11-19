import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { AccessType, Profile } from "../../../types/Main"
import { clone, keysToID, sortByName } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { actions, actionTags, activePopup, activeProfile, categories, folders, groups, overlayCategories, popupData, profiles, scenes, selectedProfile, stageShows, templateCategories, timerTags, variableTags } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { encodePassword } from "../../shared/utils/profile"
import { customIconsColors } from "../../shared/core/values/customIcons"
import { settingsTabs } from "../../shared/core/values/tabs"
import { Icon } from "../../shared/ui/helpers/Icon"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Center } from "../../shared/ui/system/Center"
import { Button } from "../../shared/ui/kit/button/Button"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { SegmentedField, type SegmentedOption } from "../../shared/ui/kit/segmented-field/SegmentedField"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import { ToggleField } from "../../shared/ui/kit/toggle-field/ToggleField"

// Port de components/settings/tabs/Profiles.svelte (F24.13a)
interface AccessItem {
    id: string
    name: string
    icon?: string | null
    color?: string
}

interface AccessList {
    id: string
    label: string
    icon: string
    access: { [key: string]: AccessType }
    options: SegmentedOption[]
    list: AccessItem[]
}

const accessInputs: SegmentedOption[] = [
    { value: "none", label: "profile.none", icon: "disable" },
    { value: "read", label: "profile.read", icon: "eye" },
    { value: "write", label: "profile.write", icon: "edit" }
]
const accessInputsRW: SegmentedOption[] = [
    { value: "read", label: "profile.read", icon: "eye" },
    { value: "write", label: "profile.write", icon: "edit" }
]

const iconColor = (icon: string | null | undefined) => (customIconsColors as Record<string, string>)[icon || ""]

export function Profiles() {
    const profilesValue = useStore(profiles)
    const selected = useStore(selectedProfile)
    const active = useStore(activeProfile)
    const foldersValue = useStore(folders)
    const categoriesValue = useStore(categories)
    const overlayCategoriesValue = useStore(overlayCategories)
    const templateCategoriesValue = useStore(templateCategories)
    const actionTagsValue = useStore(actionTags)
    const timerTagsValue = useStore(timerTags)
    const variableTagsValue = useStore(variableTags)
    const scenesValue = useStore(scenes)
    const stageShowsValue = useStore(stageShows)
    const groupsValue = useStore(groups)
    const actionsValue = useStore(actions)
    useStore(popupData)

    // `$: profileId = $selectedProfile || ""` y, después, "set id after deletion"
    const chosen = selected || ""
    const profileId = chosen !== "" && !profilesValue[chosen] ? "" : chosen
    const defaultProfile: Profile = { name: translateText("example.default"), color: "", image: "", access: {} }
    const currentProfile: Profile = profilesValue[profileId] || clone(defaultProfile)

    const isAdmin = !active

    // UPDATE

    function updateAccess(key: string, id: string, accessType: AccessType) {
        if (!isAdmin) return

        const data = currentProfile.access

        let accessData = data[key] || {}
        if (id === "global" && accessType === "write" && !accessData[id]) accessData = {}

        accessData[id] = accessType
        if (accessType === "write") delete accessData[id]

        data[key] = accessData
        history({ id: "UPDATE", newData: { key: "access", data }, oldData: { id: profileId }, location: { page: "settings", id: "settings_profile", override: "profile_" + key } })

        // if (key === "shows") updateShowsList($shows)
    }

    // ACCESS

    function getInputs(globalAccess: AccessType | undefined, id: string) {
        const inputs = clone(accessInputs)

        if (globalAccess === "none" || globalAccess === "read") inputs[2].disabled = true
        if (globalAccess === "none") inputs[1].disabled = true

        // remove "read"
        if (id === "settings" || id === "groups") inputs.splice(1, 1)

        // Hide/Show instead of None/Write
        if (id === "settings" || id === "groups") {
            inputs[0].label = "profile.hide"
            inputs[1].label = "profile.show"
            inputs[1].icon = "eye"
        }

        // only admin can change access
        if (!isAdmin) inputs.forEach((input) => (input.disabled = true))

        return inputs
    }

    function getSectionOptions(options: SegmentedOption[]) {
        // only admin can change access
        if (!isAdmin) return options.map((option) => ({ ...option, disabled: true }))
        return options
    }

    function getAccessLevel(a: { [key: string]: AccessType }, id: string) {
        const currentLocalLevel = a[id] || "write"
        const currentGlobalLevel = a.global || "write"

        if (currentGlobalLevel === "write") return currentLocalLevel
        if (currentGlobalLevel === "read" && currentLocalLevel === "write") return "read"
        if (currentGlobalLevel === "none") return "none"
        return currentLocalLevel
    }

    /////

    const projectsList: AccessItem[] = sortByName(keysToID(foldersValue).filter((a) => a.name && a.parent === "/")).map((a) => ({ ...a, icon: "folder" }))
    const projectsAccess = currentProfile.access.projects || {}

    const showsCategoryList: AccessItem[] = sortByName(keysToID(categoriesValue).filter((a) => a.name && !a.isArchive)).map((a) => ({ ...a, color: iconColor(a.icon) })) //  && !a.default
    const showsCategoryAccess = currentProfile.access.shows || {}

    const overlayCategoryList: AccessItem[] = sortByName(keysToID(overlayCategoriesValue).filter((a) => a.name)).map((a) => ({ ...a, color: iconColor(a.icon) }))
    const overlayCategoryAccess = currentProfile.access.overlays || {}

    const templateCategoryList: AccessItem[] = sortByName(keysToID(templateCategoriesValue).filter((a) => a.name)).map((a) => ({ ...a, color: iconColor(a.icon) }))
    const templateCategoryAccess = currentProfile.access.templates || {}

    const actionsList: AccessItem[] = sortByName(keysToID(actionTagsValue).filter((a) => a.name)).map((a) => ({ ...a, icon: "tag" }))
    const actionsAccess = currentProfile.access.actions || {}

    const timersList: AccessItem[] = sortByName(keysToID(timerTagsValue).filter((a) => a.name)).map((a) => ({ ...a, icon: "tag" }))
    const timersAccess = currentProfile.access.timers || {}

    const variablesList: AccessItem[] = sortByName(keysToID(variableTagsValue).filter((a) => a.name)).map((a) => ({ ...a, icon: "tag" }))
    const variablesAccess = currentProfile.access.variables || {}

    const scenesList: AccessItem[] = sortByName(keysToID(scenesValue).filter((a) => a.name)).map((a) => ({ ...a, icon: "scene" }))
    const scenesAccess = currentProfile.access.scenes || {}

    const stageList: AccessItem[] = sortByName(keysToID(stageShowsValue)).filter((a) => a.name)
    const stageAccess = currentProfile.access.stage || {}

    const groupsList: AccessItem[] = sortByName(keysToID(groupsValue)).map((a) => {
        let name = a.name
        if (a.default) name = translateText("groups." + a.name)
        return { id: a.id, name, color: a.color }
    })
    const groupsAccess = currentProfile.access.groups || {}

    // "display_settings" (can change position still), "connection" (can use still)
    const settingsList: AccessItem[] = settingsTabs.map((id) => ({ id, name: `settings.${id}`, icon: id }))
    const settingsAccess = currentProfile.access.settings || {}

    ///

    const ACCESS_LISTS: AccessList[] = [
        { id: "projects", label: "remote.projects", icon: "project", access: projectsAccess, options: accessInputsRW, list: projectsList },
        { id: "shows", label: "tabs.shows", icon: "shows", access: showsCategoryAccess, options: accessInputsRW, list: showsCategoryList },
        // WIP AUDIO PLAYLISTS?
        { id: "overlays", label: "tabs.overlays", icon: "overlays", access: overlayCategoryAccess, options: accessInputsRW, list: overlayCategoryList },
        { id: "templates", label: "tabs.templates", icon: "templates", access: templateCategoryAccess, options: accessInputs, list: templateCategoryList },
        // WIP SCRIPTURE?
        // WIP CALENDAR?
        { id: "actions", label: "tabs.actions", icon: "actions", access: actionsAccess, options: accessInputsRW, list: actionsList },
        { id: "timers", label: "tabs.timers", icon: "timer", access: timersAccess, options: accessInputsRW, list: timersList },
        { id: "variables", label: "tabs.variables", icon: "variable", access: variablesAccess, options: accessInputsRW, list: variablesList },
        { id: "scenes", label: "tabs.scenes", icon: "scene", access: scenesAccess, options: accessInputsRW, list: scenesList },
        { id: "stage", label: "menu.stage", icon: "stage", access: stageAccess, options: accessInputsRW, list: stageList },
        { id: "groups", label: "tools.groups", icon: "groups", access: groupsAccess, options: [], list: groupsList },
        { id: "settings", label: "menu.settings", icon: "settings", access: settingsAccess, options: [], list: settingsList }
    ]

    const hasAdminPass = !!profilesValue.admin?.password
    function setAdminPassword(password: string | null) {
        updateAdmin("password", password ? encodePassword(password) : "")
    }

    function updateAdmin(key: string, value: string | boolean) {
        profiles.update((a) => {
            if (!a.admin) a.admin = { name: "", color: "", image: "", access: {} }
            ;(a.admin as unknown as Record<string, unknown>)[key] = value
            return a
        })
    }

    function updateProfile(key: string, value: string | null) {
        if (!profileId) return
        profiles.update((a) => {
            if (!a[profileId]) a[profileId] = clone(currentProfile)
            ;(a[profileId] as unknown as Record<string, unknown>)[key] = value
            return a
        })
    }

    const profilesList = Object.keys(profilesValue).filter((a) => a !== "admin")

    const currentAction = currentProfile?.action || ""
    // `let` y no `$:` en el Svelte: la lista se toma al montar y no sigue a `actions`
    const [actionOptions] = useState(() =>
        Object.entries(get(actions))
            .map(([id, a]) => ({ id, name: a.name }))
            .sort((a, b) => a.name?.localeCompare(b.name))
    )

    function editAction() {
        popupData.set({ id: currentAction })
        activePopup.set("action")
    }

    if (!profileId || !profilesList.length) {
        return (
            <>
                {profilesList.length && isAdmin ? (
                    <>
                        {/* Admin settings */}
                        <TextField label="remote.password" disabled={hasAdminPass} value={hasAdminPass ? "*****" : ""} defaultValue="" onChange={setAdminPassword} />

                        <ToggleField label="profile.auto_open_last_used" checked={profilesValue.admin?.autoOpenLastUsed || false} defaultValue={false} onChange={(checked) => updateAdmin("autoOpenLastUsed", checked)} />
                    </>
                ) : null}

                <Center style={{ height: "82%", opacity: 0.1 }}>
                    <Icon id="admin" size={15} white />
                </Center>
            </>
        )
    }

    // sin key en el Svelte (posición)
    return (
        <>
            {ACCESS_LISTS.map((a, i) => (
                <InputRow
                    key={i}
                    arrow={!!a.list?.length}
                    menu={
                        <div>
                            {a.list.map((item, j) => (
                                <InputRow key={j} style={item.color && !item.icon ? { borderLeft: `2px solid ${item.color}` } : undefined}>
                                    <SegmentedField label={item.name} icon={item.icon || ""} iconColor={item.color || ""} value={getAccessLevel(a.access, item.id)} options={getInputs(a.access.global, a.id)} onClick={(value) => updateAccess(a.id, item.id, value as AccessType)} noLabels />
                                </InputRow>
                            ))}
                        </div>
                    }
                >
                    <SegmentedField label={a.label} icon={a.icon} value={a.access.global || "write"} options={getSectionOptions(a.options)} onClick={(value) => updateAccess(a.id, "global", value as AccessType)} />
                </InputRow>
            ))}

            {/* profile action */}
            <InputRow style={{ marginTop: "20px" }}>
                <SelectField label="midi.start_action" options={actionOptions.map((a) => ({ label: a.name, value: a.id }))} value={currentAction} onChange={(value) => updateProfile("action", value)} allowEmpty />
                {currentAction && actionsValue[currentAction] ? <Button title="titlebar.edit" icon="edit" onClick={editAction} /> : null}
            </InputRow>
        </>
    )
}

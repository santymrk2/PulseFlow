import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import { _show } from "../../shared/utils/helpers/shows"
import { Tip } from "../../app/main/Tip"
import { actions, activePopup, activeShow, popupData, scenes, showsCache } from "../../shared/core/stores"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"

// Port de components/main/popups/CustomAction.svelte. Lee: popupData.mode/sceneId (al montar), scenes, la acción del show activo y actions (lista tomada al montar; el botón editar sí sigue el store).
// Escribe: modo "scene" -> scenes[sceneId].action + modified; modo "show" -> showsCache[show activo].settings.customAction (en el lugar, como el Svelte).
// Editar: popupData = { id } + activePopup = "action". Tip usa el port React.
export function CustomAction() {
    const actionsValue = useStore(actions)
    const [{ type, sceneId }] = useState(() => {
        const data = get(popupData)
        return { type: (data?.mode || "show") as "scene" | "show", sceneId: (data?.sceneId || "") as string }
    })
    const [currentAction, setCurrentAction] = useState<string>(() => (type === "scene" ? get(scenes)[sceneId]?.action || "" : _show().get("settings.customAction") || ""))
    const [actionOptions] = useState(() =>
        Object.entries(get(actions))
            .map(([id, a]) => ({ id, name: a.name }))
            .sort((a, b) => a.name?.localeCompare(b.name))
    )

    function updateValue(id: string) {
        if (type === "scene") {
            scenes.update((a) => {
                if (!a[sceneId]) return a

                a[sceneId].action = id
                a[sceneId].modified = Date.now()
                return a
            })
        } else {
            showsCache.update((a) => {
                const showId = get(activeShow)?.id || ""
                if (!a[showId]) return a

                a[showId].settings.customAction = id
                return a
            })
        }

        setCurrentAction(id)
    }

    function editAction() {
        popupData.set({ id: currentAction })
        activePopup.set("action")
    }

    return (
        <>
            <Tip type="info" value={type === "show" ? "show.custom_action_tip" : "tips.custom_action"} bottom={20} />

            <InputRow>
                <SelectField label="midi.start_action" options={actionOptions.map((a) => ({ label: a.name, value: a.id }))} value={currentAction} allowEmpty onChange={(value) => updateValue(value ?? "")} />
                {currentAction && actionsValue[currentAction] ? <Button title="titlebar.edit" icon="edit" onClick={editAction} /> : null}
            </InputRow>
        </>
    )
}

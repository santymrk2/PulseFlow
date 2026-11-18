import { useEffect, useState } from "react"
import { get } from "svelte/store"
import { Tip } from "../main/Tip"
import { actions, activePopup, categories, popupData } from "../../stores"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { SelectField } from "../ui/select-field/SelectField"

// Port de components/main/popups/CategoryAction.svelte. Lee (al montar): popupData.id (categoría) y categories[id].action; lee actions.
// Escribe: popupData = {} al montar; categories[id].action al elegir; popupData = { id: acción } y activePopup = "action" al editar. Tip usa el port React.
export function CategoryAction() {
    const [selectedCategory] = useState<string>(() => get(popupData)?.id)
    const [currentAction, setCurrentAction] = useState<string>(() => get(categories)[selectedCategory]?.action || "")
    const [actionOptions] = useState(() =>
        Object.entries(get(actions))
            .map(([id, a]) => ({ id, name: a.name }))
            .sort((a, b) => a.name?.localeCompare(b.name))
    )
    const actionsValue = useStore(actions)

    useEffect(() => {
        popupData.set({})
    }, [])

    function updateValue(id: string) {
        categories.update((a) => {
            if (!a[selectedCategory]) return a

            a[selectedCategory].action = id
            return a
        })

        setCurrentAction(id)
    }

    function editAction() {
        popupData.set({ id: currentAction })
        activePopup.set("action")
    }

    return (
        <>
            <Tip type="info" value="category.action_tip" bottom={20} />

            <InputRow>
                <SelectField label="midi.start_action" options={actionOptions.map((a) => ({ label: a.name, value: a.id }))} value={currentAction} allowEmpty onChange={(value) => updateValue(value ?? "")} />
                {currentAction && actionsValue[currentAction] ? <Button title="titlebar.edit" icon="edit" onClick={editAction} /> : null}
            </InputRow>
        </>
    )
}

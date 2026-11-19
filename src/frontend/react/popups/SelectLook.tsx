import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import { applyLook } from "../../components/helpers/looks"
import { activeLook, activePopup, looks, popupData } from "../../shared/core/stores"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { CombinedInput } from "../ui/combined-input/CombinedInput"

// Port de components/main/popups/SelectLook.svelte. Lee: popupData (active y trigger al montar), activeLook y looks.
// Escribe: el trigger con el id elegido (o applyLook si no hay trigger), popupData = { id: "select_look", value },
// activePopup = null y, 200 ms después del cierre, popupData = {}.
export function SelectLook() {
    const looksValue = useStore(looks)
    const activeLookValue = useStore(activeLook)
    const [active, setActive] = useState(() => {
        const data = get(popupData)
        return (data.active || get(activeLook) || "") as string
    })

    function select(selectedId: string) {
        setActive(selectedId)

        const data = get(popupData)
        if (data.trigger) data.trigger(selectedId)
        else applyLook(selectedId)

        popupData.set({ id: "select_look", value: selectedId })

        setTimeout(() => {
            setTimeout(() => (get(activePopup) === null ? popupData.set({}) : null), 200)
            activePopup.set(null)
        })
    }

    if (!Object.keys(looksValue).length) {
        return (
            <Center size={1.2} faded style={{ height: "100px", paddingTop: "20px" }}>
                <span>...</span>
            </Center>
        )
    }

    return (
        <>
            {Object.entries(looksValue).map(([id, look]) => (
                <CombinedInput key={id}>
                    <Button style={id === active ? { backgroundColor: "var(--secondary)" } : undefined} onClick={() => select(id)}>
                        {look.name}
                        {id === activeLookValue ? <Icon id="check" size={1} white /> : null}
                    </Button>
                </CombinedInput>
            ))}
        </>
    )
}

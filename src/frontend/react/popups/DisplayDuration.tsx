import { useState } from "react"
import { get } from "svelte/store"
import { drawerTabsData, effects, overlays, selected } from "../../stores"
import { NumberField } from "../ui/number-field/NumberField"

// Port de components/main/popups/DisplayDuration.svelte. Lee: drawerTabsData.overlays.activeSubTab, selected.data y overlays/effects (al montar).
// Escribe: al cambiar, displayDuration de cada id seleccionado que exista en overlays (o effects en la subpestaña "effects"); 0/vacío lo borra.
// Muta en el lugar el objeto del store, como el Svelte (WIP history del original).
export function DisplayDuration() {
    const [{ isEffect, ids }] = useState(() => ({ isEffect: get(drawerTabsData).overlays?.activeSubTab === "effects", ids: get(selected).data }))
    const [currentValue, setCurrentValue] = useState<number | null>(() => (isEffect ? get(effects) : get(overlays))[ids[0]]?.displayDuration || 0)

    function updateValue(value: number | null) {
        setCurrentValue(value)

        const store = isEffect ? effects : overlays
        store.update((a) => {
            ids.forEach((id) => {
                if (!a[id]) return

                if (!value) delete a[id].displayDuration
                else a[id].displayDuration = value
            })
            return a
        })
    }

    return <NumberField label="timer.seconds" value={currentValue ?? 0} max={3600} onChange={updateValue} />
}

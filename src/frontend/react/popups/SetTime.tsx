import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { Item } from "../../../types/Show"
import { clone } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { _show } from "../../shared/utils/helpers/shows"
import { activeEdit, activeShow, overlays, popupData, templates } from "../../shared/core/stores"
import { NumberField } from "../../shared/ui/kit/number-field/NumberField"

// Port de components/main/popups/SetTime.svelte. Lee: popupData.action, activeEdit, showsCache (vía _show/getLayoutRef),
// overlays y templates. Al montar escribe popupData = {}; al cambiar el valor escribe un history UPDATE (overlay/plantilla)
// o setItems (show). Las acciones se calculan sobre una copia de los ítems, como en otros ports (el Svelte mutaba el store en el lugar).
interface Initial {
    action: string
    type: string
    indexes: number[]
    slideId: string
    items: Item[]
    value: number
}

function initial(): Initial {
    const data = get(popupData)
    const edit = get(activeEdit)
    const action = (data.action || "") as string
    const type = (edit.type || "") as string
    const indexes: number[] = edit.items || []
    const slideRef = getLayoutRef()[edit.slide ?? 0] || {}
    let items: Item[] = _show().get("slides")?.[slideRef.id]?.items || []

    if (edit.id) {
        let slide: { items?: Item[] } | undefined
        if (type === "overlay") slide = get(overlays)[edit.id]
        else if (type === "template") slide = get(templates)[edit.id]
        items = slide?.items || []
    }

    const copied = clone(items)
    return { action, type, indexes, slideId: slideRef.id || "", items: copied, value: (items[indexes[0]]?.actions?.[action] || 0) as number }
}

export function SetTime() {
    const [state] = useState(initial)

    useEffect(() => {
        popupData.set({})
    }, [])

    function updateValue(raw: number | null) {
        const { action, type, indexes, items, slideId } = state
        let value: number | null | undefined = raw ?? null
        if (value) value = Number(value)

        items.forEach((_, i: number) => {
            if (!indexes.includes(i) || !items[i]) return

            if (!items[i].actions) items[i].actions = {}

            if (value) items[i].actions![action] = value
            else delete items[i].actions![action]
        })

        if (indexes.some((i) => !items[i])) return

        const edit = get(activeEdit)
        if (type === "overlay" || type === "template") {
            const actions = indexes.map((i) => items[i].actions)
            history({
                id: "UPDATE",
                oldData: { id: edit.id },
                newData: { key: "items", subkey: "actions", data: actions, indexes },
                location: { page: "edit", id: `${edit.type}_items`, override: `itemaction_${indexes.join(",")}` }
            })
            return
        }

        // show
        let actions: any[]
        if (value) {
            actions = items.map((it) => it.actions)
        } else {
            actions = indexes.map((i) => items[i].actions)
        }

        history({
            id: "setItems",
            newData: { style: { key: "actions", values: actions } },
            location: { page: "edit", show: get(activeShow)!, slide: slideId, items: indexes, override: `itemaction_${slideId}_items_${indexes.join(",")}` }
        })
    }

    return <NumberField label="timer.seconds" value={state.value} max={3600} onChange={updateValue} />
}

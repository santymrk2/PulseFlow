// Looks (F5): presets de estilo por salida (modelo ProPresenter).
import { get } from "svelte/store"
import { uid } from "uid"
import { outputs, looks, activeLook } from "../../stores"
import { save } from "../../utils/save"

export interface LookScreens {
    [outputId: string]: string
}

/** Aplica un look: asigna el estilo correspondiente a cada salida de audiencia
 *  que el look menciona y guarda `activeLook`. Las salidas no mencionadas no cambian. */
export function applyLook(id: string) {
    const look = get(looks)[id]
    if (!look) return

    outputs.update((outs) => {
        Object.keys(look.screens || {}).forEach((outputId) => {
            if (outs[outputId]) outs[outputId].style = look.screens[outputId]
        })
        return outs
    })

    activeLook.set(id)
    save()
}

/** Crea un look nuevo a partir del estado actual de las salidas. */
export function createLook(name: string): string {
    const id = uid()
    const screens: { [key: string]: string } = {}
    Object.keys(get(outputs)).forEach((outputId) => {
        screens[outputId] = get(outputs)[outputId]?.style || "default"
    })
    looks.update((a) => {
        a[id] = { name, screens }
        return a
    })
    return id
}

/** Elimina un look (no el activo si es el único). */
export function deleteLook(id: string) {
    looks.update((a) => {
        delete a[id]
        return a
    })
    if (get(activeLook) === id) activeLook.set("default")
}

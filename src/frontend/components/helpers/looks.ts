// Looks (F5): presets de estilo por salida (modelo ProPresenter).
import { get } from "svelte/store"
import { uid } from "uid"
import { outputs, looks, activeLook } from "../../stores"
import { save } from "../../utils/save"
import { history } from "./history"

export interface LookScreens {
    [outputId: string]: string
}

/** Aplica un look: asigna el estilo correspondiente a cada salida de audiencia
 *  que el look menciona y guarda `activeLook`. Las salidas que el look no menciona
 *  (y las de stage) no cambian. El cambio queda registrado en el historial. */
export function applyLook(id: string) {
    const look = get(looks)[id]
    if (!look) return

    // sólo salidas de audiencia cuyo estilo realmente cambia
    const screens: { [outputId: string]: string } = {}
    const outs = get(outputs)
    Object.keys(look.screens || {}).forEach((outputId) => {
        const output = outs[outputId]
        if (!output || output.stageOutput) return

        const styleId = look.screens[outputId]
        if (!styleId || output.style === styleId) return

        screens[outputId] = styleId
    })

    // APPLY_LOOK aplica los estilos y `activeLook`; guarda el estado anterior para deshacer
    history({ id: "APPLY_LOOK", newData: { lookId: id, screens }, location: { page: "none" } })
    save()
}

/** Crea un look nuevo a partir del estado actual de las salidas de audiencia
 *  (las salidas de stage no entran en un look). */
export function createLook(name: string): string {
    const id = uid()
    const screens: { [key: string]: string } = {}
    const outs = get(outputs)
    Object.keys(outs).forEach((outputId) => {
        if (outs[outputId]?.stageOutput) return
        screens[outputId] = outs[outputId]?.style || "default"
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

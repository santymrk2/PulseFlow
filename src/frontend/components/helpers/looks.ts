// Looks (F5): presets de estilo por salida (modelo ProPresenter).
import { get } from "svelte/store"
import { uid } from "uid"
import { outputs, looks, activeLook, styles } from "../../stores"
import { save } from "../../utils/save"
import { history } from "./history"
import type { LookScreen } from "../../../types/Settings"

export interface LookScreens {
    [outputId: string]: string
}

const defaultLayers = { media: true, slide: true, overlays: true }

function layersFromStyle(style: any): { media: boolean; slide: boolean; overlays: boolean } {
    const layers = Array.isArray(style?.layers) ? style.layers : ["background", "slide", "overlays"]
    return {
        media: layers.includes("background"),
        slide: layers.includes("slide"),
        overlays: layers.includes("overlays")
    }
}

function layersToStyleArray(layers: { media: boolean; slide: boolean; overlays: boolean }): string[] {
    const arr: string[] = []
    if (layers.media) arr.push("background")
    if (layers.slide) arr.push("slide")
    if (layers.overlays) arr.push("overlays")
    return arr
}

/** Convierte una celda LookScreen al formato viejo Styles (puente F10.2). */
export function lookScreenToStyle(lookScreen: LookScreen | null | undefined): any {
    if (!lookScreen) return { name: "Default", layers: ["background", "slide", "overlays"] }

    const style: any = { name: "Look" }
    style.layers = layersToStyleArray(lookScreen.layers || defaultLayers)
    if (lookScreen.theme) style.template = lookScreen.theme
    if (lookScreen.themeScripture) style.templateScripture = lookScreen.themeScripture
    if (lookScreen.background !== undefined) style.background = lookScreen.background
    if (lookScreen.backgroundImage !== undefined) style.backgroundImage = lookScreen.backgroundImage
    if (lookScreen.clearStyleBackgroundOnText !== undefined) style.clearStyleBackgroundOnText = lookScreen.clearStyleBackgroundOnText
    if (lookScreen.fit !== undefined) style.fit = lookScreen.fit
    if (lookScreen.blurAmount !== undefined) style.blurAmount = lookScreen.blurAmount
    if (lookScreen.blurOpacity !== undefined) style.blurOpacity = lookScreen.blurOpacity
    if (lookScreen.volume !== undefined) style.volume = lookScreen.volume
    if (lookScreen.transition) style.transition = lookScreen.transition
    if (lookScreen.lines !== undefined) style.lines = lookScreen.lines
    if (lookScreen.showAsFaded !== undefined) style.showAsFaded = lookScreen.showAsFaded
    if (lookScreen.lineOpacity !== undefined) style.lineOpacity = lookScreen.lineOpacity
    if (lookScreen.skipVirtualBreaks !== undefined) style.skipVirtualBreaks = lookScreen.skipVirtualBreaks
    if (lookScreen.metadata) style.metadata = lookScreen.metadata
    return style
}

/** Convierte un estilo viejo a LookScreen. */
export function styleToLookScreen(style: any): LookScreen {
    const src = style || {}
    const lookScreen: LookScreen = {
        layers: layersFromStyle(src)
    }
    if (src.template) lookScreen.theme = src.template
    if (src.templateScripture) lookScreen.themeScripture = src.templateScripture
    if (src.background !== undefined) lookScreen.background = src.background
    if (src.backgroundImage !== undefined) lookScreen.backgroundImage = src.backgroundImage
    if (src.clearStyleBackgroundOnText !== undefined) lookScreen.clearStyleBackgroundOnText = src.clearStyleBackgroundOnText
    if (src.fit !== undefined) lookScreen.fit = src.fit
    if (src.blurAmount !== undefined) lookScreen.blurAmount = src.blurAmount
    if (src.blurOpacity !== undefined) lookScreen.blurOpacity = src.blurOpacity
    if (src.volume !== undefined) lookScreen.volume = src.volume
    if (src.transition) lookScreen.transition = src.transition
    if (src.lines !== undefined) lookScreen.lines = src.lines
    if (src.showAsFaded !== undefined) lookScreen.showAsFaded = src.showAsFaded
    if (src.lineOpacity !== undefined) lookScreen.lineOpacity = src.lineOpacity
    if (src.skipVirtualBreaks !== undefined) lookScreen.skipVirtualBreaks = src.skipVirtualBreaks
    if (src.metadata) lookScreen.metadata = src.metadata
    return lookScreen
}

let _activeLookSub: (() => void) | null = null

/** Regenera el puente Look → styles (F10.2). Llamar una vez al inicializar. */
export function startLookBridge() {
    if (_activeLookSub) return
    const update = () => {
        const currentLookId = get(activeLook)
        const look = get(looks)[currentLookId]
        const outs = get(outputs)
        if (!look) return

        styles.update((allStyles) => {
            Object.keys(outs).forEach((outputId) => {
                if (outs[outputId]?.stageOutput || outs[outputId]?.kind === "stage") return
                const cell = look.screens?.[outputId]
                if (!cell) return
                allStyles[`__look__${outputId}`] = lookScreenToStyle(cell)
                if (outs[outputId].style !== `__look__${outputId}`) {
                    outputs.update((a) => {
                        if (a[outputId]) a[outputId].style = `__look__${outputId}`
                        return a
                    })
                }
            })
            return allStyles
        })
    }
    _activeLookSub = looks.subscribe(update)
    activeLook.subscribe(update)
    outputs.subscribe(update)
}

/** Aplica un look: activa el look elegido (F10.2). */
export function applyLook(id: string) {
    const look = get(looks)[id]
    if (!look) return

    const outs = get(outputs)
    const screens: { [outputId: string]: any } = {}
    Object.keys(look.screens || {}).forEach((outputId) => {
        const output = outs[outputId]
        if (!output || output.stageOutput || output.kind === "stage") return
        screens[outputId] = look.screens[outputId]
    })

    activeLook.set(id)
    history({ id: "APPLY_LOOK", newData: { lookId: id, screens }, location: { page: "none" } })
    save()
}

/** Crea un look nuevo a partir del estado actual de las salidas de audiencia
 *  (las salidas de stage no entran en un look). */
export function createLook(name: string): string {
    const id = uid()
    const screens: { [key: string]: LookScreen } = {}
    const outs = get(outputs)
    Object.keys(outs).forEach((outputId) => {
        if (outs[outputId]?.stageOutput || outs[outputId]?.kind === "stage") return
        const currentStyle = get(styles)[outs[outputId]?.style || "default"]
        screens[outputId] = styleToLookScreen(currentStyle)
    })
    looks.update((a) => {
        a[id] = { name, transitionMs: 1000, screens }
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
    if (get(activeLook) === id) {
        const keys = Object.keys(get(looks))
        activeLook.set(keys[0] || "default")
    }
}

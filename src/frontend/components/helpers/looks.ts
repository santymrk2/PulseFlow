// Looks (F5/F10): presets de pantallas de audiencia (modelo ProPresenter).
// Un Look tiene una celda LookScreen por pantalla de audiencia; el puente
// (F10.2) traduce cada celda al formato viejo Styles para el resto del código.
import { get } from "svelte/store"
import { uid } from "uid"
import type { Output, Outputs } from "../../../types/Output"
import type { Look, LookScreen, Styles } from "../../../types/Settings"
import { activeLook, looks, outputs, styles } from "../../stores"
import { save } from "../../utils/save"
import { clone } from "./array"
import { history } from "./history"

/** Prefijo de las entradas internas de `styles` que genera el puente. */
export const LOOK_STYLE_PREFIX = "__look__"

export function lookStyleId(outputId: string): string {
    return LOOK_STYLE_PREFIX + outputId
}

export function isStageOutput(output?: Output): boolean {
    return !!output?.stageOutput || output?.kind === "stage"
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
    if (src.transition !== undefined) lookScreen.transition = src.transition
    if (src.lines !== undefined) lookScreen.lines = src.lines
    if (src.showAsFaded !== undefined) lookScreen.showAsFaded = src.showAsFaded
    if (src.lineOpacity !== undefined) lookScreen.lineOpacity = src.lineOpacity
    if (src.skipVirtualBreaks !== undefined) lookScreen.skipVirtualBreaks = src.skipVirtualBreaks
    if (src.metadata) lookScreen.metadata = src.metadata
    return lookScreen
}

// MIGRACIÓN (F10.1)

export interface LooksMigrationInput {
    looks: { [id: string]: Look }
    styles: { [id: string]: Styles }
    outputs: Outputs
    activeLook: string
    stylesLegacyBackup: { [id: string]: Styles }
}

export interface LooksMigrationResult {
    looks: { [id: string]: Look }
    outputs: Outputs
    activeLook: string
    stylesLegacyBackup: { [id: string]: Styles }
    changed: boolean
}

/**
 * Migración idempotente al modelo de F10 (pura, sin stores; ver
 * `docs/design/pantallas-y-looks.md` sección "Migración"):
 *
 * 1. cada Look gana una celda LookScreen por pantalla de audiencia, copiando los
 *    campos del estilo que referenciaba (o el estilo actual de la salida);
 * 2. si no hay Looks, se crea "Default" con el estilo actual de cada salida y se
 *    pone en vivo;
 * 3. `aspectRatio`/`cropping` del estilo pasan a la Pantalla (si la salida no
 *    tenía propios);
 * 4. `stageOutput` pasa a `kind: "stage"` + `stageLayout` (se conserva
 *    `stageOutput` porque el resto del código todavía lo lee);
 * 5. los estilos originales quedan copiados en `stylesLegacyBackup` (no se
 *    borra nada).
 *
 * Correrla dos veces produce exactamente el mismo resultado.
 */
export function migrateLooksSettings(input: LooksMigrationInput): LooksMigrationResult {
    const stylesData = input.styles || {}
    const outs: Outputs = clone(input.outputs || {})
    const migratedLooks: { [id: string]: Look } = clone(input.looks || {})
    const backup: { [id: string]: Styles } = { ...(input.stylesLegacyBackup || {}) }
    let changed = false

    // 5. stylesLegacyBackup (una sola vez; sin las entradas del puente)
    const legacyStyleIds = Object.keys(stylesData).filter((id) => !id.startsWith(LOOK_STYLE_PREFIX))
    if (!Object.keys(backup).length && legacyStyleIds.length) {
        legacyStyleIds.forEach((id) => (backup[id] = stylesData[id]))
        changed = true
    }

    // 3+4. salidas
    Object.keys(outs).forEach((outputId) => {
        const output = outs[outputId]
        if (!output) return

        if (output.stageOutput && output.kind !== "stage") {
            output.kind = "stage"
            if (!output.stageLayout) output.stageLayout = output.stageOutput
            changed = true
        } else if (!output.stageOutput && !output.kind) {
            output.kind = "audience"
            changed = true
        }

        if (isStageOutput(output)) return
        const style: any = stylesData[output.style || ""]
        if (output.aspectRatio === undefined && style?.aspectRatio) {
            output.aspectRatio = style.aspectRatio
            changed = true
        }
        if (output.cropping === undefined && style?.cropping) {
            output.cropping = style.cropping
            changed = true
        }
    })

    const audienceIds = Object.keys(outs).filter((id) => outs[id] && !isStageOutput(outs[id]))

    // 1+2. looks
    if (!Object.keys(migratedLooks).length) {
        const screens: { [id: string]: LookScreen } = {}
        audienceIds.forEach((outputId) => {
            screens[outputId] = styleToLookScreen(stylesData[outs[outputId].style || ""])
        })
        migratedLooks.default = { name: "Default", transitionMs: 1000, screens }
        changed = true
    } else {
        Object.keys(migratedLooks).forEach((lookId) => {
            const look = migratedLooks[lookId]
            if (!look) return

            const screens: { [id: string]: LookScreen } = {}
            audienceIds.forEach((outputId) => {
                const cell: any = look.screens?.[outputId]
                if (cell && typeof cell === "object") {
                    screens[outputId] = cell
                    return
                }
                // formato viejo: id de estilo (string), o ausente → estilo actual de la salida
                const styleId = typeof cell === "string" && cell ? cell : outs[outputId].style || ""
                screens[outputId] = styleToLookScreen(stylesData[styleId])
                changed = true
            })

            // las celdas de salidas de stage o de pantallas que ya no existen no viajan
            Object.keys(look.screens || {}).forEach((outputId) => {
                if (!audienceIds.includes(outputId)) changed = true
            })

            if (typeof look.transitionMs !== "number") {
                look.transitionMs = 1000
                changed = true
            }

            migratedLooks[lookId] = { ...look, screens }
        })
    }

    // 2 (activo) / guardia: el look activo siempre existe
    let activeLookId = input.activeLook
    if (!migratedLooks[activeLookId]) {
        activeLookId = migratedLooks.default ? "default" : Object.keys(migratedLooks)[0] || activeLookId
        changed = true
    }

    return { looks: migratedLooks, outputs: outs, activeLook: activeLookId, stylesLegacyBackup: backup, changed }
}

// PUENTE (F10.2)

/** Entrada `__look__<outputId>` de `styles` para una celda del look en vivo. */
export function buildLookStyle(look: Look, cell: LookScreen): Styles {
    const style: any = lookScreenToStyle(cell)
    // `transitionMs` es la transición al hacerlo live (ms, como el resto de las
    // transiciones de FreeShow); una transición explícita de la celda tiene prioridad.
    if (!cell?.transition && look.transitionMs) {
        style.transition = {
            text: { type: "fade", duration: look.transitionMs, easing: "" },
            media: { type: "fade", duration: look.transitionMs, easing: "" }
        }
    }
    return style
}

/** Mapa resultante de `styles` tras regenerar las entradas del puente (puro):
 *  quita las entradas viejas y agrega las del look en vivo. */
export function computeLookBridgeStyles(look: Look | undefined, outputsData: Outputs, stylesData: { [id: string]: Styles }): { [id: string]: Styles } {
    const next: { [id: string]: Styles } = {}
    Object.keys(stylesData || {}).forEach((id) => {
        if (!id.startsWith(LOOK_STYLE_PREFIX)) next[id] = stylesData[id]
    })
    if (!look) return next

    Object.keys(outputsData).forEach((outputId) => {
        const cell = look.screens?.[outputId]
        if (!cell || isStageOutput(outputsData[outputId])) return
        next[lookStyleId(outputId)] = buildLookStyle(look, cell)
    })
    return next
}

/** Punteros `output.style` que el puente debe actualizar (puro; sólo los que cambian). */
export function computeLookOutputPointers(look: Look | undefined, outputsData: Outputs): { [outputId: string]: string } {
    const pointers: { [outputId: string]: string } = {}
    if (!look) return pointers

    Object.keys(outputsData).forEach((outputId) => {
        const output = outputsData[outputId]
        if (isStageOutput(output) || !look.screens?.[outputId]) return
        const styleId = lookStyleId(outputId)
        if (output.style !== styleId) pointers[outputId] = styleId
    })
    return pointers
}

let _bridgeActive = false

/** Regenera el puente Look → styles (F10.2). Llamar una vez al arrancar. */
export function startLookBridge() {
    if (_bridgeActive) return
    _bridgeActive = true

    const update = () => {
        const look = get(looks)[get(activeLook)]
        const outs = get(outputs)
        const currentStyles = get(styles)

        const nextStyles = computeLookBridgeStyles(look, outs, currentStyles)
        if (JSON.stringify(nextStyles) !== JSON.stringify(currentStyles)) styles.set(nextStyles)

        const pointers = computeLookOutputPointers(look, outs)
        if (Object.keys(pointers).length) {
            outputs.update((a) => {
                Object.entries(pointers).forEach(([outputId, styleId]) => {
                    if (a[outputId]) a[outputId].style = styleId
                })
                return a
            })
        }
    }

    looks.subscribe(update)
    activeLook.subscribe(update)
    outputs.subscribe(update)
}

// LOOKS

/** Aplica un look (lo pone en vivo). Su `transitionMs` es la transición con la
 *  que el engine funde hacia el nuevo estado (F10.2). */
export function applyLook(id: string) {
    const look = get(looks)[id]
    if (!look) return

    // registrar antes de cambiar el look activo: el historial captura el anterior
    history({ id: "APPLY_LOOK", newData: { lookId: id }, location: { page: "none" } })
    activeLook.set(id)
    // el puente (suscrito a activeLook) ya regeneró los estilos __look__; tocar
    // outputs dispara el reenvío de escenas de todas las salidas
    outputs.update((a) => ({ ...a }))
    save()
}

/** Crea un look nuevo a partir del look en vivo (o del estilo actual de cada
 *  salida si no hay look activo). Las salidas de stage no entran en un look. */
export function createLook(name: string): string {
    const id = uid()
    const active = get(looks)[get(activeLook)]
    const screens: { [key: string]: LookScreen } = {}
    const outs = get(outputs)
    Object.keys(outs).forEach((outputId) => {
        if (isStageOutput(outs[outputId])) return
        if (active?.screens?.[outputId]) screens[outputId] = clone(active.screens[outputId])
        else screens[outputId] = styleToLookScreen(get(styles)[outs[outputId]?.style || "default"])
    })

    looks.update((a) => {
        a[id] = { name, transitionMs: 1000, screens }
        return a
    })
    return id
}

/** Elimina un look (no el activo si es el último). */
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

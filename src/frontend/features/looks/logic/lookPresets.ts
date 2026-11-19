import { looks } from "../../../shared/core/stores"
import { createLook } from "../../../shared/utils/helpers/looks"

/** Capas de cada plantilla. "speaker": las salidas de stage no entran en un Look, así que
 *  se adapta a lo que existe: texto del slide + overlays (timers, mensajes), sin media. */
export const LOOK_PRESETS = {
    default: { media: true, slide: true, overlays: true },
    lyrics: { media: false, slide: true, overlays: false },
    speaker: { media: false, slide: true, overlays: true }
} as const
export type LookPreset = keyof typeof LOOK_PRESETS

/** Look nuevo (misma base que `createLook`) con las capas de la plantilla en cada pantalla. */
export function createLookFromPreset(preset: LookPreset, name: string): string {
    const id = createLook(name)
    looks.update((a) => {
        const screens = Object.fromEntries(Object.entries(a[id].screens).map(([outputId, screen]) => [outputId, { ...screen, layers: { ...LOOK_PRESETS[preset] } }]))
        return { ...a, [id]: { ...a[id], screens } }
    })
    return id
}

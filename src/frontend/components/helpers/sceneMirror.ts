import type { Output } from "../../../types/Output"

/** Una pantalla en modo espejo muestra la escena de la pantalla que replica. */
export function getSceneSourceId(id: string, outputsData: { [id: string]: Output }): string {
    const output = outputsData[id]
    const mirrorOf = output?.mirrorOf
    if (output?.screenType === "mirror" && mirrorOf && mirrorOf !== id && outputsData[mirrorOf]) return mirrorOf
    return id
}

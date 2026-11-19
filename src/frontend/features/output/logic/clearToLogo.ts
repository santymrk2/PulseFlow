import { get } from "../../../shared/core/lib/store"
import { outLocked, special } from "../../../shared/core/stores"
import { getAllActiveOutputIds, setOutput } from "../../../shared/utils/helpers/output"
import { clearAll } from "./clear"

/** Ruta del logo de salida (opcional en `special`: los settings viejos no lo tienen). */
function getOutputLogo(): string {
    const logo = get(special).outputLogo
    return typeof logo === "string" ? logo : ""
}

// Limpia todo y deja el logo como fondo en las salidas de audiencia activas.
export function clearToLogo() {
    const path = getOutputLogo()
    if (!path || get(outLocked)) return

    clearAll(true)
    const name = path.split(/[\\/]/).pop() || path
    getAllActiveOutputIds().forEach((outputId) => {
        setOutput("background", { name, type: "image", path, id: path, loop: true, muted: true, ignoreLayer: false }, false, outputId)
    })
}

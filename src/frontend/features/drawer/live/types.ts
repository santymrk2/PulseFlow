import type { MouseEvent as ReactMouseEvent } from "react"
import type { CameraData } from "../../media/logic/cameraManager"

// `Screen` y el detalle de selección compartido por las listas de entradas de live/*.
// Svelte despachaba CustomEvent("click", { detail: { event, screen | cam } }); en React son callbacks.
export interface Screen {
    id: string
    name: string
    group?: string
}

// Los ports entregan el SyntheticEvent del click; no despachan CustomEvent como el Svelte original.
export type InputEvent = ReactMouseEvent<HTMLElement>

export interface InputSelectDetail {
    event: InputEvent
    cam?: CameraData
    screen?: Screen
}

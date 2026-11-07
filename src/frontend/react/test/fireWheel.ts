import { fireEvent } from "@testing-library/react"

export interface WheelInit {
    deltaY?: number
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    clientX?: number
    clientY?: number
}

// happy-dom ignora los modificadores en el init de WheelEvent: se fijan sobre el evento antes de despacharlo
export function fireWheel(target: Element | Window, init: WheelInit) {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: init.deltaY ?? 0 })
    for (const key of ["ctrlKey", "metaKey", "shiftKey", "clientX", "clientY"] as const) Object.defineProperty(event, key, { value: init[key] ?? (key.endsWith("Key") ? false : 0) })
    fireEvent(target, event)
    return event
}

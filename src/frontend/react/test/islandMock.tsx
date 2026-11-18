import { act } from "@testing-library/react"
import type { ReactNode } from "react"

// Doble de SvelteIsland para tests: registra props, eventos y slots de cada isla por nombre (`component.isla`).
export interface IslandCall {
    props: Record<string, unknown>
    events?: Record<string, (event: CustomEvent) => void>
    slots?: Record<string, ReactNode>
}
export const islands: Record<string, IslandCall> = {}

interface MockProps {
    component: { isla: string }
    props?: Record<string, unknown>
    events?: Record<string, (event: CustomEvent) => void>
    slots?: Record<string, ReactNode>
}
export function SvelteIslandMock({ component, props, events, slots }: MockProps) {
    islands[component.isla] = { props: props ?? {}, events, slots }
    return <div data-isla={component.isla}>{slots?.default}</div>
}

// Doble de un port React ya migrado: conserva el registro `islands[nombre]` que usan las aserciones heredadas y
// expone además `data-isla`/`data-props` en el DOM. Uso en tests:
// vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))
export function makePortMock(name: string) {
    return function PortMock(props: Record<string, unknown>) {
        islands[name] = { props }
        return <div data-isla={name} data-props={JSON.stringify(props)} />
    }
}

export const emit = (name: string, event: string, detail: unknown) => act(() => islands[name].events?.[event]?.(new CustomEvent(event, { detail })))
export const clearIslands = () => Object.keys(islands).forEach((key) => delete islands[key])

import { act } from "@testing-library/react"

// Doble de SvelteIsland para tests: registra props y eventos de cada isla por nombre (`component.isla`).
export interface IslandCall {
    props: Record<string, unknown>
    events?: Record<string, (event: CustomEvent) => void>
}
export const islands: Record<string, IslandCall> = {}

interface MockProps {
    component: { isla: string }
    props?: Record<string, unknown>
    events?: Record<string, (event: CustomEvent) => void>
}
export function SvelteIslandMock({ component, props, events }: MockProps) {
    islands[component.isla] = { props: props ?? {}, events }
    return <div data-isla={component.isla} />
}

export const emit = (name: string, event: string, detail: unknown) => act(() => islands[name].events?.[event]?.(new CustomEvent(event, { detail })))
export const clearIslands = () => Object.keys(islands).forEach((key) => delete islands[key])

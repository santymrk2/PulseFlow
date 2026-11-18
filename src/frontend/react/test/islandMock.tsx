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

export const emit = (name: string, event: string, detail: unknown) => act(() => islands[name].events?.[event]?.(new CustomEvent(event, { detail })))
export const clearIslands = () => Object.keys(islands).forEach((key) => delete islands[key])

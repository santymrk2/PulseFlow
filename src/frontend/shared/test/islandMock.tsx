import { act } from "@testing-library/react"

// Registro de props y eventos de los dobles de ports usados por las aserciones heredadas.
export interface IslandCall {
    props: Record<string, unknown>
    events?: Record<string, (event: CustomEvent) => void>
}
export const islands: Record<string, IslandCall> = {}

// Doble de un port React: conserva el registro `islands[nombre]` que usan las aserciones heredadas y
// expone además `data-isla`/`data-props` en el DOM. Uso en tests:
// vi.mock("../../app/main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("./islandMock")>("./islandMock")).makePortMock("Tip") }))
export function makePortMock(name: string) {
    return function PortMock(props: Record<string, unknown>) {
        islands[name] = { props }
        return <div data-isla={name} data-props={JSON.stringify(props)} />
    }
}

export const emit = (name: string, event: string, detail: unknown) => act(() => islands[name].events?.[event]?.(new CustomEvent(event, { detail })))
export const clearIslands = () => Object.keys(islands).forEach((key) => delete islands[key])

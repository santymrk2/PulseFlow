import type { Output } from "../../../types/Output"
import type { LayoutRef } from "../../../types/Show"
import { SvelteIsland } from "../bridge/SvelteIsland"
import ShowImpl from "../../components/output/tools/ShowImpl.svelte"

export interface ShowProps {
    currentOutput: Output
    ref: LayoutRef[] | { temp: boolean; items: unknown; id: string }[] | undefined
    linesIndex: null | number
    maxLines: null | number
}

export function Show(props: ShowProps) {
    return <SvelteIsland component={ShowImpl} props={props as unknown as Record<string, unknown>} />
}

export default Show

import type { MouseEvent as ReactMouseEvent } from "react"
import { OMT } from "../../../../types/Channels"
import type { Screen } from "./types"
import { StreamFrame } from "./StreamFrame"

export interface OMTStreamProps {
    screen: Screen
    background?: boolean
    mirror?: boolean
    outputId?: string
    style?: string
    onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

// Port de components/drawer/live/OMTStream.svelte.
export function OMTStream(props: OMTStreamProps) {
    return <StreamFrame channel={OMT} selectId="omt" icon="omt" {...props} />
}

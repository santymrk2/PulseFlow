import type { MouseEvent as ReactMouseEvent } from "react"
import { NDI } from "../../../../types/Channels"
import type { Screen } from "./types"
import { StreamFrame } from "./StreamFrame"

export interface NDIStreamProps {
    screen: Screen
    background?: boolean
    mirror?: boolean
    outputId?: string
    style?: string
    onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

// Port de components/drawer/live/NDIStream.svelte.
export function NDIStream(props: NDIStreamProps) {
    return <StreamFrame channel={NDI} selectId="ndi" icon="ndi" {...props} />
}

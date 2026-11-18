import type { OutSlide, SlideData } from "../../../types/Show"
import { SvelteIsland } from "../bridge/SvelteIsland"
import SlideContentImpl from "../../components/output/layers/SlideContentImpl.svelte"

export interface SlideContentProps {
    outputId: string
    outSlide: OutSlide
    isClearing?: boolean
    slideData: SlideData | null
    currentSlide: unknown
    currentStyle: unknown
    animationData: unknown
    currentLineId?: string
    lines: unknown
    ratio: number
    mirror?: boolean
    preview?: boolean
    transition?: unknown
    transitionEnabled?: boolean
    styleIdOverride?: string
}

export function SlideContent(props: SlideContentProps) {
    return <SvelteIsland component={SlideContentImpl} props={props as unknown as Record<string, unknown>} />
}

export default SlideContent

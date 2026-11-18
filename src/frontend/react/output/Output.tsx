import type { OutData } from "../../../types/Output"
import { SvelteIsland } from "../bridge/SvelteIsland"
import OutputImpl from "../../components/output/OutputImpl.svelte"

export interface OutputProps {
    outputId?: string
    style?: string
    ratio?: number
    mirror?: boolean
    preview?: boolean
    styleIdOverride?: string
    outOverride?: OutData | null
}

export function Output({ outputId = "", style = "", ratio = 0, mirror = false, preview = false, styleIdOverride = "", outOverride = null }: OutputProps) {
    return <SvelteIsland component={OutputImpl} props={{ outputId, style, ratio, mirror, preview, styleIdOverride, outOverride }} />
}

export default Output

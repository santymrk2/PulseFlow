import { SvelteIsland } from "../bridge/SvelteIsland"
import PreviewImpl from "../../components/output/preview/PreviewImpl.svelte"

export interface PreviewProps {}

export function Preview(_props: PreviewProps) {
    return <SvelteIsland component={PreviewImpl} props={{}} />
}

export default Preview

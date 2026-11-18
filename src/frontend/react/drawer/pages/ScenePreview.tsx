import type { Scene } from "../../../../types/Show"
import Output from "../../../components/output/Output.svelte"
import { getAllActiveOutputIds, getAllNormalOutputs } from "../../../components/helpers/output"
import { outputs } from "../../../stores"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"

// Port de components/drawer/pages/ScenePreview.svelte. Output sigue siendo Svelte: se monta como isla con el mismo outOverride.
export interface ScenePreviewProps {
    scene: Scene
}

export function ScenePreview({ scene }: ScenePreviewProps) {
    const outputsValue = useStore(outputs)

    const enabledOutputIds = getAllNormalOutputs().map((a) => a.id)
    const activeOutputIds = getAllActiveOutputIds()
    const filteredOutputs = scene?.bindings?.length ? enabledOutputIds.filter((id) => scene.bindings!.includes(id)) : activeOutputIds
    const firstOutputId = filteredOutputs[0] || activeOutputIds[0] || Object.keys(outputsValue)[0] || ""

    const content = scene?.content || {}
    const sceneData = { ...content, name: scene?.name || "", id: scene?.id || "" }

    const out = outputsValue[firstOutputId]?.out
    const outOverride = { ...(out || {}), scene: sceneData }

    return <SvelteIsland component={Output} props={{ outputId: firstOutputId, style: "width: 100%; height: 100%;", outOverride, mirror: true }} />
}

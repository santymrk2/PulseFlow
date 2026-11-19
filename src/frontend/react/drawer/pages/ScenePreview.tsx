import type { Scene } from "../../../../types/Show"
import { getAllActiveOutputIds, getAllNormalOutputs } from "../../../shared/utils/helpers/output"
import { outputs } from "../../../shared/core/stores"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Output } from "../../output/Output"

// Port de components/drawer/pages/ScenePreview.svelte. Renderiza Output con el mismo outOverride.
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

    return <Output outputId={firstOutputId} style="width: 100%; height: 100%;" outOverride={outOverride} mirror />
}

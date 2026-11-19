import { keysToID, sortByName, sortObject, clone } from "../../shared/utils/helpers/array"
import { toggleOutputs } from "../../shared/utils/helpers/output"
import { outputs, outputState } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { useFreshStore } from "../../shared/ui/hooks/useFreshStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { ListRow } from "../../shared/ui/kit/list-row/ListRow"
import { SectionHeader } from "../../shared/ui/kit/section-header/SectionHeader"
import styles from "./ScreenList.module.css"

// Port de components/screens/ScreenList.svelte (F24.14): columna de pantallas con el kit (section-header + list-row, 240 px).
// `outputs` y `outputState` se mutan en el lugar en toda la app: useFreshStore entrega copias para que el Compiler recalcule.
export interface ScreenListProps {
    selectedOutputId?: string | null
    onSelect?: (id: string) => void
    onAddAudience?: () => void
    onAddStage?: () => void
}

export function ScreenList({ selectedOutputId = null, onSelect, onAddAudience, onAddStage }: ScreenListProps) {
    const outputsValue = useFreshStore(outputs, clone)
    const states = useFreshStore(outputState)

    const list = sortObject(sortByName(keysToID(outputsValue)), "stageOutput")
    const audience = list.filter((o) => !o.stageOutput)
    const stage = list.filter((o) => o.stageOutput)

    // en vivo = alguna salida del grupo está activa (mismo criterio que la barra superior)
    const audienceLive = (states || []).some((s) => s.active === true && audience.some((o) => o.id === s.id))
    const stageLive = (states || []).some((s) => s.active === true && stage.some((o) => o.id === s.id))

    function toggleGroup(group: "audience" | "stage") {
        const ids = (group === "stage" ? stage : audience).map((o) => o.id)
        toggleOutputs(ids)
    }

    const rows = (group: typeof list) =>
        group.map((out, index) => (
            <ListRow
                key={index}
                active={selectedOutputId === out.id}
                onClick={() => onSelect?.(out.id)}
                trailing={
                    <>
                        <span className={styles.res}>
                            {out.bounds?.width || 0}×{out.bounds?.height || 0}
                        </span>
                        {out.enabled && out.active ? <span className={styles.dot}></span> : null}
                    </>
                }
            >
                {out.name || out.id}
            </ListRow>
        ))

    return (
        <>
            <div className={styles.group}>
                <SectionHeader
                    actions={
                        <>
                            <Button variant="live" size="icon-sm" icon="display" iconSize={0.9} aria-pressed={audienceLive} title="screen_config.show_audience" onNativeClick={() => toggleGroup("audience")} />
                            <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="settings.new_output" onNativeClick={() => onAddAudience?.()} />
                        </>
                    }
                >
                    {translateText("screen_config.audience")}
                </SectionHeader>
                {rows(audience)}
            </div>

            <div className={styles.group}>
                <SectionHeader
                    actions={
                        <>
                            <Button variant="live" size="icon-sm" icon="stage" iconSize={0.9} aria-pressed={stageLive} title="screen_config.show_stage" onNativeClick={() => toggleGroup("stage")} />
                            <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="settings.new_output" onNativeClick={() => onAddStage?.()} />
                        </>
                    }
                >
                    {translateText("screen_config.stage")}
                </SectionHeader>
                {rows(stage)}
            </div>
        </>
    )
}

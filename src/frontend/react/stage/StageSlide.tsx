import { useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react"
import type { StageLayout } from "../../../types/Stage"
import { allOutputs, outputs, stageShows } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getAccess } from "../../shared/utils/profile"
import { getSortedStageItems, shouldItemBeShown } from "../../components/edit/scripts/itemHelpers"
import { getStageOutputId, getStageResolution } from "../../shared/utils/helpers/output"
import { getSlideTextItems, stageItemToItem } from "../../components/stage/stage"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import { Icon } from "../../shared/ui/helpers/Icon"
import { triggerClickOnEnterSpace } from "../../shared/ui/helpers/triggerClickOnEnterSpace"
import { useStore } from "../../shared/ui/hooks/useStore"
import { SelectElem } from "../../shared/ui/system/SelectElem"
import { HiddenInput, type HiddenInputEdit } from "../../shared/ui/kit/hidden-input/HiddenInput"
import { Zoomed } from "../slide/Zoomed"
import { Stagebox } from "./Stagebox"
import styles from "./StageSlide.module.css"

export interface StageSlideProps {
    layout: StageLayout
    id: string
    columns?: number
    active?: boolean
    list?: boolean
    selectable?: boolean
    onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

// Port de components/stage/StageSlide.svelte (F24.19a).
export function StageSlide({ layout, id, columns = 1, active = false, list = false, selectable = true, onClick }: StageSlideProps) {
    const currentOutputs = useStore(outputs)
    const currentAllOutputs = useStore(allOutputs)
    const currentStageShows = useStore(stageShows)

    const [ratio, setRatio] = useState(1)
    const [conditionsUpdater, setConditionsUpdater] = useState(0)

    const profile = getAccess("stage") as Record<string, string>
    const readOnly = profile.global === "read" || profile[id] === "read"
    const stageOutputId = getStageOutputId(currentOutputs)
    const resolution = getStageResolution(stageOutputId, currentOutputs)
    const stageItems = getSortedStageItems(id, currentStageShows[id])

    function edit(detail: HiddenInputEdit) {
        if (readOnly) return
        const name = detail.value
        stageShows.update((all) => {
            if (!all[id]) return all
            all[id].name = name
            all[id].modified = Date.now()
            return all
        })
    }

    useEffect(() => {
        const interval = setInterval(() => {
            if (!Array.isArray(stageItems)) return
            if (stageItems.some((item) => item?.conditions)) setConditionsUpdater((value) => value + 1)
        }, 1000)
        return () => clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- el Svelte original sólo verificaba los ítems vigentes
    }, [stageItems])

    const mainStyle: CSSProperties = { width: `${100 / columns}%` }
    const slideClass = `slide context #stage_slide${readOnly ? "_readonly" : ""}`

    return (
        <div className={`main ${styles.main} ${list ? `list ${styles.list}` : ""} ${active ? `active ${styles.active}` : ""}`} style={mainStyle}>
            <div className={`${slideClass} ${styles.slide} ${layout.disabled ? `disabled ${styles.disabled}` : ""}`} style={cssTextToStyle(layout.settings.color ? `background-color: ${layout.settings.color};` : "")} tabIndex={0} role="button" onClick={onClick} onKeyDown={triggerClickOnEnterSpace}>
                <div style={{ width: "100%" }}>
                    <SelectElem id="stage" data={{ id }} selectable={selectable}>
                        <Zoomed background={layout.items.length ? "black" : "transparent"} style="width: 100%;" resolution={resolution} id={stageOutputId} isStage disableStyle center onRatioChange={setRatio}>
                            {stageItems.map((item) => {
                                const showItem = (item.type || item.enabled !== false) && (!item.conditions?.showItem && !(item as { bindings?: unknown[] }).bindings?.length ? true : shouldItemBeShown(stageItemToItem(item), item.type === "slide_text" ? getSlideTextItems(layout, item, currentOutputs || currentAllOutputs) : [], { type: "stage" }, conditionsUpdater))
                                if (!showItem) return null
                                return <Stagebox key={item.id} id={item.id} item={item} ratio={ratio} stageLayout={layout} disableStagePreview />
                            })}
                        </Zoomed>
                        <div className={`label ${styles.label}`} style={{ position: "relative" }} data-title={layout.name}>
                            {layout.password ? (
                                <span style={{ position: "absolute", left: "5px" }} data-title={translateText("remote.password")}>
                                    <Icon id="locked" size={0.8} style={cssTextToStyle("opacity: 0.5;")} white />
                                </span>
                            ) : null}
                            <span className={`text ${styles.text}`}>
                                <HiddenInput value={layout.name} id={`stage_${id}`} allowEmpty={false} allowEdit={!readOnly} onEdit={edit} />
                            </span>
                        </div>
                    </SelectElem>
                </div>
            </div>
        </div>
    )
}

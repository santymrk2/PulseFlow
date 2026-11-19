import { useEffect, useRef, useState } from "react"
import type { StageItem } from "../../../types/Stage"
import { activeStage, allOutputs, currentOutputSettings, outputs, stageShows, toggleOutputEnabled } from "../../shared/core/stores"
import { centerZoom } from "../../components/edit/scripts/zoom"
import { getSortedStageItems, shouldItemBeShown } from "../../components/edit/scripts/itemHelpers"
import { history } from "../../components/helpers/history"
import { enableStageOutput, getStageOutputId, getStageResolution } from "../../components/helpers/output"
import { getStyles } from "../../components/helpers/style"
import { openSettings } from "../../components/settings/openSettings"
import { getSlideTextItems, stageItemToItem, updateStageShow } from "../../components/stage/stage"
import { getStyleResolution } from "../../components/slide/getStyleResolution"
import { getAccess } from "../../utils/profile"
import { ItemAddMenu } from "../edit/ItemAddMenu"
import { T } from "../helpers/T"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Zoomed } from "../slide/Zoomed"
import { observeResize } from "../slide/observeResize"
import { Center } from "../system/Center"
import { DropArea } from "../system/DropArea"
import { Snaplines, type Snapline, type SnaplinesMouse } from "../system/Snaplines"
import { Button } from "../ui/button/Button"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { ZoomControl } from "../ui/zoom-control/ZoomControl"
import { Stagebox } from "./Stagebox"
import styles from "./StageLayout.module.css"

export interface StageLayoutProps {
    outputId?: string
    stageId?: string
    preview?: boolean
    edit?: boolean
    disableStagePreview?: boolean
}

type NewStyles = { [key: string]: string | number }

// Port de components/stage/StageLayout.svelte (F24.19a).
export function StageLayout({ outputId = "", stageId = "", preview = false, edit = true, disableStagePreview = false }: StageLayoutProps) {
    const currentActiveStage = useStore(activeStage)
    const currentAllOutputs = useStore(allOutputs)
    const currentOutputs = useStore(outputs)
    const currentStageShows = useStore(stageShows)

    const [lines, setLines] = useState<Snapline[]>([])
    const [mouse, setMouse] = useState<SnaplinesMouse | null>(null)
    const [newStyles, setNewStyles] = useState<NewStyles>({})
    const [ratio, setRatio] = useState(1)
    const [zoom, setZoom] = useState(1)
    const [size, setSize] = useState({ width: 0, height: 0 })
    const [conditionsUpdater, setConditionsUpdater] = useState(0)

    const scrollRef = useRef<HTMLDivElement | null>(null)
    const mountedRef = useRef(false)
    const getLayoutMounted = useRef<() => boolean>(() => mountedRef.current).current
    const zoomOriginRef = useRef<{ x: number; y: number } | null>(null)
    const lastActiveIds = useRef("")
    const updateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    const profile = getAccess("stage")
    const active = currentActiveStage.items
    const stageLayoutId = stageId || currentActiveStage.id
    const readOnly = profile.global === "read" || profile[stageLayoutId || ""] === "read" || profile[stageLayoutId || ""] === "none"
    const layout = currentStageShows[stageLayoutId || ""] || ({} as never)

    const stageOutputId = getStageOutputId(currentOutputs)
    const resolution = getStageResolution(stageOutputId, currentOutputs)
    const currentOutput = currentOutputs[outputId] || currentAllOutputs[outputId] || {}
    const backgroundColor = currentOutput.transparent ? "transparent" : layout.settings?.color || "#000000"
    const stageItems = getSortedStageItems(stageLayoutId, currentStageShows)
    const hasStageOutput = edit && Object.values(currentOutputs).some((a) => a.stageOutput && (a.enabled || a.stageOutput === stageLayoutId))
    const isLocked = readOnly
    const zoomStyle = getStyleResolution(resolution, size.width, size.height, "fit", { zoom })

    const stageItemsRef = useRef(stageItems)
    stageItemsRef.current = stageItems
    const layoutRef = useRef(layout)
    layoutRef.current = layout
    const outputsRef = useRef(currentOutputs)
    outputsRef.current = currentOutputs
    const allOutputsRef = useRef(currentAllOutputs)
    allOutputsRef.current = currentAllOutputs

    function setStyles() {
        const showId = currentActiveStage.id
        if (!showId || !currentStageShows[showId]?.items) return
        const items = currentStageShows[showId].items
        const newData: { [key: string]: string } = {}

        active.forEach((id) => {
            const item = items[String(id)]
            if (!item) return
            const stylesObj = getStyles(item.style)
            const itemNewStyles = (newStyles as { __multiPositions?: { [key: string]: NewStyles } }).__multiPositions?.[String(id)] || newStyles

            Object.entries(itemNewStyles).forEach(([key, value]) => (stylesObj[key] = String(value)))

            let textStyles = ""
            Object.entries(stylesObj).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))
            newData[String(id)] = textStyles
        })

        history({
            id: "UPDATE",
            newData: { data: newData, key: "items", subkey: "style", keys: active },
            oldData: { id: showId },
            location: { page: "stage", id: "stage_item_position", override: showId + active.join("") }
        })

        if (!updateTimeout.current) {
            updateStageShow()
            updateTimeout.current = setTimeout(() => {
                updateStageShow()
                updateTimeout.current = null
            }, 500)
        }
    }

    useEffect(() => {
        if (!stageLayoutId) return
        mountedRef.current = false
        const timeout = setTimeout(() => {
            mountedRef.current = true
        }, 100)
        return () => clearTimeout(timeout)
    }, [stageLayoutId])

    useEffect(() => {
        const joined = active.join(",")
        if (joined !== lastActiveIds.current) {
            lastActiveIds.current = joined
            setNewStyles({})
        }
    }, [active])

    useEffect(() => {
        if (!active.length) {
            if (Object.keys(newStyles).length) setNewStyles({})
            return
        }
        if (Object.keys(newStyles).length) setStyles()
    }, [active, newStyles])

    useEffect(() => {
        const node = scrollRef.current
        if (!node) return
        const observation = observeResize(node, (rect) => setSize({ width: rect.width, height: rect.height }))
        return () => observation.destroy()
    }, [])

    useEffect(() => {
        const interval = setInterval(() => {
            if (stageItemsRef.current.some((item) => item?.conditions)) setConditionsUpdater((value) => value + 1)
        }, 500)
        return () => clearInterval(interval)
    }, [])

    useEffect(
        () => () => {
            if (updateTimeout.current) clearTimeout(updateTimeout.current)
        },
        []
    )

    function updateZoom(value: number) {
        setZoom(value)
        const origin = zoomOriginRef.current
        zoomOriginRef.current = null
        void centerZoom(origin, scrollRef.current ?? undefined, "")
    }

    // `_updater` se pasa para forzar la reevaluación de condiciones ( igual que en el Svelte original).
    function checkVisibility(index: number, _updater?: number) {
        const item = stageItems[index]
        if (!item) return false
        return shouldItemBeShown(stageItemToItem(item), item.type === "slide_text" ? getSlideTextItems(layoutRef.current, item, outputsRef.current || allOutputsRef.current) : [], { type: "stage" })
    }

    function createStageOutput() {
        toggleOutputEnabled.set(true)
        setTimeout(() => {
            const id = enableStageOutput({ stageOutput: stageLayoutId, name: layout?.name || "" })
            currentOutputSettings.set(id)
            openSettings("display_settings")
        }, 100)
    }

    function renderItems() {
        return <>{stageItems.map((item, index) => ((item.type || item.enabled !== false) && (edit || checkVisibility(index, conditionsUpdater)) ? <Stagebox key={`${stageLayoutId}-${item.id}`} edit={edit} stageLayout={edit ? null : layout} id={item.id} item={item as StageItem} ratio={ratio} preview={preview} disableStagePreview={disableStagePreview} getLayoutMounted={getLayoutMounted} onMouseChange={(value) => setMouse(value as unknown as SnaplinesMouse)} /> : null))}</>
    }

    function renderZoomed() {
        return (
            <Zoomed background={backgroundColor} style={zoomStyle} resolution={resolution} id={stageOutputId} onRatioChange={setRatio} isStage disableStyle hideOverflow={!edit} center>
                {edit && !readOnly ? <Snaplines lines={lines} mouse={mouse} newStyles={newStyles} ratio={ratio} active={active} isStage onLinesChange={setLines} onMouseChange={setMouse} onNewStylesChange={setNewStyles} /> : null}
                {renderItems()}
            </Zoomed>
        )
    }

    return (
        <div className={`stageArea ${styles.stageArea}`}>
            <div ref={scrollRef} className={`parent ${styles.parent} ${zoom >= 1 ? `noOverflow ${styles.noOverflow}` : ""}`}>
                {stageLayoutId ? (
                    edit && !readOnly ? (
                        <DropArea id="edit" file>
                            {renderZoomed()}
                        </DropArea>
                    ) : (
                        renderZoomed()
                    )
                ) : edit ? (
                    <Center size={2} faded>
                        <T id="empty.layout" />
                    </Center>
                ) : null}
            </div>

            {edit && stageLayoutId ? (
                <>
                    <FloatingBar side="left" onlyOne>
                        {!hasStageOutput ? (
                            <Button title="stage.create_stage_output" onClick={createStageOutput}>
                                <Icon id="autofill" />
                                <T id="stage.create_stage_output" />
                            </Button>
                        ) : null}

                        <ZoomControl hidden={!hasStageOutput} columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} onChange={updateZoom} onOrigin={(origin) => (zoomOriginRef.current = origin)} />
                    </FloatingBar>

                    <ItemAddMenu isLocked={isLocked} />
                </>
            ) : null}
        </div>
    )
}

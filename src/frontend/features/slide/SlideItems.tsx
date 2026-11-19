import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { Item } from "../../../types/Show"
import { slidesOptions } from "../../shared/core/stores"
import { MetronomeVisualizer } from "../../react/drawer/audio/MetronomeVisualizer"
import { BMDStream } from "../../react/drawer/live/BMDStream"
import { Cam } from "../../react/drawer/live/Cam"
import { NDIStream } from "../../react/drawer/live/NDIStream"
import { OMTStream } from "../../react/drawer/live/OMTStream"
import autosize from "../../components/edit/scripts/autosize"
import { getCropState } from "../../shared/utils/helpers/cropping"
import { getStyles } from "../../shared/utils/helpers/style"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Window as WindowView } from "../../react/output/Window"
import { Clock } from "../../shared/ui/system/Clock"
import { Captions } from "./views/Captions"
import { Chart } from "./views/Chart"
import { DynamicEvents } from "./views/DynamicEvents"
import { IconItem } from "./views/IconItem"
import { MediaItem } from "./views/MediaItem"
import { QrCode } from "./views/QrCode"
import { SlideProgress } from "./views/SlideProgress"
import { Table } from "./views/Table"
import { Timer } from "./views/Timer"
import { Variable } from "./views/Variable"
import { Visualizer } from "./views/Visualizer"
import { Weather } from "./views/Weather"
import { Website } from "./views/Website"

export interface SlideItemsProps {
    item: Item
    edit?: boolean
    itemElem?: HTMLElement
    slideIndex?: number
    preview?: boolean
    miniPreview?: boolean
    isStage?: boolean
    cropPreviewMode?: boolean
    isTemplatePreview?: boolean
    smallFontSize?: boolean
    fontSize?: number
    outputId?: string
    ratio?: number
    index?: number
    ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        layoutId?: string
        id: string
    }
}

// Port de components/slide/SlideItems.svelte (F24.18b).
export function SlideItems({ item, edit = false, itemElem, slideIndex = 0, preview = false, miniPreview = false, isStage = false, cropPreviewMode = false, isTemplatePreview = false, smallFontSize = false, fontSize = 0, outputId = "", ratio = 1, index = -1, ref }: SlideItemsProps) {
    const currentSlidesOptions = useStore(slidesOptions)
    const [today, setToday] = useState(() => new globalThis.Date())
    const [autoSize, setAutoSize] = useState(0)
    const previousItem = useRef("{}")
    const newItem = JSON.stringify(item)

    useEffect(() => {
        if (item.type !== "timer") return
        const interval = setInterval(() => setToday(new globalThis.Date()), 500)
        return () => clearInterval(interval)
    }, [item.type])

    const noAutoSize = item.auto === false && item.textFit === "none"

    useEffect(() => {
        if (!edit || !itemElem || noAutoSize || newItem === previousItem.current) return
        previousItem.current = newItem
        const timeout = setTimeout(() => {
            if (!itemElem) return
            const textQuery = item.type === "slide_tracker" ? ".progress div" : ""
            setAutoSize(autosize(itemElem, { type: "growToFit", textQuery }))
        }, 50)
        return () => clearTimeout(timeout)
    }, [edit, itemElem, noAutoSize, newItem, item.type])

    const cameraCropState = getCropState(item.cropping, cropPreviewMode, item.style)
    const cameraStyleString = `${cameraCropState.mediaCropGeometry}object-fit: ${cameraCropState.cropHasValues ? (item.fit === "cover" ? "cover" : "fill") : item.fit || "contain"};filter: ${item.filter};transform: scale(${item.flipped ? "-1" : "1"}, ${item.flippedY ? "-1" : "1"});`
    const variableStyleString = typeof item.style === "string" ? (item.style.includes("font-size") && item.style.split("font-size:")[1].trim()[0] !== "0" ? "" : `font-size: ${edit ? autoSize : fontSize}px;`) : ""

    function cameraContainer(screenType: "screen" | "ndi" | "omt") {
        const screen = { id: item.device?.id || "", name: item.device?.name || "" }
        return (
            <div className="mediaContainer" style={cssTextToStyle(cameraCropState.mediaContainerStyle)}>
                {screenType === "screen" ? <WindowView key={item.device?.id} id={screen.id} style={cameraStyleString} /> : screenType === "ndi" ? <NDIStream key={item.device?.id} screen={screen} background outputId={outputId} style={cameraStyleString} /> : <OMTStream key={item.device?.id} screen={screen} background outputId={outputId} style={cameraStyleString} />}
            </div>
        )
    }

    function blackmagicContainer() {
        const screen = { id: item.device?.id || "", name: item.device?.name || "" }
        return (
            <div className="mediaContainer" style={cssTextToStyle(cameraCropState.mediaContainerStyle)}>
                <BMDStream key={item.device?.id} screen={screen} background outputId={outputId} style={cameraStyleString} />
            </div>
        )
    }

    if (item.type === "media") {
        return <MediaItem item={item} outputId={outputId} slideRef={{ ...ref, slideIndex }} preview={preview || isStage} miniPreview={miniPreview} edit={edit} cropPreviewMode={cropPreviewMode} />
    }
    if (item.type === "web") {
        return <Website src={item.web?.src || ""} zoom={item.web?.zoom} outputId={outputId} disablePreview={isTemplatePreview || (ref?.type === "overlay" && !outputId && miniPreview)} />
    }
    if (item.type === "timer") {
        return <Timer item={item} id={item.timer?.id || item.timerId || ""} today={today} style={noAutoSize ? "" : `font-size: ${edit ? autoSize : fontSize}px;`} edit={edit} />
    }
    if (item.type === "clock") {
        const clockProps = (item.clock || {}) as CSSProperties & Record<string, unknown>
        return <Clock item={item as unknown as { align?: string; alignX?: boolean; [key: string]: unknown }} fontStyle={noAutoSize ? "" : `font-size: ${edit ? autoSize : fontSize}px;`} style={false} {...clockProps} />
    }
    if (item.type === "camera" && item.device) {
        if (item.device.type === "screen") return cameraContainer("screen")
        if (item.device.type === "ndi") return cameraContainer("ndi")
        if (item.device.type === "omt") return cameraContainer("omt")
        if (item.device.type === "blackmagic") return blackmagicContainer()
        return <Cam cam={{ id: item.device.id, group: item.device.group || "", name: item.device.name }} item style={cameraStyleString} disablePreview={isTemplatePreview} cropping={item.cropping} cropPreviewMode={cropPreviewMode} preview={!outputId && (preview || isTemplatePreview)} itemStyle={item.style} />
    }
    if (item.type === "slide_tracker") {
        return <SlideProgress item={item} tracker={item.tracker || {}} autoSize={item.auto === false ? 0 : edit ? autoSize : fontSize} outputId={outputId} />
    }
    if (item.type === "events") {
        const textSize = smallFontSize ? (-1.1 * currentSlidesOptions.columns + 10) * 5 : Number(getStyles(item.style, true)?.["font-size"]) || 80
        return <DynamicEvents {...item.events} textSize={textSize} />
    }
    if (item.type === "weather") return <Weather data={item.weather || {}} />
    if (item.type === "visualizer") return <Visualizer item={item} preview={preview} edit={edit} />
    if (item.type === "captions") return <Captions item={item} />
    if (item.type === "icon") return <IconItem item={item} ratio={ratio} />
    if (item.type === "metronome") return <MetronomeVisualizer isItem />
    if (item.type === "variable") {
        return <Variable item={item} style={variableStyleString} ref={{ ...ref, slideIndex }} hideText={edit ? false : preview} edit={edit} />
    }
    if (item.type === "chart") return <Chart item={item} ref={{ ...ref, slideIndex }} />
    if (item.type === "table") return <Table item={item} edit={edit} ref={ref} ratio={ratio} index={index} />
    if (item.type === "qr_code") return <QrCode item={item} edit={edit} />
    return null
}

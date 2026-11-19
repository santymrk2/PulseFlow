import { useEffect, useState } from "react"
import type { TabsObj } from "../../../types/Tabs"
import type { EditInput } from "./logic/values/boxes"
import { EditValues } from "./tools/EditValues"
import { filterSections, mediaBoxes } from "./logic/values/media"
import { setBoxInputValue } from "./logic/values/boxes"
import { addFilterString } from "./logic/scripts/textStyle"
import { clone } from "../../shared/utils/helpers/array"
import { getExtension, getMediaType } from "../../shared/utils/helpers/media"
import { getFirstActiveOutput, setOutput } from "../../shared/utils/helpers/output"
import { removeStore, updateStore } from "../../shared/utils/helpers/update"
import { VideoPlayer } from "../media/logic/video/videoPlayer"
import { activeEdit, activeShow, media } from "../../shared/core/stores"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Tabs } from "../../app/main/Tabs"
import { Button } from "../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import styles from "./MediaTools.module.css"

const tabs: TabsObj = {
    media: { name: "items.media", icon: "image" },
    filters: { name: "edit.filters", icon: "filter" }
}

// Port de components/edit/MediaTools.svelte.
export function MediaTools() {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentMedia = useStore(media)

    const [active, setActive] = useState(Object.keys(tabs)[0])
    const [mediaSections, setMediaSections] = useState<Record<string, unknown>>({})

    const mediaId = currentActiveEdit.id || currentActiveShow?.id || ""
    const currentItem = mediaId ? currentMedia[mediaId] || {} : {}
    const mediaType = currentActiveEdit.type === "camera" ? "camera" : getMediaType(getExtension(mediaId))

    useEffect(() => {
        const base = clone((mediaBoxes as Record<string, { sections?: Record<string, unknown> }>)[mediaType]?.sections || {})
        setMediaSections(base)

        if (mediaType !== "video" || !mediaId) return

        let cancelled = false
        void VideoPlayer.getDuration(mediaId).then((videoDuration) => {
            if (cancelled || !videoDuration) return

            const next = clone(base) as Record<string, unknown>
            const maxSoftLoop = Math.floor(videoDuration / 2)
            const section = next as Parameters<typeof setBoxInputValue>[0]
            setBoxInputValue(section, "video", "toTime", "value", (currentItem.toTime as number) || videoDuration)
            setBoxInputValue(section, "video", "toTime", "default", videoDuration)
            setBoxInputValue(section, "video", "fromTime", "values", { max: videoDuration })
            setBoxInputValue(section, "video", "toTime", "values", { max: videoDuration })
            setBoxInputValue(section, "video", "softLoop", "values", { max: Math.min(50, maxSoftLoop), sliderValues: { max: Math.min(10, maxSoftLoop), step: 0.5 } })
            setMediaSections(next)
        })

        return () => {
            cancelled = true
        }
    }, [mediaId, mediaType])

    function reset() {
        if (!mediaId) return
        let deleteKeys = ["flipped", "flippedY", "blend", "fit", "speed", "volume", "fromTime", "toTime", "videoType", "cropping"]

        if (active === "filters") deleteKeys = ["filter"]
        else if (active !== "media") return
        deleteKeys.forEach((key) => removeStore("media", { keys: [mediaId, key] }))

        const currentOutput = getFirstActiveOutput() as { out?: { background?: Record<string, unknown> } } | null | undefined
        const bg = currentOutput?.out?.background
        if (bg) {
            const bgId = String(bg.path || bg.id || "")
            if (bgId === mediaId) {
                deleteKeys.forEach((key) => delete bg[key])
                setOutput("background", bg)
            }
        }

        setMediaSections(clone((mediaBoxes as Record<string, { sections?: Record<string, unknown> }>)[mediaType]?.sections || {}))
    }

    function valueChanged(input: unknown) {
        if (!mediaId || !input || typeof input !== "object") return

        const data = input as { id?: string; key?: string; value?: unknown }
        if (!data.id) return
        let value = data.value
        if (value && typeof value === "object" && "id" in value) value = (value as { id?: unknown }).id
        if (data.id === "filter") value = addFilterString((currentItem.filter as string) || "", [data.key, value])

        updateStore("media", { keys: [mediaId, ...String(data.id).split(".")], value })
        VideoPlayer.updateProperties(mediaId)

        const currentOutput = getFirstActiveOutput() as { out?: { background?: Record<string, unknown> } } | null | undefined
        const bg = currentOutput?.out?.background
        if (!bg) return
        const bgId = String(bg.path || bg.id || "")
        if (bgId !== mediaId) return

        const parts = String(data.id).split(".")
        if (parts.length > 1) {
            const first = parts[0]
            const nested = bg[first]
            if (typeof nested !== "object" || nested === null) bg[first] = {}
            ;(bg[first] as Record<string, unknown>)[parts[1]] = value
        } else {
            bg[data.id] = value
        }
        setOutput("background", bg)
    }

    function onEditValuesChange(input: EditInput & { input?: string }) {
        if (!input) return
        input.value = input.values.value
        input.input = input.type
        valueChanged(input)
    }

    return (
        <div className={`main border editTools ${styles.main}`}>
            <Tabs tabs={tabs} active={active} onActiveChange={setActive} />

            <div className={styles.content}>
                {active === "media" ? <EditValues sections={mediaSections as never} item={currentItem as never} onChange={onEditValuesChange} /> : null}
                {active === "filters" ? <EditValues sections={clone(filterSections) as never} item={currentItem as never} onChange={onEditValuesChange} /> : null}
            </div>

            <FloatingBar>
                <Button icon="reset" title="actions.reset" onClick={reset} />
            </FloatingBar>
        </div>
    )
}

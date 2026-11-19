import { useEffect, useState } from "react"
import { AudioPlayer } from "../../audio/audioPlayer"
import { EditValues } from "./tools/EditValues"
import { audioSections } from "../../components/edit/values/media"
import { setBoxInputValue } from "../../components/edit/values/boxes"
import { clone } from "../../shared/utils/helpers/array"
import { removeStore, updateStore } from "../../shared/utils/helpers/update"
import { activeEdit, activeShow, media } from "../../shared/core/stores"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import styles from "./AudioTools.module.css"

// Port de components/edit/AudioTools.svelte.
export function AudioTools() {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentMedia = useStore(media)

    const audioId = currentActiveEdit.id || currentActiveShow?.id || ""
    const mediaItem = audioId ? currentMedia[audioId] || {} : {}
    const [sections, setSections] = useState(() => clone(audioSections))

    async function getAudioDuration(fromTime?: number, toTime?: number) {
        if (!audioId) return
        const duration = await AudioPlayer.getDuration(audioId)
        const from = fromTime ?? 0
        const to = toTime ?? duration

        const next = clone(audioSections)
        setBoxInputValue(next, "default", "toTime", "value", to)
        setBoxInputValue(next, "default", "toTime", "default", duration)
        setBoxInputValue(next, "default", "fromTime", "values", { min: 0, max: to })
        setBoxInputValue(next, "default", "toTime", "values", { min: from, max: duration })
        setSections(next)
    }

    useEffect(() => {
        setSections(clone(audioSections))
        if (!audioId) return
        void getAudioDuration(mediaItem.fromTime as number | undefined, mediaItem.toTime as number | undefined)
    }, [audioId])

    function reset() {
        if (!audioId) return
        const deleteKeys = ["audioType", "volume", "pitch", "tempo", "fromTime", "toTime"]

        if (mediaItem.volume) setTimeout(() => AudioPlayer.updateVolume(audioId))
        if (mediaItem.pitch) setTimeout(() => AudioPlayer.setPitch(audioId, 0))
        if (mediaItem.tempo) setTimeout(() => AudioPlayer.setTempo(audioId, 1))

        deleteKeys.forEach((key) => removeStore("media", { keys: [audioId, key] }))

        setSections(clone(audioSections))
        void getAudioDuration()
    }

    function valueChanged(detail: unknown) {
        if (!audioId || !detail || typeof detail !== "object") return

        const input = detail as { id?: string; type?: string; value?: unknown; values?: { value?: unknown } }
        const key = input.id
        if (!key) return
        let value = input.values?.value ?? input.value
        if (value && typeof value === "object" && "id" in value) value = (value as { id?: unknown }).id

        if (key === "volume") {
            setTimeout(() => AudioPlayer.updateVolume(audioId))
        }
        if (key === "pitch") {
            const n = typeof value === "number" ? value : Number(value)
            setTimeout(() => AudioPlayer.setPitch(audioId, Number.isFinite(n) ? n : 0))
        }
        if (key === "tempo") {
            const n = typeof value === "number" ? value : Number(value)
            setTimeout(() => AudioPlayer.setTempo(audioId, Number.isFinite(n) ? n : 1))
        }

        updateStore("media", { keys: [audioId, key], value })
    }

    return (
        <div className={`main border editTools ${styles.main}`}>
            <div className={styles.content}>
                <EditValues sections={sections as never} item={mediaItem as never} onChange={(input) => valueChanged(input)} />
            </div>

            <FloatingBar>
                <Button icon="reset" title="actions.reset" onClick={reset} />
            </FloatingBar>
        </div>
    )
}

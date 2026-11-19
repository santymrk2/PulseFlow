import { useEffect, useState } from "react"
import { uid } from "uid"
import type { Option } from "../../../types/Main"
import type { AudioStream as AudioStreamData } from "../../../types/Audio"
import { clone, sortByName } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { audioStreams, popupData, selected } from "../../shared/core/stores"
import { get } from "../../shared/core/lib/store"
import { T } from "../../shared/ui/helpers/T"
import { Center } from "../../shared/ui/system/Center"
import { Dropdown } from "../../shared/ui/kit/dropdown/Dropdown"
import { TextField } from "../../shared/ui/kit/text-field/TextField"

// Port de components/main/popups/AudioStream.svelte. Lee (al montar): popupData { dropdown, index }, selected (id "audio_stream" → data[0].id) y audioStreams.
// Escribe: popupData = {} al montar; audioStreams[streamId] al cambiar nombre/valor; history SHOW_LAYOUT (acción audioStream del slide) al elegir en el dropdown.
const DEFAULT_STREAM: AudioStreamData = { name: "", value: "" }

export function AudioStream() {
    const [dropdown] = useState<boolean | undefined>(() => get(popupData)?.dropdown)
    const [slideIndex] = useState<number>(() => get(popupData)?.index)
    const [initial] = useState(() => {
        const current = get(selected)
        const existing = current.id === "audio_stream" && current.data[0]?.id
        const id: string = existing ? current.data[0].id : uid()
        const list = Object.entries(get(audioStreams)).map(([streamId, stream]) => ({ ...stream, id: streamId }))
        return { id, stream: clone(get(audioStreams)[id] || DEFAULT_STREAM), sorted: sortByName(list) }
    })
    const [streamId, setStreamId] = useState(initial.id)
    const [currentStream, setCurrentStream] = useState<AudioStreamData>(initial.stream)

    useEffect(() => {
        popupData.set({})
    }, [])

    function updateValue(value: string | null, key: keyof AudioStreamData) {
        if (!value) return

        const next = { ...currentStream, [key]: value }
        setCurrentStream(next)

        audioStreams.update((a) => {
            a[streamId] = next
            return a
        })
    }

    function changeStream(option: Option) {
        const id = option.id || ""
        setStreamId(id)

        const ref = getLayoutRef()[slideIndex]
        const data = clone(ref?.data?.actions || {})

        data.audioStream = id

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data, indexes: [slideIndex] }, location: { page: "show", override: "audio_stream" } })
    }

    if (dropdown) {
        return initial.sorted.length ? (
            <Dropdown options={initial.sorted} value={initial.sorted.find((a) => a.id === streamId)?.name || "—"} onClick={changeStream} />
        ) : (
            <Center faded>
                <T id="empty.general" />
            </Center>
        )
    }

    return (
        <>
            <TextField label="inputs.name" value={currentStream.name} onChange={(value) => updateValue(value, "name")} autofocus={!currentStream.name} />
            <TextField label="variables.value" value={currentStream.value} placeholder="http://stream-url" onChange={(value) => updateValue(value, "value")} />
        </>
    )
}

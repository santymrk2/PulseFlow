import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import type { API_midi } from "../actions/logic/api"
import { midiInListen } from "../actions/logic/midi"
import { clone } from "../../shared/utils/helpers/array"
import { MidiValues } from "../actions/MidiValues"
import { Tip } from "../../react/main/Tip"
import { actions, activeShow, popupData } from "../../shared/core/stores"

// Port de components/main/popups/SlideMidi.svelte. Lee: popupData (id, index, indexes), actions y activeShow.
// Escribe: popupData.id al montar si faltaba, actions[id] en cada cambio de MIDI y llama a midiInListen().
// MidiValues y Tip usan ports React (F24.24).
interface SlideAction {
    name: string
    triggers?: string[]
    midi?: API_midi
    shows?: { id: string }[]
    [key: string]: unknown
}

const actionMidi: API_midi = { type: "noteon", values: { note: 0, velocity: -1, channel: 1 }, defaultValues: true }

function detailOf(e: unknown): unknown {
    if (e && typeof e === "object" && "detail" in e) return (e as { detail: unknown }).detail
    return e
}

export function SlideMidi() {
    const [action, setAction] = useState<SlideAction>({ name: "", triggers: [] })
    const actionRef = useRef<SlideAction>(action)
    const idRef = useRef((get(popupData).id || "") as string)
    const loaded = useRef(false)

    function commit(next: SlideAction) {
        actionRef.current = next
        setAction(next)
    }

    function saveAction() {
        if (!loaded.current) return
        const current = actionRef.current
        const id = idRef.current

        actions.update((a) => {
            const shows = a[id]?.shows || []
            const data = get(popupData)
            const showId = data.index === undefined && !data.indexes?.length ? "" : get(activeShow)?.id || ""
            if (showId && !shows.find((item) => item.id === showId)) shows.push({ id: showId })
            current.shows = shows

            if (current.midi?.defaultValues) delete current.midi.defaultValues

            a[id] = clone(current) as never
            return a
        })

        midiInListen()
    }

    function updateValue(key: string, e: unknown) {
        const value = detailOf(e)
        commit({ ...actionRef.current, [key]: value })
        saveAction()
    }

    // Los handlers del port leen siempre la versión más reciente.
    const live = useRef(updateValue)
    useEffect(() => {
        live.current = updateValue
    })

    useEffect(() => {
        const data = get(popupData)
        const currentId = (data.id || "") as string
        if (!currentId) {
            const newId = uid()
            idRef.current = newId
            popupData.set({ ...data, id: newId })
        } else {
            const found = get(actions)[currentId]
            if (found) commit(clone(found) as never)
        }
        loaded.current = true
    }, [])

    return (
        <>
            <Tip type="info" value="actions.play_on_midi_tip" bottom={20} />
            <MidiValues value={clone(action.midi || actionMidi)} firstActionId={action.triggers?.[0]} playSlide onChange={(value) => live.current("midi", value)} />
        </>
    )
}

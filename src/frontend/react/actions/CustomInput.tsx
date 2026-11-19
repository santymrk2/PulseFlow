// @ts-nocheck
import { useEffect, useState } from "react"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../shared/core/ipc/main"
import { AudioMicrophone } from "../../audio/audioMicrophone"
import { dbToGain, gainToDb, MIN_DB } from "../../audio/dBUtils"
import { AudioRoutingManager } from "../../audio/routing/audioRoutingManager"
import { cameraManager } from "../../media/cameraManager"
import { actions, activePopup, audioPlaylists, audioRouting, audioStreams, effects, effectsLibrary, groups, interactions, looks, outputs, overlays, popupData, projects, scenes, shows, stageShows, styles, templates, timers, variables } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { obsGetScenes } from "../../utils/obsTalk"
import { keysToID, sortByName } from "../../shared/utils/helpers/array"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { NumberField } from "../ui/number-field/NumberField"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"
import { getGlobalGroupName } from "../../components/show/tools/groups"
import { useStore } from "../hooks/useStore"
import { ChooseEmitter } from "./ChooseEmitter"
import { ChooseStyle } from "./specific/ChooseStyle"
import { MidiValues } from "./MidiValues"
import { RestValues } from "./RestValues"
import { VariableInputs } from "./specific/VariableInputs"

export interface CustomInputProps {
    inputId: string
    value: unknown
    actionId: string
    actionIndex?: number
    mainId?: string
    list?: boolean
    onChange?: (value: unknown) => void
}

const stateOptions = [
    { value: "", label: "Toggle" },
    { value: "off", label: "Off" },
    { value: "on", label: "On" }
]

export function CustomInput({ inputId, value, actionId, actionIndex = 0, mainId = "", list = false, onChange }: CustomInputProps) {
    const outputsStore = useStore(outputs) as unknown as never
    const projectsStore = useStore(projects) as unknown as never
    const groupsStore = useStore(groups) as unknown as never
    const overlaysStore = useStore(overlays) as unknown as never
    const effectsStore = useStore(effects) as unknown as never
    const scenesStore = useStore(scenes) as unknown as never
    const stageShowsStore = useStore(stageShows) as unknown as never
    const audioStreamsStore = useStore(audioStreams) as unknown as never
    const audioRoutingStore = useStore(audioRouting) as unknown as never
    const audioPlaylistsStore = useStore(audioPlaylists) as unknown as never
    const effectsLibraryStore = useStore(effectsLibrary) as unknown as never[]
    const stylesStore = useStore(styles) as unknown as never
    const looksStore = useStore(looks) as unknown as never
    const timersStore = useStore(timers) as unknown as never
    const variablesStore = useStore(variables) as unknown as never
    const actionsStore = useStore(actions) as unknown as never
    const templatesStore = useStore(templates) as unknown as never
    const interactionsStore = useStore(interactions) as unknown as never
    const showsStore = useStore(shows) as unknown as never
    const popupDataStore = useStore(popupData) as unknown as never

    const [cameras, setCameras] = useState<Array<{ label: string; id: string; groupId: string }>>([])
    const [microphones, setMicrophones] = useState<Array<{ name: string; id: string }>>([])
    const [screens, setScreens] = useState<Array<{ name: string; id: string }>>([])
    const [obsScenes, setObsScenes] = useState<string[]>([])

    function updateValue(key: string, e: unknown) {
        const newValue = e?.detail ?? e?.target?.value ?? e
        let next = value
        if (key) next = { ...(value || {}), [key]: newValue }
        else next = newValue
        onChange?.(next)
    }

    useEffect(() => {
        if (inputId === "metronome" && !value) updateValue("", { tempo: 120, beats: 4 })
        else if ((inputId === "index" || inputId === "disable_slide") && value?.index === undefined) updateValue("index", 0)
        else if (inputId === "volume" && value?.volume === undefined) updateValue("volume", 1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputId])

    useEffect(() => {
        if (inputId !== "camera") return
        cameraManager.getCamerasList().then((cameraList) => {
            setCameras(sortByName(cameraList).map((a: unknown) => ({ label: a.name, id: a.id, groupId: a.group })))
        })
    }, [inputId])

    useEffect(() => {
        if (inputId !== "microphone") return
        AudioMicrophone.getList().then((micList) => {
            setMicrophones(sortByName((micList || []).map((a: unknown) => ({ name: a.label || a.deviceId, id: a.deviceId }))))
        })
    }, [inputId])

    useEffect(() => {
        if (inputId !== "screen") return
        Promise.all([requestMain(Main.GET_SCREENS), requestMain(Main.GET_WINDOWS)]).then(([screenList, windowList]) => {
            setScreens([...(screenList || []), ...(windowList || [])] as unknown as never)
        })
    }, [inputId])

    useEffect(() => {
        if (inputId !== "obs_scene") return
        obsGetScenes().then((s) => setObsScenes(s as string[]))
    }, [inputId])

    function convertToOptions(a: unknown) {
        return sortByName(Object.keys(a || {}).map((id) => ({ value: id, label: a[id]?.name })), "label")
    }

    function getOutputsWithKey(key: string) {
        return sortByName(keysToID(outputsStore))
            .filter((a: unknown) => a[key])
            .map((a: unknown) => ({ value: a.id, label: a.name }), "label")
    }

    const getOptions: Record<string, () => any[]> = {
        id_select_project: () => convertToOptions(projectsStore),
        id_select_group: () => sortByName(Object.keys(groupsStore || {}).map((id) => ({ value: id, label: getGlobalGroupName(id) })), "label"),
        clear_overlay: () => [...convertToOptions(overlaysStore), ...convertToOptions(effectsStore)],
        id_start_effect: () => convertToOptions(effectsStore),
        start_scene: () => convertToOptions(scenesStore),
        id_select_overlay: () => convertToOptions(overlaysStore),
        id_select_stage_layout: () => convertToOptions(stageShowsStore),
        normal_outputs: () => [{ value: "", label: translateText("actions.all_outputs") }, ...sortByName(keysToID(outputsStore).filter((a: unknown) => !a.stageOutput)).map((a: unknown) => ({ value: a.id, label: a.name }), "label")],
        output_lock: () => [{ value: "", label: translateText("preview.lock") }, { value: "all", label: translateText("actions.all_outputs") }, ...getOptions.normal_outputs().slice(1)],
        stage_outputs: () => [{ value: "", label: translateText("actions.all_outputs") }, ...sortByName(keysToID(outputsStore).filter((a: unknown) => a.stageOutput)).map((a: unknown) => ({ value: a.id, label: a.name }), "label")],
        start_audio_stream: () => convertToOptions(audioStreamsStore),
        audio_channels: () => {
            const config = AudioRoutingManager.sortChannels(audioRoutingStore || { channels: [{ id: "main", name: translateText("audio.main") }], connections: [] })
            return (config?.channels || [{ id: "main", name: translateText("audio.main") }]).map((c: unknown) => ({ value: c.id, label: c.name || c.id }))
        },
        start_playlist: () => convertToOptions(audioPlaylistsStore),
        start_audio_effect: () => (effectsLibraryStore || []).map((a: unknown) => ({ value: a.path, label: a.name })),
        id_select_output_style: () => [{ value: null as unknown as never, label: "—" }, ...convertToOptions(stylesStore)],
        change_output_style: () => convertToOptions(stylesStore),
        set_look: () => convertToOptions(looksStore),
        id_start_timer: () => convertToOptions(timersStore),
        variable: () => convertToOptions(variablesStore),
        run_action: () => convertToOptions(actionsStore).filter((a: unknown) => a.label && a.value !== mainId && actionsStore[a.value]?.actionValues?.run_action?.id !== mainId),
        set_template: () => convertToOptions(templatesStore),
        toggle_output: () => convertToOptions(outputsStore),
        mute_output: () => sortByName(keysToID(outputsStore).filter((a: unknown) => !a.stageOutput)).map((a: unknown) => ({ value: a.id, label: a.name }), "label"),
        unmute_output: () => sortByName(keysToID(outputsStore).filter((a: unknown) => !a.stageOutput)).map((a: unknown) => ({ value: a.id, label: a.name }), "label"),
        interactions: () => convertToOptions(interactionsStore),
        start_webrtc_stream: () => [{ value: "", label: translateText("actions.all_outputs") }, ...getOutputsWithKey("webrtc")],
        stop_webrtc_stream: () => [{ value: "", label: translateText("actions.all_outputs") }, ...getOutputsWithKey("webrtc")],
        start_rtmp_stream: () => [{ value: "", label: translateText("actions.all_outputs") }, ...getOutputsWithKey("rtmp")],
        stop_rtmp_stream: () => [{ value: "", label: translateText("actions.all_outputs") }, ...getOutputsWithKey("rtmp")],
        start_output_recording: () => convertToOptions(outputsStore)
    }

    const options = getOptions[actionId]?.() || []

    function textStateChange(v: string | null) {
        let val: unknown = v
        if (val === "off") val = false
        else if (val === "on") val = true
        else val = undefined
        updateValue("value", val)
    }

    function openSelectShow() {
        popupData.set({ ...popupDataStore, action: "select_show", revert: activePopup ? "action" : "action", active: value?.id, actionIndex })
        activePopup.set("select_show")
    }

    useEffect(() => {
        if (list && (actionId === "start_show" || actionId === "id_select_show") && !value?.id) openSelectShow()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list, actionId])

    if (inputId === "output_style" || value?.outputStyle || value?.styleOutputs) {
        return <ChooseStyle value={value || {}} onChange={(v) => updateValue("", v)} />
    }
    if (inputId === "change_output_style") {
        return (
            <>
                <SelectField label="stage.output" options={getOptions.normal_outputs()} value={value?.outputId || ""} onChange={(v) => updateValue("outputId", v)} />
                <SelectField label="edit.style" options={getOptions.change_output_style()} value={value?.styleId} onChange={(v) => updateValue("styleId", v)} allowEmpty />
            </>
        )
    }
    if (inputId === "set_look") {
        return <SelectField label="looks.looks" options={getOptions.set_look()} value={value?.lookId} onChange={(v) => updateValue("lookId", v)} allowEmpty />
    }
    if (inputId === "stage_output_layout") {
        return (
            <>
                <SelectField label="stage.output" options={getOptions.stage_outputs()} value={value?.outputId || ""} onChange={(v) => updateValue("outputId", v)} />
                <SelectField label="stage.stage_layout" options={getOptions.id_select_stage_layout()} value={value?.stageLayoutId} onChange={(v) => updateValue("stageLayoutId", v)} />
            </>
        )
    }
    if (inputId === "camera") {
        return <SelectField label="items.camera" options={cameras.map((a) => ({ value: a.id, label: a.label }))} value={value?.id} onChange={(v) => updateValue("", cameras.find((a) => a.id === v))} />
    }
    if (inputId === "microphone") {
        return <SelectField label="settings.device" options={microphones.map((a) => ({ value: a.id, label: a.name }))} value={value?.id} onChange={(v) => updateValue("", microphones.find((a) => a.id === v))} />
    }
    if (inputId === "screen") {
        return <SelectField label="items.screen" options={screens.map((a) => ({ value: a.id, label: a.name }))} value={value?.id} onChange={(v) => updateValue("", screens.find((a) => a.id === v))} />
    }
    if (inputId === "midi") {
        return <MidiValues value={value?.midi || {}} type="output" onChange={(v) => updateValue("midi", v)} />
    }
    if (inputId === "metronome") {
        // simplified: metronome inputs in Svelte were MetronomeInputs component; keep basic fields if needed
        return (
            <>
                <NumberField label="actions.tempo" value={value?.tempo || 120} onChange={(v) => updateValue("", { ...(value || {}), tempo: v })} />
                <NumberField label="actions.beats" value={value?.beats || 4} onChange={(v) => updateValue("", { ...(value || {}), beats: v })} />
            </>
        )
    }
    if (inputId === "variable") {
        return <VariableInputs value={value} onUpdate={(detail) => updateValue(detail?.key, detail?.value)} />
    }
    if (inputId === "toggle_action") {
        return (
            <>
                <SelectField label="popup.action" options={getOptions.run_action()} value={value?.id} onChange={(v) => updateValue("id", v)} />
                <SelectField label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} onChange={textStateChange} />
            </>
        )
    }
    if (inputId === "toggle_output") {
        return (
            <>
                <SelectField label="stage.output" options={getOptions.toggle_output()} value={value?.id} onChange={(v) => updateValue("id", v)} />
                <SelectField label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} onChange={textStateChange} />
            </>
        )
    }
    if (inputId === "toggle_channel_recording" || inputId === "mute") {
        return (
            <>
                <SelectField label="audio.channel" options={getOptions.audio_channels()} value={value?.id || "main"} onChange={(v) => updateValue("id", v)} />
                <SelectField label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} onChange={textStateChange} />
            </>
        )
    }
    if (inputId === "rest") {
        return <RestValues value={value || {}} onChange={(v) => updateValue("", v)} />
    }
    if (inputId === "emitter") {
        return <ChooseEmitter value={value || {}} onChange={(v) => updateValue("", v)} />
    }
    if (inputId === "start_show") {
        return (
            <Button variant="outline" style={{ width: "100%" }} onClick={openSelectShow}>
                {value?.id ? showsStore[value.id]?.name || "—" : <T id="popup.select_show" />}
            </Button>
        )
    }
    if (inputId === "audio_effects") {
        return <SelectField label="actions.start_audio_effect" options={getOptions.start_audio_effect()} value={value?.path} onChange={(v) => updateValue("path", v)} />
    }
    if (inputId === "number") {
        return <NumberField label="timer.seconds" value={value?.number || 0} step={0.5} onChange={(v) => updateValue("number", v)} />
    }
    if (inputId === "seconds") {
        return <NumberField label="timer.seconds" value={value?.seconds || 0} onChange={(v) => updateValue("seconds", v)} />
    }
    if (inputId === "index") {
        return <NumberField label="variables.value" value={value?.index || 0} onChange={(v) => updateValue("index", v)} />
    }
    if (inputId === "obs_scene") {
        return <SelectField label="Scene" options={obsScenes.map((s) => ({ value: s, label: s }))} value={value?.id} onChange={(v) => updateValue("id", v)} />
    }
    if (inputId === "strval") {
        return <TextField label="inputs.name" value={value?.value || ""} onChange={(v) => updateValue("value", v)} />
    }
    if (inputId === "numval") {
        return <NumberField label="variables.value" value={value?.value || 0} onChange={(v) => updateValue("value", v)} />
    }
    if (inputId === "percentage") {
        return <NumberField label="variables.value" value={(value?.value ?? 1) * 100} min={-1000} onChange={(v) => updateValue("value", (typeof v === "number" ? v : 0) / 100)} />
    }
    if (inputId === "toggle") {
        return <SelectField label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} onChange={textStateChange} />
    }
    if (inputId === "disable_slide") {
        return (
            <>
                <SelectField label="formats.show" options={[{ value: "", label: translateText("actions.active_show") }, ...convertToOptions(showsStore)]} value={value?.showId || ""} onChange={(v) => updateValue("showId", v)} />
                <NumberField label="edit.slide_index" value={value?.index ?? 0} onChange={(v) => updateValue("index", v)} />
                <SelectField label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} onChange={textStateChange} />
            </>
        )
    }
    if (inputId === "output_lock") {
        return (
            <>
                <SelectField label="stage.output" options={getOptions.output_lock()} value={value?.outputId || ""} onChange={(v) => updateValue("outputId", v)} />
                <SelectField label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} onChange={textStateChange} />
            </>
        )
    }
    if (inputId === "interactions") {
        return <SelectField label="tabs.interactions" options={getOptions.interactions()} value={value?.id} onChange={(v) => updateValue("id", v)} />
    }
    if (inputId === "id") {
        if (options.length || getOptions[actionId]) {
            return <SelectField label="variables.value" options={options} value={value?.id} onChange={(v) => updateValue("id", v)} />
        }
        return null
    }
    if (inputId === "volume") {
        const rawVolume = Number(value?.volume ?? 1)
        const volumeValue = rawVolume > 5 ? rawVolume / 100 : rawVolume
        const dbValue = Math.max(MIN_DB, Math.min(6, gainToDb(volumeValue)))
        return (
            <>
                <SelectField label="audio.channel" options={getOptions.audio_channels()} value={value?.channelId || "main"} onChange={(v) => updateValue("channelId", v)} />
                <NumberField label="media.volume (dB)" value={Number(dbValue.toFixed(1))} min={MIN_DB} max={6} step={0.5} defaultValue={0} onChange={(v) => updateValue("volume", dbToGain(Number(v)))} showSlider />
            </>
        )
    }

    return null
}

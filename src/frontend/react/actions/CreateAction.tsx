// @ts-nocheck
import { useEffect, useMemo, useState } from "react"
import { actionRevealUsed, actions, activePopup, ai, audioPlaylists, audioStreams, categories, effects, emitters, looks, obsData, outputs, overlays, popupData, projects, scenes, shows, stageShows, styles, templates, timers, variables } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { formatSearch } from "../../shared/utils/search"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { clone } from "../../shared/utils/helpers/array"
import { _show } from "../../shared/utils/helpers/shows"
import { HRule } from "../../shared/ui/kit/h-rule/HRule"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { Button } from "../../shared/ui/kit/button/Button"
import { CombinedInput } from "../../shared/ui/kit/combined-input/CombinedInput"
import { Dropdown } from "../../shared/ui/kit/dropdown/Dropdown"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import { ToggleField } from "../../shared/ui/kit/toggle-field/ToggleField"
import { spotifyState } from "../../components/output/preview/SpotifyManager"
import { getGlobalGroupName } from "../../components/show/tools/groups"
import { Center } from "../../shared/ui/system/Center"
import { CustomInput } from "./CustomInput"
import { actionData } from "../../components/actions/actionData"
import { getActionName, getActionTriggerId } from "../../components/actions/actions"
import { API_ACTIONS } from "../../components/actions/api"
import { useStore } from "../../shared/ui/hooks/useStore"
import moduleStyles from "./CreateAction.module.css"

export interface CreateActionProps {
    list?: boolean
    full?: boolean
    mainId?: string
    mode?: string
    actionId: string
    actionValue?: unknown
    customData?: unknown
    existingActions?: string[]
    actionNameIndex?: number
    choosePopup?: boolean
    onChange?: (data: unknown) => void
    onChoose?: () => void
}

const slideActions = [
    "start_show",
    "clear_background",
    "clear_overlays",
    "clear_audio",
    "start_audio_stream",
    "start_playlist",
    "start_metronome",
    "id_start_timer",
    "start_slide_timers",
    "stop_timers",
    "change_output_style",
    "set_look",
    "change_stage_output_layout",
    "send_midi",
    "run_action"
]

export function CreateAction({ list = false, full = false, mainId = "", mode = "", actionId, actionValue = {}, customData = {}, existingActions = [], actionNameIndex = 0, choosePopup = false, onChange, onChoose }: CreateActionProps) {
    const obsStore = useStore(obsData) as unknown as never
    const spotifyStore = useStore(spotifyState) as unknown as never
    const outputsStore = useStore(outputs) as unknown as never
    const aiStore = useStore(ai) as unknown as never
    const actionRevealStore = useStore(actionRevealUsed)
    const popupDataStore = useStore(popupData) as unknown as never
    const categoriesStore = useStore(categories) as unknown as never
    const variablesStore = useStore(variables) as unknown as never
    const timersStore = useStore(timers) as unknown as never
    const audioPlaylistsStore = useStore(audioPlaylists) as unknown as never
    const overlaysStore = useStore(overlays) as unknown as never
    const emittersStore = useStore(emitters) as unknown as never
    const actionsStore = useStore(actions) as unknown as never
    const effectsStore = useStore(effects) as unknown as never
    const showsStore = useStore(shows) as unknown as never
    const projectsStore = useStore(projects) as unknown as never
    const templatesStore = useStore(templates) as unknown as never
    const scenesStore = useStore(scenes) as unknown as never
    const stageShowsStore = useStore(stageShows) as unknown as never
    const audioStreamsStore = useStore(audioStreams) as unknown as never
    const looksStore = useStore(looks) as unknown as never
    const stylesStore = useStore(styles) as unknown as never

    const [pickAction, setPickAction] = useState(false)
    const [input, setInput] = useState("")
    const [dataOpened] = useState(!Object.keys(actionValue || {}).length || !existingActions?.length)
    const [dataMenuOpened, setDataMenuOpened] = useState(false)
    const [searchValue, setSearchValue] = useState("")
    const [commonOnly, setCommonOnly] = useState(!actionRevealStore && full && mode !== "slide")

    const existingActionsFiltered = useMemo(() => (choosePopup ? existingActions : existingActions.filter((a) => a !== actionId)), [choosePopup, existingActions, actionId])

    function changeAction(data: unknown) {
        onChange?.(data)
        setPickAction(false)
    }

    const removeActions = useMemo(() => {
        const listRemove = ["change_transition"]
        if (mode) listRemove.push("toggle_action")
        if (mode !== "slide") listRemove.push("start_slide_timers")
        return listRemove
    }, [mode])

    const obsEnabled = !!obsStore?.enabled
    const spotifyEnabled = !!spotifyStore
    const webRtcOutputs = Object.values(outputsStore || {}).some((a: unknown) => a.webrtc)
    const rtmpOutputs = Object.values(outputsStore || {}).some((a: unknown) => a.rtmp)
    const smartEnabled = !!aiStore?.enabled

    const ACTIONS = useMemo(() => {
        let previousSection = ""
        const usedSections: string[] = []
        const base = Object.keys(API_ACTIONS)
            .map((id) => {
                const data = (actionData as unknown as never)[id] || {}
                const name = translateText(data.name || "", null, data.replace) || id
                const icon = data.icon || "actions"
                const common = !!data.common
                if (data.SECTION) previousSection = data.SECTION
                return { id, name, icon, common, section: previousSection }
            })
            .filter(({ id }) => {
                if (!(actionData as unknown as never)[id]) return false
                if (commonOnly && !(actionData as unknown as never)[id].common) return false
                if (id === actionId) return true
                if (!existingActionsFiltered.find((a) => a.includes("wait")) && (actionData as unknown as never)[id].incompatible?.find((x: string) => existingActionsFiltered.includes(x))) return false
                if (id.includes("get_")) return false
                if (id.startsWith("obs_") && !obsEnabled) return false
                if (id.startsWith("spotify_") && !spotifyEnabled) return false
                if (id.includes("webrtc_") && !webRtcOutputs) return false
                if (id.includes("rtmp_") && !rtmpOutputs) return false
                if (id.includes("smart_") && !smartEnabled) return false
                if (removeActions.includes(id) || (!(actionData as unknown as never)[id].canAddMultiple && existingActionsFiltered.includes(id))) return false
                if (list && !full && !slideActions.includes(id)) return false
                return true
            })

        const extras = (list && !full) || mode ? [] : [{ id: "wait", name: translateText("animate.wait"), icon: "time_in", common: true, section: "popup.action" }]

        return [...base, ...extras].map((a: unknown, i: number) => {
            if (i === 0) usedSections.length = 0
            let section = a.section || ""
            if (usedSections.includes(section)) section = ""
            if (section) usedSections.push(section)
            return { ...a, section }
        })
    }, [commonOnly, actionId, existingActionsFiltered, obsEnabled, spotifyEnabled, webRtcOutputs, rtmpOutputs, smartEnabled, removeActions, list, full, mode])

    useEffect(() => {
        if (!actionId || pickAction) return
        const nextInput = (actionData as unknown as never)[getActionTriggerId(actionId)]?.input || ""
        setInput(nextInput)
        if (list && !full && !nextInput) {
            setTimeout(() => activePopup.set(null), 50)
        }
    }, [actionId, pickAction, list, full])

    function findName(id: string): string {
        const triggerId = getActionTriggerId(id)
        return ACTIONS.find((a) => a.id === triggerId)?.name || triggerId || ""
    }

    function findIcon(id: string): string {
        const triggerId = getActionTriggerId(id)
        return ACTIONS.find((a) => a.id === triggerId)?.icon || "actions"
    }

    const dataInputs = !!(input && actionId && !pickAction && !full)

    const searchedActions = useMemo(() => {
        const sv = formatSearch(searchValue || "")
        const actionsList = clone(ACTIONS)
        if (sv.length < 2) return actionsList
        return actionsList.filter((a: unknown) => formatSearch(a.name || "").includes(sv))
    }, [ACTIONS, searchValue])

    function search(value: string | null = null) {
        const v = value || ""
        if (v.length && commonOnly) {
            setCommonOnly(false)
            actionRevealUsed.set(true)
        }
        setSearchValue(formatSearch(v))
    }

    useEffect(() => {
        function chooseAction(e: globalThis.KeyboardEvent) {
            if (e.key !== "Enter" || !searchValue.length || !searchedActions.length) return
            changeAction({ ...searchedActions[0], index: full ? undefined : 0 })
        }
        window.addEventListener("keydown", chooseAction)
        return () => window.removeEventListener("keydown", chooseAction)
    }, [searchValue, searchedActions, full])

    const getName = (object: unknown) => object?.[actionValue?.id]?.name || ""
    function getActionInfo(aid: string): string {
        const id = aid.split(":")[0]
        if (id === "change_variable") return getName(variablesStore)
        if (id === "id_start_timer") return getName(timersStore)
        if (id === "start_playlist") return getName(audioPlaylistsStore)
        if (id === "id_select_overlay" || id === "clear_overlay") return getName(overlaysStore)
        if (id === "emit_action") return emittersStore[actionValue?.emitter]?.name || ""
        if (id === "run_action" || id === "toggle_action") return getName(actionsStore)
        if (id === "id_start_effect") return getName(effectsStore)
        if (id === "start_show" || id === "id_select_show") return getName(showsStore)
        if (id === "id_select_project") return getName(projectsStore)
        if (id === "set_template") return getName(templatesStore)
        if (id === "start_scene") return getName(scenesStore)
        if (id === "toggle_output" || id === "start_output_recording") return getName(outputsStore)
        if (id === "id_select_stage_layout") return getName(stageShowsStore)
        if (id === "start_audio_stream") return getName(audioStreamsStore)
        if (id === "wait") return Number(actionValue?.number) + "s"
        if (id === "id_select_group") return getGlobalGroupName(actionValue?.id)
        if (id === "start_camera") return actionValue?.label || ""
        if (id === "start_microphone" || id === "stop_microphone") return actionValue?.name || ""
        if (id === "start_screen") return actionValue?.name || ""
        if (id === "change_volume" || id === "mute") return getActionName(id, actionValue)
        if (id.includes("index")) return String(actionValue?.index || "0")
        if (id.includes("name")) return actionValue?.value || ""
        if (id === "change_stage_output_layout") return `${actionValue?.outputId ? (outputsStore[actionValue.outputId]?.name || "—") + ": " : ""}${stageShowsStore[actionValue?.stageLayoutId]?.name || ""}`
        if (id === "change_output_style") return `${actionValue?.outputId ? (outputsStore[actionValue.outputId]?.name || "—") + ": " : ""}${actionValue?.styleId ? stylesStore[actionValue.styleId]?.name || "" : translateText("main.none")}`
        if (id === "set_look") return actionValue?.lookId ? looksStore[actionValue.lookId]?.name || "" : translateText("main.none")
        if (id === "set_next_slide_timer") return Number(actionValue?.value) + "s"
        if (id === "disable_slide") {
            const showName = actionValue?.showId ? showsStore[actionValue.showId]?.name || "—" : ""
            const slideIndex = actionValue?.index ?? 0
            return `${showName ? showName + " - " : ""}${slideIndex}`
        }
        return ""
    }

    if (list) {
        if (actionId && !pickAction && !full) {
            return (
                <CombinedInput textWidth={38}>
                    <Button onClick={() => setPickAction(true)} style={{ width: "100%" }}>
                        <Icon id={(actionData as unknown as never)[actionId]?.icon || "actions"} right />
                        <p style={{ display: "contents" }}>{findName(actionId)}</p>
                    </Button>
                </CombinedInput>
            )
        }

        return (
            <>
                <TextField label="main.search" value="" onInput={(v) => search(v)} autofocus />

                {mode !== "slide" ? (
                    <Button
                        className={`popup-options ${!commonOnly ? "active" : ""}`}
                        icon={!commonOnly ? "eye" : "hide"}
                        iconSize={1.3}
                        title={!commonOnly ? "actions.close" : "create_show.more_options"}
                        onClick={() => {
                            const next = !commonOnly
                            setCommonOnly(next)
                            actionRevealUsed.set(!next)
                        }}
                        white
                    />
                ) : null}

                {searchedActions.length ? (
                    <div className={moduleStyles.buttons} style={{ marginTop: 10 }}>
                        {searchedActions.map((action: unknown, i: number) => (
                            <div key={action.id + i}>
                                {action.section && !searchValue.length ? <HRule title={action.section} /> : null}
                                <Button
                                    style={{ width: "100%", fontWeight: "normal", justifyContent: "start", padding: "5px 20px", gap: 12, ...(searchValue.length && i === 0 ? { backgroundColor: "var(--primary-lighter)" } : {}) }}
                                    showOutline={getActionTriggerId(actionId) === action.id}
                                    isActive={(existingActionsFiltered || popupDataStore?.existing || []).map(getActionTriggerId).includes(action.id)}
                                    onClick={() => changeAction({ ...action, index: full ? undefined : 0 })}
                                >
                                    <Icon id={action.icon} />
                                    <p>{action.name}</p>
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Center size={1.2} faded style={{ height: 100, paddingTop: 20 }}>
                        <T id="empty.search" />
                    </Center>
                )}
            </>
        )
    }

    return (
        <>
            <div className={moduleStyles.box} style={actionNameIndex > 1 ? { marginTop: 5 } : undefined}>
                <div className={moduleStyles.part}>
                    <p style={{ fontWeight: 600, padding: "0 10px", display: "flex", alignItems: "center" }}>
                        <T id="midi.start_action" />
                        <span style={{ color: "var(--secondary)", display: "flex", alignItems: "center", marginInlineStart: 8 }}>{actionNameIndex ? `#${actionNameIndex}` : null}</span>
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        {actionId && existingActions.length > 1 ? (
                            <>
                                {actionNameIndex > 1 ? <Button style={{ padding: 8 }} icon="up" onClick={() => changeAction({ id: "move_up", index: actionNameIndex - 1 })} /> : null}
                                <Button style={{ padding: 6.5 }} title="actions.remove" onClick={() => changeAction({ id: "remove", index: actionNameIndex - 1 })}>
                                    <Icon id="close" size={1.2} white />
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>

                <InputRow style={{ backgroundColor: "var(--primary-darker)" }} arrow={dataInputs && !dataOpened} open={dataMenuOpened} onOpenChange={setDataMenuOpened}>
                    {!choosePopup ? (
                        <Dropdown activeId={actionId} value={findName(actionId) || "—"} options={[...(actionNameIndex ? [{ id: "remove", name: "—" }] : []), ...ACTIONS]} onClick={(option) => changeAction(option)} />
                    ) : (
                        <Button style={{ flex: 1, justifyContent: "start", ...(actionId ? { fontWeight: "normal" } : {}) }} title="actions.choose_action" onClick={() => onChoose?.()}>
                            <Icon id={findIcon(actionId)} style={{ marginInlineStart: "0.5em" }} />
                            <p>{actionId ? findName(actionId) || "—" : <T id="actions.choose_action" />}</p>
                            {dataInputs && !dataOpened && !dataMenuOpened ? <span style={{ opacity: 0.5, fontSize: "0.8em" }}>{getActionInfo(actionId)}</span> : null}
                        </Button>
                    )}
                </InputRow>
            </div>

            {dataInputs && (dataOpened || dataMenuOpened) ? (
                <div className={moduleStyles.menuIndent}>
                    <CustomInput mainId={mainId} inputId={input} actionIndex={actionNameIndex} value={actionValue} actionId={getActionTriggerId(actionId)} onChange={(v) => changeAction({ id: actionId, actionValue: v })} list />
                </div>
            ) : null}

            {mode === "slide" && getActionTriggerId(actionId) === "run_action" && categoriesStore[_show().get().category]?.action ? (
                <ToggleField label="actions.override_category_action" checked={customData?.overrideCategoryAction} defaultValue={false} onChange={(v) => changeAction({ id: actionId, customDataKey: "overrideCategoryAction", customDataValue: v })} />
            ) : null}
        </>
    )
}

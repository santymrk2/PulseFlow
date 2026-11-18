import { useEffect, useRef, useState, type ReactNode } from "react"
import { get } from "../../lib/store"
import { uid } from "uid"
import type { Action as ActionData } from "../../../types/Show"
import { actionData } from "../../components/actions/actionData"
import type { API_midi } from "../../components/actions/api"
import { customActionActivations } from "../../components/actions/customActivation"
import { convertOldMidiToNewAction, defaultMidiActionChannels, midiInListen } from "../../components/actions/midi"
import { clone, keysToID, moveToPos, sortByName } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { convertImagePathToIcon } from "../../components/helpers/media"
import { getLayoutRef, updateCachedShows } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { actionMoreOptionsUsed, actions, activePopup, activeShow, drawerTabsData, groups, overlays, popupData, showsCache, templates, timers } from "../../stores"
import { translateText } from "../../utils/language"
import { imageExtensions } from "../../values/extensions"
import { CreateAction } from "../actions/CreateAction"
import { MidiValues } from "../actions/MidiValues"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { FileField } from "../ui/file-field/FileField"
import { InputRow } from "../ui/input-row/InputRow"
import { PopupField } from "../ui/popup-field/PopupField"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./Action.module.css"

// Port de components/main/popups/Action.svelte.
// Lee: popupData { id, mode, index, indexes, overlayId, templateId, showId, actionIndex }, actions, overlays, templates, timers, groups, activePopup, actionMoreOptionsUsed.
// Escribe: popupData.id (si no había), actions[id] (50 ms después de cada cambio), history UPDATE (overlay/plantilla) o SHOW_LAYOUT (slide), actionMoreOptionsUsed,
// activePopup = null (overlay/plantilla borrados) y, al cerrar el popup por cualquier vía, quita del slide la acción que quedó sin trigger.
// CreateAction y MidiValues ya son ports React (F24.24).
// Desvío: el Svelte mutaba en el lugar el objeto del store (alias); acá se trabaja sobre una copia. updateAction (atajo) escribe en el store Y en la copia.
type ActionDraft = Omit<ActionData, "midi"> & { midi?: API_midi; customData?: Record<string, Record<string, unknown>> }

interface ActionChange {
    id?: string
    index?: number
    customDataKey?: string
    customDataValue?: unknown
    actionValue?: unknown
}

interface ActionDataEntry {
    name?: string
    replace?: string[]
    canAddMultiple?: boolean
}
const actionDataTable: Record<string, ActionDataEntry | undefined> = actionData

interface SlideActionRef extends Partial<ActionDraft> {
    id: string
}
interface LayoutActions {
    slideActions?: SlideActionRef[]
}

interface SpecificActivation {
    name: string
    list: () => { value: string; label: string }[]
}

const EMPTY_ACTION: ActionDraft = { name: "", triggers: [] }

export function Action() {
    const popupDataValue = useStore(popupData)
    const id: string = popupDataValue.id || ""
    const mode: string = popupDataValue.mode || ""

    const [action, setAction] = useState<ActionDraft>(EMPTY_ACTION)
    // última copia confirmada: los handlers de los ports y los temporizadores leen siempre ésta
    const actionRef = useRef<ActionDraft>(EMPTY_ACTION)
    const [actionMidi] = useState<API_midi>(() => ({ type: "noteon", values: { note: 0, velocity: get(popupData).mode === "slide" ? 0 : -1, channel: 1 }, defaultValues: true }))

    const loaded = useRef(false)
    const stopUpdate = useRef(false)
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const existingSearched = useRef(false)
    const autoActionName = useRef("")
    const customIconUpdateId = useRef(0)

    const [addTrigger, setAddTrigger] = useState(false)
    const [actionSelector, setActionSelector] = useState<{ id: string; index?: number } | null>(null)
    const [actionActivationSelector, setActionActivationSelector] = useState(false)
    const [showCommonActivate, setShowCommonActivate] = useState(false)

    const actionsValue = useStore(actions)
    const timersValue = useStore(timers)
    const groupsValue = useStore(groups)
    const activePopupValue = useStore(activePopup)
    const moreOptionsUsed = useStore(actionMoreOptionsUsed)

    function commit(next: ActionDraft) {
        actionRef.current = next
        setAction(next)
    }

    // Lo que leen los handlers de los ports y los temporizadores sin quedarse con una versión vieja
    const live = useRef({ actionSelector, changeAction, updateValue })
    useEffect(() => {
        live.current = { actionSelector, changeAction, updateValue }
    })

    // onMount(setAction)
    useEffect(() => {
        const data = get(popupData)
        const currentId: string = data.id || ""
        const currentMode: string = data.mode || ""
        let found: ActionDraft = EMPTY_ACTION

        if (!currentId) {
            popupData.set({ ...data, id: uid() })
        } else if (currentMode === "overlay") {
            found = get(overlays)[data.overlayId]?.actions?.find((a) => a.id === currentId) || found
        } else if (currentMode === "template") {
            found = get(templates)[data.templateId]?.settings?.actions?.find((a) => a.id === currentId) || found
        } else {
            // old
            let showMidi = _show().get("midi")?.[currentId]
            if (currentMode === "slide" && (data.index !== undefined || data.indexes?.length)) {
                const ref = getLayoutRef()
                const layoutSlide = ref[data.index ?? data.indexes[0]] || {}
                const slideActions: SlideActionRef[] = layoutSlide.data?.actions?.slideActions || []
                const existingAction = slideActions.find((a) => a.id === currentId)
                if (existingAction) showMidi = existingAction
            }
            found = get(actions)[currentId] || showMidi || found

            found = convertOldMidiToNewAction(found)
        }

        const copy = clone(found)
        if (!copy.name) copy.name = ""

        loaded.current = true
        commit(copy)
    }, [])

    // saveAction se programa 50 ms después de cada cambio; un popup que se cierra no cancela el que quedó pendiente (como en el Svelte)
    useEffect(() => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(saveAction, 50)
    }, [action])

    // onDestroy(removeEmptyAction): el cierre por botón, Esc, clic afuera o ✕ desmonta este componente
    useEffect(() => () => removeEmptyAction(), [])

    function removeEmptyAction(actionId = "") {
        const data = get(popupData)
        const ref = getLayoutRef()
        const indexes: number[] | undefined = data.index !== undefined ? [data.index] : data.indexes
        if (!indexes) return

        const newActions: LayoutActions[] = []
        let changed = false
        indexes.forEach((i) => {
            const layoutSlide = ref[i] || {}
            const slideDataActions: LayoutActions = layoutSlide.data?.actions || {}
            const slideActions = slideDataActions.slideActions || []
            const existingActionIndex = slideActions.findIndex((a) => a.id === (actionId || data.id || ""))

            // if actionId is set remove action regardless, else remove if empty
            if (existingActionIndex < 0 || (!actionId && slideActions[existingActionIndex].triggers?.[0])) {
                newActions.push(slideDataActions)
                return
            }

            slideActions.splice(existingActionIndex, 1)
            slideDataActions.slideActions = slideActions

            changed = true
            newActions.push(slideDataActions)
        })

        if (!changed) return
        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: newActions, indexes } })
    }

    // $: if (action.triggers?.[0]) findExisting()
    useEffect(() => {
        if (action.triggers?.[0]) findExisting()
    }, [action])

    function findExisting() {
        const data = get(popupData)
        const currentMode: string = data.mode || ""
        if (currentMode !== "slide" || (data.index === undefined && !data.indexes?.length) || existingSearched.current) return
        existingSearched.current = true

        const ref = getLayoutRef()
        const layoutSlide = ref[data.index ?? data.indexes[0]] || {}
        const slideActions: SlideActionRef[] = layoutSlide.data?.actions?.slideActions || []

        // find any action with the same trigger type
        const triggerId = actionRef.current.triggers?.[0]
        if (!triggerId) return

        // Check if this action type can have multiple instances
        const canAddMultiple = actionDataTable[triggerId.split(":")[0]]?.canAddMultiple // remove unique suffix if present

        // For actions that can't have multiple instances, find and replace existing
        if (!canAddMultiple) {
            const currentId: string = data.id || ""
            const existingAction = slideActions.find((a) => a.triggers?.[0] === triggerId && (!currentId || a.id !== currentId))
            if (!existingAction) return

            // remove new action if already existing
            if (currentId !== existingAction.id && currentMode === "slide") removeEmptyAction(currentId)

            commit(clone({ name: "", triggers: [], ...existingAction }))
            popupData.set({ ...get(popupData), id: existingAction.id })
        }
        // For actions that can have multiple instances, don't auto-replace
    }

    async function updateValue(key: string, raw: unknown) {
        let value = raw ?? ""

        // downscale image to 64x64 and convert to base64
        if (key === "customIcon" && typeof value === "string" && value) {
            const updateId = ++customIconUpdateId.current
            value = await convertImagePathToIcon(value, 64)
            // ignore async result if user has picked another image in the meantime
            if (updateId !== customIconUpdateId.current) return
        }

        commit({ ...actionRef.current, [key]: value })
    }

    function updateAction(key: string, value: string) {
        if (!value) {
            updateValue(key, "")
            return
        }

        let updated = false
        actions.update((a) => {
            if (!a[id]) return a
            Object.assign(a[id], { [key]: value })
            updated = true
            return a
        })
        if (updated) commit({ ...actionRef.current, [key]: value })
    }

    function changeAction(detail: ActionChange, index = -1) {
        let actionId = detail.id || ""
        if (!actionId) return

        const canAddMultiple = actionDataTable[actionId]?.canAddMultiple
        if (canAddMultiple && !actionId.includes(":")) actionId += ":" + uid(5)

        if (detail.index !== undefined) index = detail.index

        const next = clone(actionRef.current)

        // add extra action data (used for "slide action">"run action">"override category action", toggle)
        if (detail.customDataKey) {
            if (!next.name) next.name = actionId
            if (!next.customData) next.customData = {}
            if (!next.customData[actionId]) next.customData[actionId] = {}
            next.customData[actionId][detail.customDataKey] = detail.customDataValue
            commit(next)
            return
        }

        // update action value instead of action id
        if (detail.actionValue) {
            if (!next.name) next.name = actionId
            if (!next.actionValues) next.actionValues = {}
            next.actionValues[actionId] = detail.actionValue
            commit(next)
            return
        }

        // move up action id
        if (actionId === "move_up") {
            if (index === undefined) return
            next.triggers = moveToPos(next.triggers, index, index - 1)
            commit(next)
            return
        }

        // remove action id
        if (actionId === "remove") {
            if (index === undefined) return
            next.triggers.splice(index, 1)
            commit(next)
            return
        }

        if (!next.triggers) next.triggers = []
        // can't set if it exists already
        if (!canAddMultiple && next.triggers.find((triggerId) => triggerId === actionId)) return

        if (index > -1) next.triggers[index] = actionId
        else next.triggers.push(actionId)

        // set all MIDI values
        if (next.midiEnabled && next.midi?.defaultValues && defaultMidiActionChannels[actionId]) {
            next.midi = { ...next.midi, ...defaultMidiActionChannels[actionId] }
        }

        // auto name (if empty or not changed by user)
        const currentMode: string = get(popupData).mode || ""
        if ((next.name || "") === autoActionName.current && next.triggers.length === 1) {
            autoActionName.current = translateText(actionDataTable[detail.id || ""]?.name || "", null, actionDataTable[detail.id || ""]?.replace || []) || detail.id || ""
            if (autoActionName.current) next.name = autoActionName.current
        }

        // reset velocity
        if (actionId.includes("index_") && next.midi?.values) {
            next.midi.values.velocity = currentMode === "slide" ? 0 : -1
        }

        // update
        commit(next)
        setAddTrigger(false)

        // update names/icons
        if (currentMode === "slide") updateCachedShows(get(showsCache))
    }

    // TODO: history!
    // WIP MIDI remove unused / empty actions from slide

    function saveAction() {
        const data = get(popupData)
        const currentId: string = data.id || ""
        const currentMode: string = data.mode || ""
        if (!loaded.current || stopUpdate.current) return

        const current = actionRef.current
        if (currentMode !== "slide" && currentMode !== "overlay" && currentMode !== "template" && !current.name) return

        const value: ActionDraft = current.midiEnabled && !current.midi ? { ...current, midi: actionMidi } : current

        if (currentMode === "overlay") {
            const overlayId = data.overlayId
            const overlay = get(overlays)[overlayId]
            if (!overlay) return activePopup.set(null)
            if (!value.triggers?.length) return

            const overlayActions = overlay?.actions || []
            const existingIndex = overlayActions.findIndex((a) => a.id === currentId || a.triggers?.[0] === value.triggers?.[0])
            if (existingIndex > -1) overlayActions[existingIndex] = value
            else overlayActions.push(value)

            const newData = { key: "actions", data: overlayActions }
            history({ id: "UPDATE", newData, oldData: { id: overlayId }, location: { page: "drawer", id: "overlay_key", override: `actions_${overlayId}` } })
        } else if (currentMode === "template") {
            const templateId = data.templateId
            const template = get(templates)[templateId]
            if (!template) return activePopup.set(null)
            if (!value.triggers?.length) return

            const templateSettings = template?.settings || {}

            const templateActions = templateSettings.actions || []
            const existingIndex = templateActions.findIndex((a) => a.id === currentId || a.triggers?.[0] === value.triggers?.[0])
            if (existingIndex > -1) templateActions[existingIndex] = value
            else templateActions.push(value)

            templateSettings.actions = templateActions
            const newData = { key: "settings", data: templateSettings }
            history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "drawer", id: "template_settings", override: `actions_${templateId}` } })
        } else if (currentMode !== "slide") {
            const exists = !!get(actions)[currentId]
            const toSave = clone(value)
            actions.update((a) => {
                // set tag
                const functionsTab = get(drawerTabsData).functions
                if (!exists && functionsTab?.activeSubTab === "actions" && functionsTab?.activeSubmenu) {
                    toSave.tags = [functionsTab.activeSubmenu]
                }

                a[currentId] = toSave

                return a
            })

            midiInListen()
        } else if (get(activeShow)) {
            // WIP move this from show to action
            const showMidi = _show().get("midi") || {}
            if (showMidi[currentId]) {
                if (JSON.stringify(showMidi[currentId] || {}) === JSON.stringify(value)) return
                showMidi[currentId] = value
                _show().set({ key: "midi", value: showMidi })
                return
            }

            saveSlide(value, currentId)
        }

        stopUpdate.current = true
        setTimeout(() => (stopUpdate.current = false), 100)
    }

    function saveSlide(value: ActionDraft, currentId: string) {
        const data = get(popupData)
        const ref = getLayoutRef()
        const indexes: number[] | undefined = data.index !== undefined ? [data.index] : data.indexes
        if (!Array.isArray(indexes)) return

        const newActions: LayoutActions[] = []
        let changed = false
        indexes.forEach((i) => {
            const slideDataActions: LayoutActions = clone(ref[i]?.data?.actions) || {}
            if (!slideDataActions.slideActions) slideDataActions.slideActions = []

            const currentSlideActionIndex = slideDataActions.slideActions.findIndex((a) => a.id === currentId)
            if (currentSlideActionIndex < 0) {
                changed = true
                newActions.push(slideDataActions)
                return
            }

            slideDataActions.slideActions[currentSlideActionIndex] = { ...value, id: currentId }

            changed = true
            newActions.push(slideDataActions)
        })

        if (!changed) return
        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: newActions, indexes } })
    }

    // set show when selected
    const startShowTrigger = action.triggers?.find((a) => a === "start_show" || a === "id_select_show")
    const selectedShowId: string | undefined = popupDataValue.showId
    const selectedActionIndex: number | undefined = popupDataValue.actionIndex
    useEffect(() => {
        if (!startShowTrigger || !selectedShowId) return
        // el Svelte lo repetía en cada cambio de `action`; acá se evita reescribir lo que ya quedó igual
        const current: ActionDraft = actionRef.current
        if (current.actionValues?.[startShowTrigger]?.id === selectedShowId && current.name) return
        live.current.changeAction({ id: startShowTrigger, actionValue: { id: selectedShowId } }, selectedActionIndex)
    }, [action, startShowTrigger, selectedShowId, selectedActionIndex])

    // custom activations
    const customActivation: string = action.customActivation || (action.startupEnabled ? "startup" : "") || ""
    const specificActivation: string = action.specificActivation?.includes(customActivation) ? action.specificActivation.split("__")[1] || "" : ""

    const specificActivations: Record<string, SpecificActivation> = {
        timer_end: {
            name: "items.timer",
            list: () => sortByName(keysToID(timersValue)).map(({ id: timerId, name }) => ({ value: timerId, label: name }))
        },
        timer_start: {
            name: "items.timer",
            list: () => sortByName(keysToID(timersValue)).map(({ id: timerId, name }) => ({ value: timerId, label: name }))
        },
        group_start: {
            name: "actions.choose_group",
            list: () => sortByName(keysToID(groupsValue)).map((a) => ({ value: a.id, label: a.default ? translateText("groups." + a.name) : a.name }))
        }
    }
    function getSpecificActivation(activation: string) {
        return [{ value: "", label: translateText("actions.any") }, ...specificActivations[activation].list()]
    }

    // keys
    const existingShortcuts = Object.values(actionsValue)
        .map((a) => a.keypressActivate || "")
        .filter(Boolean)

    // pre 1.3.9
    const midiEnabled = !!action.midiEnabled
    useEffect(() => {
        if (midiEnabled && !customActivation) live.current.updateValue("customActivation", "midi_signal_received")
    }, [midiEnabled, customActivation])

    const showMore = !!(action.keypressActivate || customActivation || moreOptionsUsed)
    const hasNoName = !action.name

    const midiValue = clone(action.midi || actionMidi)
    const firstActionId = action.triggers?.[0]
    const activationInputs = customActionActivations.find((a) => a.id === customActivation)?.inputs

    // Los handlers de los ports leen siempre `live` para no quedarse con el estado viejo
    const triggerProps = (actionId: string) => ({
        onChange: (data: unknown) => live.current.changeAction(data as ActionChange, Math.max(actionRef.current.triggers?.indexOf(actionId) ?? -1, -1)),
        onChoose: () => setActionSelector({ id: actionId, index: actionRef.current.triggers?.indexOf(actionId) })
    })

    let content: ReactNode
    if (mode === "slide" || mode === "template" || mode === "overlay") {
        content = <CreateAction key="list" mainId={id} actionId={action.triggers?.[0] || ""} existingActions={action.triggers || []} actionValue={action.actionValues?.[action.triggers?.[0] || ""] || {}} customData={action.customData?.[action.triggers?.[0] || ""] || {}} mode={mode} list onChange={(data) => live.current.changeAction(data as ActionChange)} />
    } else {
        const busy = !!actionSelector || actionActivationSelector

        content = (
            <>
                {actionActivationSelector ? (
                    <>
                        <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setActionActivationSelector(false)} />

                        <Button className={`popup-options ${showCommonActivate ? "active" : ""}`} icon={showCommonActivate ? "eye" : "hide"} iconSize={1.3} title={showCommonActivate ? "actions.close" : "create_show.more_options"} onClick={() => setShowCommonActivate(!showCommonActivate)} white />

                        <div className={styles.buttons}>
                            {customActionActivations.map((activation) =>
                                activation.common || showCommonActivate ? (
                                    <Button
                                        key={activation.id}
                                        style={{ width: "100%", fontWeight: "normal", justifyContent: "start", padding: "5px 20px", gap: "12px" }}
                                        showOutline={customActivation === activation.id}
                                        isActive={customActivation === activation.id}
                                        onClick={() => {
                                            updateValue("customActivation", activation.id)
                                            setActionActivationSelector(false)
                                        }}
                                    >
                                        <Icon id={activation.icon} white />
                                        <p>{translateText(activation.name)}</p>
                                    </Button>
                                ) : null
                            )}
                        </div>
                    </>
                ) : actionSelector !== null ? (
                    <>
                        <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setActionSelector(null)} />

                        <CreateAction
                            key="selector"
                            mainId={id}
                            actionId={actionSelector.id}
                            existingActions={action.triggers}
                            actionValue={action.actionValues?.[actionSelector.id] || {}}
                            mode={mode}
                            list
                            full
                            onChange={(data) => {
                                live.current.changeAction(data as ActionChange, live.current.actionSelector?.index)
                                setActionSelector(null)
                            }}
                        />
                    </>
                ) : (
                    <InputRow>
                        <TextField key={String(hasNoName)} label="midi.name" value={action.name} onChange={(value) => updateValue("name", value)} autofocus={hasNoName} />

                        {showMore && !mode ? <FileField label="items.icon" style={{ width: "120px" }} value={action.customIcon} filter={{ name: "Image files", extensions: imageExtensions }} onChange={(value) => updateValue("customIcon", value)} noLabel={!!action.customIcon} showThumbnail allowEmpty /> : null}
                    </InputRow>
                )}

                {!mode && !busy ? (
                    <Button
                        className={`popup-options ${showMore ? "active" : ""}`}
                        icon="options"
                        iconSize={1.3}
                        title={showMore ? "actions.close" : "create_show.more_options"}
                        onClick={() => {
                            actionMoreOptionsUsed.set(!showMore)
                        }}
                        white
                    />
                ) : null}

                {/* if not slide specific trigger action */}
                {showMore && !mode && !busy ? (
                    <>
                        <PopupField label="midi.activate_keypress" disabled={!action.name} style={{ marginTop: "10px" }} id={id} name={typeof action.keypressActivate === "string" ? action.keypressActivate.toUpperCase() : ""} value={action.keypressActivate} icon="shortcut" popupId="assign_shortcut" data={{ ...popupDataValue, mode: "action", revert: activePopupValue, existingShortcuts }} onChange={(value) => updateAction("keypressActivate", value || "")} allowEmpty />

                        {/* only used to disable customActionActivation if any */}
                        {customActivation || action.enabled === false ? <ToggleField label="settings.enabled" style={{ marginTop: "10px" }} checked={action.enabled ?? true} defaultValue={true} onChange={(value) => updateValue("enabled", value)} /> : null}

                        <InputRow
                            arrow={activationInputs}
                            menu={
                                <div>
                                    {["timer_end", "timer_start", "group_start"].includes(customActivation) ? (
                                        <SelectField label={specificActivations[customActivation]?.name} options={getSpecificActivation(customActivation)} value={specificActivation} onChange={(value) => updateValue("specificActivation", `${customActivation}__${value}`)} />
                                    ) : customActivation === "midi_signal_received" ? (
                                        <MidiValues key="midi-simple" value={midiValue} firstActionId={firstActionId} simple onChange={(value) => live.current.updateValue("midi", value)} />
                                    ) : null}
                                </div>
                            }
                        >
                            <PopupField
                                label="actions.custom_activation"
                                disabled={!action.name}
                                name={customActionActivations.find((a) => a.id === customActivation)?.name || ""}
                                value={customActivation}
                                icon="trigger"
                                popupId="about"
                                openEvent={() => setActionActivationSelector(true)}
                                onChange={() => {
                                    updateValue("customActivation", "")
                                    updateValue("enabled", true)
                                }}
                                allowEmpty
                            />
                        </InputRow>

                        <hr className={styles.rule} />
                    </>
                ) : null}

                {!busy ? (
                    <>
                        {!mode ? !showMore ? <div style={{ height: "15px" }}></div> : null : <hr className={styles.rule} />}

                        {/* multiple actions */}
                        <div>
                            {(action.triggers ?? []).map((actionId, i) => (
                                <CreateAction key={`trigger-${actionId}`} mainId={id} actionId={actionId} existingActions={action.triggers} actionValue={action.actionValues?.[actionId]} actionNameIndex={i + 1} mode={mode} choosePopup {...triggerProps(actionId)} />
                            ))}
                            {!action.triggers?.length || addTrigger ? (
                                <CreateAction key="new-trigger" actionId="" existingActions={action.triggers || []} mode={mode} choosePopup onChange={(data) => live.current.changeAction(data as ActionChange)} onChoose={() => setActionSelector({ id: "" })} />
                            ) : (
                                <Button
                                    variant="outline"
                                    style={{ marginTop: "10px", width: "100%" }}
                                    icon="add"
                                    onClick={() => {
                                        setAddTrigger(true)
                                        setActionSelector({ id: "" })
                                    }}
                                >
                                    <T id="settings.add" />
                                </Button>
                            )}
                        </div>
                    </>
                ) : null}

                {action.midiEnabled && customActivation !== "midi_signal_received" && !busy ? (
                    <>
                        <h3 className={styles.midiTitle}>
                            <T id="midi.midi" />
                        </h3>

                        <MidiValues key="midi" value={midiValue} firstActionId={firstActionId} onChange={(value) => live.current.updateValue("midi", value)} />
                    </>
                ) : null}
            </>
        )
    }

    return <div style={{ minWidth: "45vw" }}>{content}</div>
}

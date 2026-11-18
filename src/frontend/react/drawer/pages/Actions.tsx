import { useEffect, useState, type CSSProperties } from "react"
import type { Action, Tag } from "../../../../types/Show"
import { actionTags, activeActionTagFilter, activePopup, activeProfile, actions, labelsDisabled, popupData, profiles, runningActions, special, timelineRecordingAction } from "../../../stores"
import { translateText } from "../../../utils/language"
import { getAccess } from "../../../utils/profile"
import { getActionIcon, runAction } from "../../../components/actions/actions"
import { customActionActivations } from "../../../components/actions/customActivation"
import { convertOldMidiToNewAction, midiToNote, receivedMidi } from "../../../components/actions/midi"
import { keysToID, sortByName } from "../../../components/helpers/array"
import { cn } from "../../../lib/utils"
import { T } from "../../helpers/T"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import styles from "./Actions.module.css"

// Port de components/drawer/pages/Actions.svelte: lista o grilla de acciones, con ajustes por etiqueta.
type ActionWithId = Action & { id: string }

const rowButtonStyle: CSSProperties = { width: "100%", height: "100%" }
const gridButtonStyle: CSSProperties = { ...rowButtonStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px 4px 4px" }

export function Actions() {
    const actionsValue = useStore(actions)
    const actionTagsValue = useStore(actionTags)
    const activeActionTagFilterValue = useStore(activeActionTagFilter)
    const runningActionsValue = useStore(runningActions)
    const specialValue = useStore(special)
    const labelsDisabledValue = useStore(labelsDisabled)
    const activeProfileValue = useStore(activeProfile)
    useStore(profiles)

    const profile = (activeProfileValue ? getAccess("actions") : {}) as Record<string, string | undefined>
    const readOnly = profile.global === "read"

    const sortedActions = sortByName(keysToID(actionsValue) as ActionWithId[], "name", true).map((action) => convertOldMidiToNewAction(action) as ActionWithId)
    const filteredActionsTags = sortedActions.filter((a) => !activeActionTagFilterValue.length || (a.tags?.length && !activeActionTagFilterValue.some((tagId) => !a.tags?.includes(tagId)))).filter((a) => !a.tags?.some((tagId) => profile[tagId] === "none"))
    const filteredActions = filteredActionsTags

    // GRID VIEW

    const gridCentered = filteredActions.length > 0 && filteredActions.length <= 12

    const [showGrid, setShowGrid] = useState(false)
    const gridKey = activeActionTagFilterValue.length === 1 ? "actions_grid" + activeActionTagFilterValue[0] : ""
    useEffect(() => {
        if (!gridKey) {
            setShowGrid(false)
            return
        }

        setShowGrid(!!(specialValue as unknown as Record<string, unknown>)[gridKey])
    }, [gridKey, specialValue])

    function toggleShowGrid() {
        if (activeActionTagFilterValue.length !== 1) return

        const next = !showGrid
        setShowGrid(next)

        const tagId = activeActionTagFilterValue[0]
        const key = "actions_grid" + tagId
        special.update((a) => {
            ;(a as unknown as Record<string, unknown>)[key] = next
            return a
        })
    }

    function newAction() {
        popupData.set({})
        activePopup.set("action")
    }

    function clickAction(action: ActionWithId, ctrl: boolean) {
        if (ctrl) return
        if (action.shows?.length) {
            receivedMidi({ id: action.id, bypass: true })
            return
        }

        runAction(action, { source: "click" })
        timelineRecordingAction.set({ id: "run_action", data: { id: action.id } })
    }

    return (
        <>
            <div className={`context #actions${readOnly ? "_readonly" : ""}`} style={{ position: "relative", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {filteredActions.length ? (
                    <div className={cn(styles.actions, showGrid && styles.grid, showGrid && gridCentered && styles.gridCentered)}>
                        {filteredActions.map((action) => {
                            const isReadOnly = readOnly || action.tags?.some((tagId) => profile[tagId] === "read")

                            return (
                                <div key={action.id} className={cn(styles.action, "context", `#action${isReadOnly ? "_readonly" : ""}`)}>
                                    <SelectElem id="action" data={action} style={showGrid ? { display: "block", width: "100%", height: "100%" } : { display: "flex", flex: 1 }} draggable>
                                        <Button align="start" title={`${translateText("media.play")}: <b>${action.name}</b>`} onClick={(detail) => clickAction(action, detail.ctrl)} showOutline={runningActionsValue.includes(action.id)} bold={false} style={showGrid ? gridButtonStyle : undefined}>
                                            <span style={showGrid ? { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 6 } : { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                                                <span style={showGrid ? { display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", width: "100%", height: "100%" } : { display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span style={showGrid ? { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: "2.8em" } : { display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        {action.shows?.length ? <Icon id="slide" size={showGrid ? 4 : 1} white /> : action.customIcon ? <img src={action.customIcon} style={{ width: showGrid ? "4rem" : "1rem", height: showGrid ? "4rem" : "1rem", objectFit: "contain", borderRadius: 2 }} /> : action.triggers?.length !== 1 ? <Icon id="actions" size={showGrid ? 4 : 1} /> : <Icon id={getActionIcon(action.id)} size={showGrid ? 4 : 1} />}
                                                    </span>
                                                    <span style={showGrid ? { fontSize: "0.9em", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: 112, maxWidth: 112, display: "block", margin: "0 auto" } : { display: "flex", alignItems: "center", gap: 8 }}>
                                                        {action.shows?.length ? <T id="actions.play_on_midi" /> : action.name || "—"}
                                                        {action.keypressActivate ? <span className={styles.key}>{action.keypressActivate}</span> : null}
                                                    </span>
                                                </span>

                                                {!showGrid ? (
                                                    <p style={{ opacity: 0.8, display: "flex", gap: 20 }} className={cn(action.enabled === false && styles.deactivated)}>
                                                        {action.customActivation || action.startupEnabled ? <span>{translateText(customActionActivations.find((a) => a.id === action.customActivation)?.name || "actions.custom_activation")}</span> : null}

                                                        {action.midiEnabled && action.midi ? (
                                                            <span>
                                                                <T id="midi.note" />: {action.midi.type === "control" ? action.midi.values?.controller || 0 : action.midi.values?.note === undefined ? "" : midiToNote(action.midi.values.note)},
                                                                {action.midi.type === "control" ? (
                                                                    <>
                                                                        <T id="variables.value" />: {action.midi.values?.value},
                                                                    </>
                                                                ) : (action.midi.values?.velocity ?? -1) > -1 ? (
                                                                    <>
                                                                        <T id="midi.velocity" />: {action.midi.values?.velocity},
                                                                    </>
                                                                ) : null}
                                                                <T id="midi.channel" />: {action.midi.values?.channel}
                                                                {action.midi.type !== "noteon" ? ` — ${action.midi.type}` : null}
                                                            </span>
                                                        ) : null}
                                                    </p>
                                                ) : null}
                                            </span>

                                            {/* this is probably not in use: */}
                                            {!showGrid ? <p style={{ opacity: 0.5, fontStyle: "italic" }}>{(action.shows?.length ?? 0) > 1 ? action.shows?.length : ""}</p> : null}

                                            {/* tags */}
                                            {activeActionTagFilterValue.length && !showGrid ? (
                                                <span className={styles.tags}>
                                                    {action.tags?.map((tagId) => {
                                                        const tag = actionTagsValue[tagId] as Tag | undefined
                                                        if (!tag || activeActionTagFilterValue.includes(tagId)) return null

                                                        return (
                                                            <span key={tagId} className={styles.tag} style={{ "--color": tag.color || "white" } as CSSProperties}>
                                                                <p>{tag.name || "—"}</p>
                                                            </span>
                                                        )
                                                    })}
                                                </span>
                                            ) : null}
                                        </Button>
                                    </SelectElem>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                )}
            </div>

            {activeActionTagFilterValue.length === 1 ? (
                <FloatingBar side="left">
                    <Button onClick={toggleShowGrid} title={`show.${showGrid ? "grid" : "list"}`}>
                        <Icon size={1.3} id={showGrid ? "grid" : "list"} white />
                    </Button>
                </FloatingBar>
            ) : null}

            <FloatingBar onlyOne>
                <Button disabled={readOnly} icon="add" title="new.action" onClick={newAction}>
                    {!labelsDisabledValue ? <T id="new.action" /> : null}
                </Button>
            </FloatingBar>
        </>
    )
}

import type { CSSProperties } from "react"
import type { Output } from "../../../types/Output"
import type { Show, Slide } from "../../../types/Show"
import { activeShow, groups, outputs, showsCache, special, templates } from "../../shared/core/stores"
import { newToast } from "../../utils/common"
import { translateText } from "../../utils/language"
import { getAccess } from "../../utils/profile"
import { actionData } from "../../components/actions/actionData"
import { getActionName, getActionTriggerId } from "../../components/actions/actions"
import { clone } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { getFirstActiveOutput } from "../../components/helpers/output"
import { getLayoutRef } from "../../components/helpers/show"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { Button, type ButtonEvent } from "../ui/button/Button"
import styles from "./Actions.module.css"

interface SlideAction {
    id?: string
    name?: string
    triggers?: string[]
    actionValues?: Record<string, unknown>
    customData?: Record<string, unknown>
}

export interface ActionsProps {
    slide?: Slide | null
    columns: number
    index?: number
    templateId?: string
    actions: Record<string, unknown> & { slideActions?: SlideAction[]; slide_shortcut?: { key?: string } }
}

interface Shortcut {
    value: string
    type: "slide" | "dynamic"
}

function getNextShortcut(actions: ActionsProps["actions"], show: Show, showId: string, output: (Output & { id: string }) | undefined, groupShortcutPreview: boolean, groupsStore: Record<string, { shortcut?: string }>, index: number): Shortcut | null {
    if (actions.slide_shortcut?.key) return { value: actions.slide_shortcut.key as string, type: "slide" }
    if (!groupShortcutPreview) return null

    const outSlide = output?.out?.slide
    if (outSlide && (outSlide.id !== showId || outSlide.layout !== show?.settings?.activeLayout)) return null

    const ref = getLayoutRef(showId)
    const refSlide = ref[index] || {}
    const currentSlideGroup = refSlide.type === "parent" ? show.slides?.[refSlide.id]?.globalGroup : null
    const shortcut = (groupsStore[currentSlideGroup || ""]?.shortcut || "").toUpperCase()
    if (!shortcut) return null

    const isSlideShortcut = ref.some((a) => {
        const slideShortcut = ((a.data?.actions as { slide_shortcut?: { key?: string } } | undefined)?.slide_shortcut?.key || "").toUpperCase()
        return slideShortcut === shortcut
    })
    if (isSlideShortcut) return null

    const outIndex = outSlide?.index ?? -1
    let nextGroupIndex = ref.findIndex((a) => {
        const slideGroup = show.slides?.[a.id]?.globalGroup
        if (!slideGroup || slideGroup !== currentSlideGroup) return false
        return a.layoutIndex > outIndex
    })
    if (nextGroupIndex === -1) {
        nextGroupIndex = ref.findIndex((a) => {
            const slideGroup = show.slides?.[a.id]?.globalGroup
            return slideGroup && slideGroup === currentSlideGroup
        })
    }
    if (nextGroupIndex !== index) return null
    return { value: shortcut, type: "dynamic" }
}

// Port de components/slide/Actions.svelte (F24.18b).
export function Actions({ slide = null, columns, index = -1, templateId = "", actions }: ActionsProps) {
    const currentActiveShow = useStore(activeShow)
    const currentShowsCache = useStore(showsCache)
    const currentOutputs = useStore(outputs)
    const currentSpecial = useStore(special)
    const currentGroups = useStore(groups)
    const currentTemplates = useStore(templates)

    const showId = currentActiveShow?.id || ""
    const currentShow = currentShowsCache[showId] || {}
    const shortcut = getNextShortcut(actions, currentShow, showId, getFirstActiveOutput(currentOutputs), !!currentSpecial.groupShortcutPreview, currentGroups, index)
    const zoom = 4 / columns

    function hasAccess() {
        if (currentShow.locked) {
            newToast("show.locked")
            return false
        }
        if (slide?.locked) {
            newToast("output.state_locked")
            return false
        }
        const profile = getAccess("shows")
        const readOnly = profile.global === "read" || profile[currentShow.category || ""] === "read"
        if (readOnly) {
            newToast("profile.locked")
            return false
        }
        return true
    }

    function changeAction(id: string, save = true) {
        if (!hasAccess() || templateId) return
        const data = { ...actions, [id]: actions[id] ? !actions[id] : true } as Record<string, unknown>
        if (id === "slide_shortcut") delete data[id]
        else if (id === "outputStyle" && !data[id]) delete data.styleOutputs
        history({ id: "SHOW_LAYOUT", save, newData: { key: "actions", data, indexes: [index] } })
    }

    function deleteSlideAction(event: ButtonEvent, id: string) {
        if (!hasAccess()) return
        event.preventDefault()
        const slideActions = clone(actions.slideActions || [])
        const actionIndex = slideActions.findIndex((a) => a.id === id || getActionTriggerId(a.triggers?.[0] || "") === id)
        if (actionIndex < 0) return
        slideActions.splice(actionIndex, 1)

        if (templateId) {
            const templateSettings = { ...(currentTemplates[templateId]?.settings || {}), actions: slideActions }
            history({ id: "UPDATE", newData: { key: "settings", data: templateSettings }, oldData: { id: templateId }, location: { page: "drawer", id: "template_settings", override: `actions_${templateId}` } })
            return
        }
        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: { ...actions, slideActions }, indexes: [index] } })
    }

    function getCustomStyle(customData: Record<string, unknown>) {
        if (!Object.keys(customData || {}).length) return ""
        if (Object.entries(customData).find(([key, value]) => key === "overrideCategoryAction" && value === true)) return "color: #a1faff;"
        return ""
    }

    const actionsList = [
        { id: "nextAfterMedia", title: translateText("actions.next_after_media"), icon: "forward" },
        { id: "animate", title: translateText("popup.animate"), icon: "stars" },
        { id: "receiveMidi", title: translateText("actions.play_on_midi"), icon: "play" }
    ]

    return (
        <div className={styles.icons} style={{ zoom }}>
            {shortcut ? (
                <div className={`${styles.button} ${styles.white}`} style={{ border: "1px solid var(--secondary)" }}>
                    {shortcut.type === "slide" ? (
                        <Button align="start" style={{ padding: "3px" }} title={translateText("actions.remove: actions.play_with_shortcut")} redHover onClick={() => changeAction("slide_shortcut")}>
                            <p style={{ fontWeight: "bold", textTransform: "capitalize", padding: "0 4px", fontSize: "1.2em" }}>{shortcut.value}</p>
                        </Button>
                    ) : (
                        <Button align="start" style={{ padding: "1px" }}>
                            <p style={{ fontWeight: "bold", textTransform: "capitalize", padding: "0 3px", fontSize: "0.8em" }}>{shortcut.value}</p>
                        </Button>
                    )}
                </div>
            ) : null}

            {actionsList.map((action) =>
                actions[action.id] ? (
                    <div key={action.id} className={`${styles.button} ${styles.white}`}>
                        <Button align="start" style={{ padding: "3px" }} redHover title={translateText(`actions.remove: ${action.title}`)} onClick={() => changeAction(action.id)}>
                            <Icon id={action.icon} size={0.9} white />
                        </Button>
                    </div>
                ) : null
            )}

            {actions.slideActions?.length
                ? actions.slideActions.map((action, i) => {
                      const actionId = getActionTriggerId(action.triggers?.[0] || "")
                      const customData = (actionData as Record<string, { red?: boolean; name?: string; icon?: string }>)[actionId] || {}
                      const actionValue = action.actionValues?.[actionId] || action.actionValues?.[action.triggers?.[0] || ""] || {}
                      const specialData = (action.customData?.[actionId] || action.customData?.[action.triggers?.[0] || ""] || {}) as Record<string, unknown>
                      const customName = getActionName(actionId, actionValue) || (action.name !== translateText(customData.name || "") ? action.name : "")
                      const title = `${translateText("actions.remove")}: <b>${translateText(customData.name || "")}</b>${action.name && action.name !== translateText(customData.name || "") ? `\n${action.name}` : ""}`
                      return (
                          <div key={i} className={`${styles.button} ${customData.red ? "" : styles.white}`}>
                              <Button align="start" style={{ padding: "3px", ...cssTextToStyle(getCustomStyle(specialData)) } as CSSProperties} redHover title={title} onClick={(_, e) => deleteSlideAction(e, (action.id as string) || actionId)}>
                                  {customName ? <p>{customName}</p> : null}
                                  <Icon id={customData.icon || "actions"} size={0.9} white />
                              </Button>
                          </div>
                      )
                  })
                : null}
        </div>
    )
}

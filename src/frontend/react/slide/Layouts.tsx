import type { CSSProperties, ReactNode } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import type { Show } from "../../../types/Show"
import { changeSlidesView } from "../../features/show/logic/slides"
import { actions, activePopup, activeProject, activeShow, alertMessage, editingProjectTemplate, labelsDisabled, projects, projectTemplates, showsCache, slidesOptions } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getAccess } from "../../shared/utils/profile"
import { getActionIcon, runAction } from "../../components/actions/actions"
import { keysToID, sortByName } from "../../shared/utils/helpers/array"
import { duplicate } from "../../shared/utils/helpers/clipboard"
import { history } from "../../shared/utils/helpers/history"
import { _show } from "../../shared/utils/helpers/shows"
import { joinTime, secondsToTime } from "../../shared/utils/helpers/time"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button, type ButtonClickDetail } from "../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import { HiddenInput, type HiddenInputEdit } from "../../shared/ui/kit/hidden-input/HiddenInput"
import { SelectElem } from "../../shared/ui/system/SelectElem"
import { ZoomControl } from "../../shared/ui/kit/zoom-control/ZoomControl"
import { Reference } from "./Reference"
import styles from "./Layouts.module.css"

interface LayoutInfo {
    id: string
    name?: string
}

// (F24.18b).
export function Layouts() {
    const currentActiveShow = useStore(activeShow)
    const currentShowsCache = useStore(showsCache)
    const currentActions = useStore(actions)
    const currentEditingProjectTemplate = useStore(editingProjectTemplate)
    const currentActiveProject = useStore(activeProject)
    const currentProjects = useStore(projects)
    const currentProjectTemplates = useStore(projectTemplates)
    const currentSlidesOptions = useStore(slidesOptions)
    const currentLabelsDisabled = useStore(labelsDisabled)

    const showId = currentActiveShow?.id || ""
    const currentShow = currentShowsCache[showId] || ({} as Show)
    const layouts = currentShow.layouts
    const activeLayout = currentShow.settings?.activeLayout

    const isTemplate = !!currentEditingProjectTemplate
    const projectId = isTemplate ? currentEditingProjectTemplate : currentActiveProject
    const store = isTemplate ? projectTemplates : projects
    const project = (isTemplate ? currentProjectTemplates : currentProjects)[projectId || ""]

    const sortedLayouts: LayoutInfo[] = sortByName(keysToID(layouts || {})) as LayoutInfo[]
    const layoutSlides = layouts?.[activeLayout || ""]?.slides || []

    const ref =
        _show()
            .layouts("active")
            .ref()[0]
            ?.filter((a) => a?.data && !a.data.disabled) || []
    const total = ref.reduce((value, slide) => value + Number(slide?.data?.nextTimer || 0), 0)
    const totalTime = total ? (total > 59 ? joinTime(secondsToTime(total)) : `${total}s`) : "0s"
    const isTranslated = !!layoutSlides.find(
        (a) =>
            a?.id &&
            _show()
                .slides([a.id])
                .get("items")
                ?.flat()
                ?.find((item) => item?.language)
    )

    const profile = getAccess("shows")
    const isLocked = !!currentShow.locked || profile.global === "read" || profile[currentShow.category || ""] === "read"

    const reference = currentShow.reference
    const referenceType = currentShow?.reference?.type
    const multipleLayouts = sortedLayouts.length > 1

    const customActionId = currentShow?.settings?.customAction
    const customAction = customActionId && currentActions[customActionId] ? customActionId : ""
    const customActionData = customAction ? currentActions[customAction] : null

    const changeColumns = (columns: number) => slidesOptions.set({ ...get(slidesOptions), columns })

    function addLayout(detail: ButtonClickDetail) {
        if (!detail.ctrl) {
            duplicate({ id: "layout" })
            return
        }
        history({ id: "UPDATE", newData: { key: "layouts", subkey: uid() }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    }

    function changeName(detail: HiddenInputEdit) {
        const currentLayout = detail.id.slice("layout_".length)
        if (!currentLayout || isLocked) return

        history({
            id: "UPDATE",
            newData: { key: "layouts", keys: [currentLayout], subkey: "name", data: detail.value },
            oldData: { id: showId },
            location: { page: "show", id: "show_key" }
        })

        const showIndex = currentActiveShow?.index
        if (project?.shows?.[showIndex ?? -1]?.layout === currentLayout) {
            store.update((a) => {
                if (a[projectId || ""]?.shows?.[showIndex || 0]) {
                    a[projectId || ""].shows[showIndex || 0].layoutInfo = { name: detail.value }
                }
                return a
            })
        }
    }

    function setLayout(id: string, layoutInfo: { name?: string }) {
        if (!currentShowsCache[showId]) return

        showsCache.update((a) => {
            if (a[showId]) {
                if (!a[showId].settings) a[showId].settings = { activeLayout: "", template: null }
                a[showId].settings!.activeLayout = id
            }
            return a
        })

        if (sortedLayouts.length < 2) return
        const showIndex = currentActiveShow?.index
        if ((currentActiveShow?.type === undefined || currentActiveShow?.type === "show") && showIndex !== undefined && projectId && project?.shows?.[showIndex]) {
            store.update((a) => {
                if (a[projectId || ""]?.shows?.[showIndex]) {
                    a[projectId || ""].shows[showIndex].layout = id
                    a[projectId || ""].shows[showIndex].layoutInfo = layoutInfo
                }
                return a
            })
        }
    }

    let edit: string | boolean = false

    function runCustomAction(editMode = false) {
        if (editMode || !customAction) {
            activePopup.set("custom_action")
            return
        }
        void runAction(currentActions[customAction], { source: "click" })
    }

    function divider(key: string): ReactNode {
        return <div key={key} className={`divider ${styles.divider}`}></div>
    }

    const topBar =
        referenceType === "lessons" ? null : layoutSlides.length ? (
            <FloatingBar
                arrow={!isLocked}
                menu={
                    <>
                        {Object.keys(currentActions).length && !reference && (!isLocked || customAction) ? (
                            <>
                                <Button title="show.custom_action_tip" onClick={() => runCustomAction(true)}>
                                    <Icon size={1.1} id="actions" white={!customAction} />
                                </Button>
                                {divider("custom")}
                            </>
                        ) : null}
                        <Button onClick={() => activePopup.set("translate")} title="popup.translate">
                            <Icon size={1.1} id="translate" white={!isTranslated} />
                        </Button>
                    </>
                }
            >
                {(open: boolean) => (
                    <>
                        {!open && customAction && customActionData ? (
                            <>
                                <Button style={{ aspectRatio: "unset" }} className="context #edit_custom_action" title={`actions.run_action: ${customActionData.name}`} onClick={() => runCustomAction()}>
                                    <Icon size={1.1} id={getActionIcon(customAction)} />
                                    <p>{customActionData.name as string}</p>
                                </Button>
                                {divider("run")}
                            </>
                        ) : null}

                        {isLocked ? (
                            <Button
                                title="show.locked"
                                onClick={() => {
                                    alertMessage.set(`${translateText(currentShow?.locked ? "show.locked" : "profile.locked")}<br><br>Unlock it by clicking the three dots in the top right corner.`)
                                    activePopup.set("alert")
                                }}
                            >
                                <Icon size={1.1} id="locked" />
                            </Button>
                        ) : (
                            <>
                                {!open && (isTranslated || referenceType === "scripture") ? (
                                    <Button onClick={() => activePopup.set("translate")} title="popup.translate">
                                        <Icon size={1.1} id="translate" white={!isTranslated} />
                                    </Button>
                                ) : null}
                                {open || totalTime !== "0s" || referenceType !== "scripture" ? (
                                    <Button title={`popup.next_timer${totalTime !== "0s" ? `: ${totalTime}` : ""} [Ctrl+Shift+D]`} onClick={() => activePopup.set("next_timer")}>
                                        <Icon size={1.1} id="clock" white={totalTime === "0s"} />
                                    </Button>
                                ) : null}
                            </>
                        )}

                        {open ? divider("open") : null}

                        <ZoomControl hidden={!open} columns={currentSlidesOptions.columns} onChange={changeColumns} />

                        <Button className="context #slideViews" title={`show.change_view: show.${currentSlidesOptions.mode} [Ctrl+Shift+V]`} onClick={changeSlidesView}>
                            <Icon size={1.3} id={currentSlidesOptions.mode} white={currentSlidesOptions.mode === "grid"} />
                        </Button>
                    </>
                )}
            </FloatingBar>
        ) : null

    return (
        <>
            {referenceType === "lessons" ? <ZoomControl hidden columns={currentSlidesOptions.columns} onChange={changeColumns} /> : topBar}

            {currentSlidesOptions.mode !== "simple" ? (
                <FloatingBar style={{ maxWidth: `${referenceType ? 90 : 70}%` } as CSSProperties} side="left" onlyOne={!reference && !multipleLayouts}>
                    {reference ? (
                        <Reference showId={showId} show={currentShow} />
                    ) : layouts ? (
                        <>
                            {multipleLayouts ? (
                                <span className={styles.layouts}>
                                    {sortedLayouts.map((layout) => (
                                        <SelectElem key={layout.id} id="layout" data={layout.id} fill={!edit || edit === layout.id}>
                                            <Button
                                                className={isLocked ? "" : "context #layout"}
                                                onClick={() => {
                                                    if (!edit) setLayout(layout.id, { name: layout.name })
                                                }}
                                                isActive={activeLayout === layout.id}
                                            >
                                                <HiddenInput value={layout.name || ""} id={`layout_${layout.id}`} onEdit={changeName} edit={edit} onEditChange={(value) => (edit = value)} allowEdit={!isLocked} />
                                            </Button>
                                        </SelectElem>
                                    ))}
                                </span>
                            ) : null}

                            <Button disabled={!layoutSlides.length || isLocked || !layoutSlides?.some((a) => a && currentShow?.slides?.[a.id]?.group && currentShow?.slides?.[a.id]?.group !== ".")} onClick={addLayout} style={{ whiteSpace: "nowrap" }} title="show.new_arrangement" align="center">
                                <Icon id="add" size={1.1} white={multipleLayouts} />
                                {!multipleLayouts && !currentLabelsDisabled ? <T id="show.new_arrangement" /> : null}
                            </Button>
                        </>
                    ) : null}
                </FloatingBar>
            ) : null}
        </>
    )
}

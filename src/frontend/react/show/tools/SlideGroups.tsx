import { useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react"
import { uid } from "uid"
import { activePopup, activeShow, alertMessage, cachedShowsData, fullColors, globalGroupViewEnabled, groups, selected, showsCache, templates } from "../../../stores"
import { createKeydownHandler } from "../../helpers/triggerClickOnEnterSpace"
import { newToast } from "../../../utils/common"
import { translateText } from "../../../utils/language"
import { getAccess, isGroupHidden } from "../../../utils/profile"
import { sortByName } from "../../../components/helpers/array"
import { hexToRgb } from "../../../components/helpers/color"
import { ondrop } from "../../../components/helpers/drop"
import { history } from "../../../components/helpers/history"
import { _show } from "../../../components/helpers/shows"
import { getDuplicateGroups, getSlideGroups, mergeDuplicateGroups } from "../../../components/show/tools/groups"
import { T } from "../../helpers/T"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { Button } from "../../ui/button/Button"
import { Center } from "../../system/Center"
import { SelectElem } from "../../system/SelectElem"
import styles from "./SlideGroups.module.css"

interface DisplayGroup {
    id: string
    group: string
    color?: string | null
    locked?: boolean
    globalGroup?: string
    shortcut?: string
}

interface LayoutSlide {
    id?: string
}

interface GlobalGroupSetting {
    name?: string
    default?: boolean
    color?: string
    template?: string
    shortcut?: string
}

// Port de components/show/tools/SlideGroups.svelte (F24.20a).
export function SlideGroups() {
    const currentActiveShow = useStore(activeShow)
    const currentCachedShowsData = useStore(cachedShowsData)
    const currentFullColors = useStore(fullColors)
    const currentGlobalGroupViewEnabled = useStore(globalGroupViewEnabled)
    const currentGroups = useStore(groups) as unknown as Record<string, GlobalGroupSetting>
    const currentShowsCache = useStore(showsCache)
    const currentTemplates = useStore(templates) as unknown as Record<string, { name?: string }>

    const showId = currentActiveShow?.id || ""
    const allShowGroups = getSlideGroups(showId, currentShowsCache, currentCachedShowsData) as DisplayGroup[]
    const showGroups = allShowGroups.filter((group) => group.group !== ".")
    const currentShow = currentShowsCache[showId] as unknown as { locked?: boolean; category?: string; slides?: Record<string, unknown>; layouts?: Record<string, { slides?: LayoutSlide[] }> } | undefined
    const duplicateGroups = getDuplicateGroups(currentShow?.slides as Record<string, never> | undefined, showGroups)
    const activeLayout = currentShow ? _show().get("settings.activeLayout") : ""
    const layoutSlides = currentShow?.layouts?.[activeLayout]?.slides || []

    const globalGroups: DisplayGroup[] = Object.entries(currentGroups)
        .filter(([id]) => !isGroupHidden(id))
        .map(([id, group]) => ({
            id,
            group: group.default ? translateText(`groups.${group.name}`) : group.name || "",
            color: group.color || null,
            globalGroup: id,
            shortcut: group.shortcut
        }))
    const sortedGroups = sortByName(globalGroups, "group") as DisplayGroup[]

    const profile = getAccess("shows")
    const isLocked = !!currentShow?.locked || profile.global === "read" || profile[currentShow?.category || ""] === "read"
    const [displayGlobalGroups, setDisplayGlobalGroups] = useState(currentGlobalGroupViewEnabled)

    useEffect(() => {
        if (showId) setDisplayGlobalGroups(!allShowGroups.length || currentGlobalGroupViewEnabled)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showId, currentGlobalGroupViewEnabled, allShowGroups.length])

    function countGroupsInLayout(slideId: string) {
        return layoutSlides.reduce((count, slide) => (slide.id === slideId ? count + 1 : count), 0)
    }

    function notifyLocked() {
        alertMessage.set(currentShow?.locked ? "show.locked" : "profile.locked")
        activePopup.set("alert")
    }

    function selectGroup(group: DisplayGroup, event: ReactMouseEvent | KeyboardEvent) {
        if (isLocked) return notifyLocked()
        if (group.locked) return newToast("output.state_locked")
        if (event.ctrlKey || event.metaKey) return
        selected.set({ id: "group", data: [{ id: group.id }] })
        ondrop(null, "slide")
        selected.set({ id: null, data: [] })
    }

    function addGlobalGroup(group: DisplayGroup, event: ReactMouseEvent | KeyboardEvent) {
        if (isLocked) return notifyLocked()
        if (event.ctrlKey || event.metaKey || !currentActiveShow) return
        history({ id: "SLIDES", newData: { data: [{ ...group, id: uid() }] } })
    }

    function groupStyle(group: DisplayGroup, local: boolean): CSSProperties {
        const rgb = hexToRgb(group.color || "")
        const isBlack = rgb.r < 30 && rgb.g < 30 && rgb.b < 30
        return { borderBottom: `2px solid ${group.color}`, ...(currentFullColors || (local && isBlack) ? {} : { color: group.color || undefined }) }
    }

    return (
        <div className={styles.groups}>
            <div className={styles.groupsScroll}>
                <div className={styles.main} style={{ height: showGroups.length ? undefined : "100%", width: displayGlobalGroups ? "50%" : undefined }}>
                    {displayGlobalGroups ? (
                        <h4>
                            <T id="groups.current" />
                        </h4>
                    ) : null}
                    {showGroups.length ? (
                        showGroups.map((slide) => {
                            const groupCount = countGroupsInLayout(slide.id)
                            const groupInfo = currentGroups[slide.globalGroup || ""]
                            return (
                                <SelectElem key={slide.id} id="group" data={{ id: slide.id } as never} draggable={!isLocked && !slide.locked}>
                                    <div className={`slide ${isLocked ? "" : "context #group"}`} role="button" tabIndex={0} style={groupStyle(slide, true)} onClick={(event) => selectGroup(slide, event)} onKeyDown={createKeydownHandler((event) => selectGroup(slide, event.nativeEvent))}>
                                        <p data-title={slide.group}>
                                            {slide.locked ? (
                                                <span className="info template" data-title={translateText("output.state_locked")}>
                                                    <Icon id="lock" size={0.7} white />
                                                </span>
                                            ) : groupInfo?.template ? (
                                                <span className="info template" data-title={`${translateText("groups.group_template")}: <b>${currentTemplates[groupInfo.template || ""]?.name || ""}</b>`}>
                                                    <Icon id="templates" size={0.7} white />
                                                </span>
                                            ) : displayGlobalGroups && currentGroups[slide.globalGroup || ""] ? (
                                                <span className="info template" data-title={translateText("groups.global")}>
                                                    <Icon id="bind" size={0.6} white />
                                                </span>
                                            ) : null}
                                            {slide.group === "." ? "" : slide.group || "—"}
                                            {groupCount > 1 ? (
                                                <span className="info shortcut" style={{ opacity: 0.5, fontStyle: "initial" }}>
                                                    {groupCount}
                                                </span>
                                            ) : null}
                                        </p>
                                    </div>
                                </SelectElem>
                            )
                        })
                    ) : (
                        <Center faded>
                            <T id="empty.groups" />
                        </Center>
                    )}
                </div>

                {displayGlobalGroups ? (
                    <>
                        <div className={styles.separator} />
                        <div className={styles.main} style={{ width: "50%" }}>
                            <h4>
                                <T id="groups.global" />
                            </h4>
                            {sortedGroups.length ? (
                                sortedGroups.map((slide) => (
                                    <SelectElem key={slide.id} id="global_group" data={{ slide } as never} draggable>
                                        <div className="slide context #global_group" role="button" tabIndex={0} style={groupStyle(slide, false)} onClick={(event) => addGlobalGroup(slide, event)} onKeyDown={createKeydownHandler((event) => addGlobalGroup(slide, event.nativeEvent))}>
                                            <p data-title={slide.group}>
                                                {currentGroups[slide.id]?.template ? (
                                                    <span className="info template" data-title={`${translateText("groups.group_template")}: <b>${currentTemplates[currentGroups[slide.id].template || ""]?.name || ""}</b>`}>
                                                        <Icon id="templates" size={0.7} white />
                                                    </span>
                                                ) : null}
                                                {slide.group === "." ? "" : slide.group || "—"}
                                                {currentGroups[slide.id]?.shortcut ? <span className="info shortcut">{currentGroups[slide.id].shortcut}</span> : null}
                                            </p>
                                        </div>
                                    </SelectElem>
                                ))
                            ) : (
                                <Center faded>
                                    <T id="empty.groups" />
                                </Center>
                            )}
                        </div>
                    </>
                ) : null}
            </div>

            <FloatingBar round={!(!isLocked && duplicateGroups.length)}>
                {!isLocked && duplicateGroups.length ? (
                    <>
                        <Button title="groups.merge_duplicated_groups" onClick={() => mergeDuplicateGroups(showId, duplicateGroups)}>
                            <Icon id="autofill" />
                            <T id="groups.merge_duplicated_groups" />
                        </Button>
                        <div className="divider" />
                    </>
                ) : null}
                <Button isActive={displayGlobalGroups} title="groups.toggle_global_group" onClick={() => globalGroupViewEnabled.set(!currentGlobalGroupViewEnabled)}>
                    <Icon style={displayGlobalGroups ? undefined : { opacity: 0.8 }} id="groups" white={!displayGlobalGroups} />
                </Button>
            </FloatingBar>
        </div>
    )
}

// @ts-nocheck
import { useEffect, useMemo, useState } from "react"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { cameraManager } from "../../../media/cameraManager"
import {
    actions,
    activeEdit,
    activePage,
    activeProject,
    activeRecording,
    activeShow,
    categories,
    colorbars,
    contextData,
    dictionary,
    disabledServers,
    effects,
    effectsLibrary,
    events,
    forceClock,
    globalTags,
    livePrepare,
    media,
    mediaFolders,
    os,
    outputs,
    overlayCategories,
    overlays,
    projects,
    redoHistory,
    scenes,
    scriptures,
    selected,
    shows,
    showsCache,
    slideDeleteHighlight,
    slidesOptions,
    special,
    spellcheck,
    stageShows,
    styles as styleDefinitions,
    templateCategories,
    timers,
    topContextActive,
    undoHistory
} from "../../core/stores"
import { translateText } from "../../utils/language"
import { closeContextMenu } from "../../../app/wiring/shortcuts"
import { keysToID } from "../../utils/helpers/array"
import { isSettingsDisabled } from "../../../components/settings/openSettings"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { getExtension, getMediaType } from "../../utils/helpers/media"
import { getLayoutRef, getSlideHighlightIndexes } from "../../utils/helpers/show"
import { _show } from "../../utils/helpers/shows"
import { type ContextMenuItem, contextMenuItems } from "./logic/contextMenus"
import { menuClick } from "./logic/menuClick"
import { useStore } from "../hooks/useStore"
import styles from "./ContextItem.module.css"

export interface ContextItemProps {
    contextElem: HTMLDivElement | null
    topBar?: boolean
    id: string
    menu?: ContextMenuItem
    disabled?: boolean
    highlighted?: boolean
    group?: boolean
}

function isNotMultiGroupSlide(data: Array<{ index: number }>, unique = false, activeShowId?: string, cache?: Record<string, unknown>) {
    if (!Array.isArray(data)) return false

    const ref = getLayoutRef()
    const getParentId = (index: number) => ref[index]?.parent?.id || ref[index]?.id

    if (unique && data.length > 1) {
        const firstGroupId = getParentId(data[0].index)
        if (!data.every(({ index }) => getParentId(index) === firstGroupId)) return true
    }

    return data.every(({ index }) => {
        const currentSlideId = getParentId(index)
        if (!currentSlideId) return true

        const show = (cache || {})[activeShowId || ""]

        const isParent = ref[index]?.type === "parent"
        if (!unique && isParent && (show?.slides?.[currentSlideId]?.children || []).length) {
            return show.slides[currentSlideId].group === "."
        }

        const currentSlideInstances = Object.values(show?.layouts || {})
            .map((a: unknown) => a.slides)
            .flat()
            .filter((b: unknown) => b?.id === currentSlideId)

        return currentSlideInstances.length < 2
    })
}

export function ContextItem({ contextElem, topBar = false, id, menu: menuProp, disabled: disabledProp = false, highlighted = false, group = false }: ContextItemProps) {
    const sel = useStore(selected) as unknown as never
    const dict = useStore(dictionary)
    const osStore = useStore(os) as unknown as never
    const showsStore = useStore(shows) as unknown as never
    const showsCacheStore = useStore(showsCache) as unknown as never
    const activeShowStore = useStore(activeShow) as unknown as never
    const activeEditStore = useStore(activeEdit) as unknown as never
    const activePageStore = useStore(activePage) as unknown as never
    const activeProjectStore = useStore(activeProject) as unknown as never
    const projectsStore = useStore(projects) as unknown as never
    const outputsStore = useStore(outputs) as unknown as never
    const stageShowsStore = useStore(stageShows) as unknown as never
    const stylesStore = useStore(styleDefinitions) as unknown as never
    const contextDataStore = useStore(contextData) as unknown as never
    const undoHistoryStore = useStore(undoHistory) as unknown as never[]
    const redoHistoryStore = useStore(redoHistory) as unknown as never[]
    const globalTagsStore = useStore(globalTags) as unknown as never
    const specialStore = useStore(special) as unknown as never
    const spellcheckStore = useStore(spellcheck) as unknown as never
    const disabledServersStore = useStore(disabledServers) as unknown as never
    const effectsStore = useStore(effects) as unknown as never
    const scenesStore = useStore(scenes) as unknown as never
    const timersStore = useStore(timers) as unknown as never
    const actionsStore = useStore(actions) as unknown as never
    const slidesOptionsStore = useStore(slidesOptions) as unknown as never
    const eventsStore = useStore(events) as unknown as never
    const mediaStore = useStore(media) as unknown as never
    const effectsLibraryStore = useStore(effectsLibrary) as unknown as never[]
    const overlaysStore = useStore(overlays) as unknown as never
    const colorbarsStore = useStore(colorbars) as unknown as never
    const livePrepareStore = useStore(livePrepare) as unknown as never
    const forceClockStore = useStore(forceClock) as unknown as never
    const activeRecordingStore = useStore(activeRecording) as unknown as never
    const categoriesStore = useStore(categories) as unknown as never
    const overlayCategoriesStore = useStore(overlayCategories) as unknown as never
    const templateCategoriesStore = useStore(templateCategories) as unknown as never
    const mediaFoldersStore = useStore(mediaFolders) as unknown as never
    const scripturesStore = useStore(scriptures) as unknown as never

    const baseMenu = menuProp || (contextMenuItems as Record<string, ContextMenuItem>)[id]
    const [enabledState, setEnabledState] = useState<boolean>(baseMenu?.enabled ? true : false)

    const derived = useMemo(() => {
        let disabled = disabledProp
        let hide = false
        let enabled: boolean = baseMenu?.enabled ? true : false
        let customTitle = ""
        const menu: ContextMenuItem = baseMenu ? { ...baseMenu } : ({ label: id } as ContextMenuItem)

        const conditions: Record<string, () => void> = {
            settings: () => {
                disabled = isSettingsDisabled()
            },
            view_grid: () => {
                if (slidesOptionsStore.mode === "grid") enabled = true
            },
            view_simple: () => {
                if (slidesOptionsStore.mode === "simple") enabled = true
            },
            view_groups: () => {
                if (slidesOptionsStore.mode === "groups") enabled = true
            },
            view_list: () => {
                if (slidesOptionsStore.mode === "list") enabled = true
            },
            view_lyrics: () => {
                if (slidesOptionsStore.mode === "lyrics") enabled = true
            },
            rename: () => {
                if (sel?.id === "show" || sel?.id === "show_drawer") {
                    disabled = !!showsStore[sel.data?.[0]?.id]?.locked
                }
            },
            delete: () => {
                if (sel?.id === "show" || sel?.id === "show_drawer") {
                    hide = !!sel.data?.length && sel.data?.every((a: unknown) => !!showsStore[a?.id]?.locked)
                }
            },
            private: () => {
                const show = showsStore[sel?.data?.[0]?.id]
                if (!show) return
                enabled = !!show.private
                disabled = !!(!enabled && show.locked)
            },
            use_as_archive: () => {
                const categoryStores: Record<string, () => any> = {
                    category_shows: () => categoriesStore,
                    category_overlays: () => overlayCategoriesStore,
                    category_templates: () => templateCategoriesStore
                }
                const isArchive = !!categoryStores[sel?.id || ""]?.()?.[sel?.data?.[0]]?.isArchive
                enabled = isArchive
            },
            archive: () => {
                const projectId = sel?.data?.[0]?.id
                const project = projectsStore[projectId]
                enabled = !!project?.archived
            },
            edit: () => {
                if (sel?.id !== "show_drawer" || !showsStore[sel?.data?.[0]?.id]?.locked) return
                disabled = !!showsStore[sel?.data?.[0]?.id]?.locked
            },
            change_style: () => {
                const outputId = contextElem?.id || ""
                const styleId = outputsStore[outputId]?.style || ""
                const stageId = outputsStore[outputId]?.stageOutput || ""

                if (stageId) {
                    menu.label = "stage.stage_layout"
                    menu.icon = "stage"
                    if (!stageShowsStore[stageId]) disabled = true
                    menu.label += `: ${stageId ? (stageShowsStore[stageId] ? stageShowsStore[stageId].name || "main.unnamed" : "error.not_found") : "main.none"}`
                    return
                }

                menu.label = "edit.style"
                menu.icon = "styles"
                menu.label += `: ${styleId ? (stylesStore[styleId] ? stylesStore[styleId].name || "main.unnamed" : "error.not_found") : "main.none"}`
            },
            edit_style: () => {
                const outputId = contextElem?.id || ""
                const styleId = outputsStore[outputId]?.style || ""
                const stageId = outputsStore[outputId]?.stageOutput || ""

                if (stageId) {
                    menu.label = "menu.edit"
                    if (!stageShowsStore[stageId]) disabled = true
                    menu.label += `: ${stageId ? (stageShowsStore[stageId] ? stageShowsStore[stageId].name || "main.unnamed" : "error.not_found") : "main.none"}`
                    return
                }

                menu.label = "menu.edit"
                if (!stylesStore[styleId]) disabled = true
                menu.label += `: ${styleId ? (stylesStore[styleId] ? stylesStore[styleId].name || "main.unnamed" : "error.not_found") : "main.none"}`
            },
            lock_group: () => {
                if (sel?.id !== "group") return
                const slideId = sel?.data?.[0]?.id
                const show = showsCacheStore[activeShowStore?.id || ""]
                const isLocked = show?.slides?.[slideId]?.locked || false
                enabled = isLocked
            },
            disable: () => {
                let isEnabled = false
                if (sel?.id === "slide" && activeShowStore) {
                    const ref = getLayoutRef()
                    isEnabled = ref[sel.data[0]?.index]?.data?.disabled || false
                } else if (sel?.id === "stage") {
                    isEnabled = stageShowsStore[sel.data[0]?.id]?.disabled || false
                } else if (sel?.id === "action") {
                    const action = actionsStore[sel.data[0]?.id] || {}
                    if (!action.customActivation) hide = true
                    else isEnabled = action.enabled === false
                }
                enabled = isEnabled
                menu.label = isEnabled ? "actions.enable" : "actions.disable"
            },
            hide: () => {
                let isHidden = false
                if (contextElem?.classList.value.includes("#effect_item")) {
                    const effectId = activeEditStore?.id || ""
                    const effect = effectsStore[effectId]
                    const idxStr = (contextElem as HTMLElement | null)?.dataset?.index ?? contextElem?.id?.replace(/^#/, "")
                    const index = idxStr !== undefined ? Number(idxStr) : -1
                    if (index >= 0 && effect?.items?.[index]?.hidden) isHidden = true
                } else if (contextElem?.classList.value.includes("#scene_overlay")) {
                    const sceneId = activeEditStore?.id || ""
                    const scene = scenesStore[sceneId]
                    const overlayId = (contextElem as HTMLElement | null)?.dataset?.overlayId || sel?.data?.[0]?.id || ""
                    if (overlayId && scene?.content?.hiddenOverlays?.includes(overlayId)) isHidden = true
                }
                enabled = isHidden
                menu.label = isHidden ? "profile.show" : "profile.hide"
            },
            display_tags: () => {
                enabled = !!specialStore.displayTags
                hide = !Object.keys(globalTagsStore || {}).length
            },
            move_connections: () => {
                hide = disabledServersStore?.stage === true
            },
            slide_transition: () => {
                if (sel?.id === "slide" && activeShowStore) {
                    const ref = getLayoutRef()
                    enabled = !!(ref[sel.data[0]?.index]?.data?.transition || false)
                }
            },
            transition: () => {
                if (activeShowStore && showsCacheStore[activeShowStore.id] && activeEditStore?.items?.length) {
                    const ref = getLayoutRef()
                    const slideId = ref[activeEditStore.slide || 0]?.id
                    const item = showsCacheStore[activeShowStore.id].slides?.[slideId]?.items?.[activeEditStore.items[0]] || {}
                    enabled = !!item.actions?.transition
                }
            },
            make_unique: () => {
                if (sel?.id !== "slide" || !sel?.data?.length) return
                hide = isNotMultiGroupSlide(sel.data, true, activeShowStore?.id, showsCacheStore)
            },
            remove_group: () => {
                if (sel?.id !== "slide" || !sel?.data?.length) return
                hide = isNotMultiGroupSlide(sel.data, false, activeShowStore?.id, showsCacheStore)
            },
            remove: () => {
                if (sel?.id !== "show" || _show(sel.data[0]?.id).get("private") !== true) return
                disabled = true
            },
            undo: () => {
                if (!undoHistoryStore?.length) disabled = true
            },
            redo: () => {
                if (!redoHistoryStore?.length) disabled = true
            },
            text_copy: () => {
                if (!window.getSelection()?.toString()) hide = true
            },
            text_cut: () => {
                if (!window.getSelection()?.toString()) hide = true
            },
            text_paste: () => {
                setTimeout(() => {
                    if (spellcheckStore?.suggestions) hide = true
                }, 20)
            },
            text_select_all: () => {
                setTimeout(() => {
                    if (spellcheckStore?.suggestions) hide = true
                }, 20)
            },
            insert_virtual_break: () => {
                if (window.getSelection()?.toString() || (activeEditStore?.type || "show") !== "show" || activePageStore !== "edit") hide = true
            },
            createSlideshow: () => {
                hide = sel?.id !== "media" || (sel?.data?.length || 0) < 2
            },
            play: () => {
                if (sel?.id === "global_timer") {
                    const timer = timersStore[sel.data[0]?.id]
                    if (timer?.type !== "counter") disabled = true
                }
            },
            play_no_audio: () => {
                const path = sel?.data?.[0]?.path || sel?.data?.[0]?.id
                const type = getMediaType(getExtension(path))
                if (type !== "video") hide = true
            },
            play_no_filters: () => {
                const path = sel?.data?.[0]?.path || sel?.data?.[0]?.id
                if (!path || !mediaStore[path]?.filter) disabled = true
            },
            delete_all: () => {
                if (!contextElem?.classList.value.includes("#event")) return
                const eventId = contextElem?.id
                if (!eventId) return
                const groupId = eventsStore[eventId]?.group
                if (groupId && Object.entries(eventsStore).find(([eid, event]: unknown) => eid !== eventId && event.group === groupId)) return
                disabled = true
            },
            favourite: () => {
                if (sel?.id?.includes("category_scripture")) {
                    const scriptId = sel.data[0]
                    enabled = !!scripturesStore[scriptId]?.favorite
                } else {
                    const path = sel?.data?.[0]?.path || sel?.data?.[0]?.id
                    enabled = !!mediaStore[path]?.favourite
                }
            },
            effects_library_add: () => {
                const path = sel?.data?.[0]?.path || sel?.data?.[0]?.id
                if (path) {
                    const duration = AudioPlayer.getDurationSync(path)
                    const isEffect = AudioPlayer.getAudioType(path, duration) === "effect"
                    if (!isEffect) {
                        hide = true
                        return
                    }
                }
                const existing = (effectsLibraryStore || []).find((a: unknown) => a.path === path)
                enabled = !!(path && existing)
                menu.label = enabled ? "media.effects_library_remove" : "media.effects_library_add"
            },
            startup_activate: () => {
                const startupCameras = cameraManager.getStartupCameras()
                const camId = sel?.data?.[0]?.id
                enabled = !!(camId && startupCameras.includes(camId))
            },
            lock_to_output: () => {
                const overlayId = sel?.data?.[0]
                if (overlaysStore[overlayId]?.displayDuration) disabled = true
                else if (overlaysStore[overlayId]?.locked) enabled = true
            },
            display_duration: () => {
                // subTab not critical; approximate by checking selected stores
                const overlayId = sel?.data?.[0]
                if (effectsStore[overlayId]?.displayDuration) enabled = true
                else if (overlaysStore[overlayId]?.locked) disabled = true
                else if (overlaysStore[overlayId]?.displayDuration) enabled = true
            },
            toggle_output: () => {
                const outputId = contextElem?.id || ""
                disabled = !!outputsStore[outputId]?.invisible
            },
            move_to_front: () => {
                const previewOutputs = keysToID(outputsStore).filter((a: unknown) => a.enabled)
                if (previewOutputs.length !== 2) {
                    disabled = false
                    return
                }
                const outputId = contextElem?.id || ""
                if (outputsStore[outputId]?.invisible) {
                    disabled = true
                    return
                }
                const alwaysOnTopState = [...new Set(previewOutputs.map((out: unknown) => out?.alwaysOnTop ?? true))]
                disabled = alwaysOnTopState.length === previewOutputs.length
            },
            hide_from_preview: () => {
                const outputId = contextElem?.id || ""
                const isEnabled = !!outputsStore[outputId]?.hideFromPreview
                enabled = isEnabled
                menu.label = isEnabled ? "context.enable_preview" : "context.hide_from_preview"
            },
            test_pattern: () => {
                const outputId = contextElem?.id || ""
                enabled = !!colorbarsStore[outputId]
            },
            live_prepare: () => {
                const outputId = contextElem?.id || ""
                enabled = !!livePrepareStore[outputId]
            },
            place_under_slide: () => {
                const overlayId = sel?.data?.[0]
                if (overlaysStore[overlayId]?.placeUnderSlide || effectsStore[overlayId]?.placeUnderSlide) enabled = true
            },
            toggle_clock: () => {
                if (forceClockStore) enabled = true
            },
            recording: () => {
                if (activeRecordingStore) {
                    menu.label = "actions.stop_recording"
                    menu.icon = "stop"
                } else {
                    menu.label = "actions.start_recording"
                    menu.icon = "record"
                }
            },
            mark_played: () => {
                const projectId = activeProjectStore
                const index = sel?.data?.[0]?.index
                if (!projectId || index === undefined) return
                const show = projectsStore[projectId]?.shows?.[index]
                const isPlayed = !!show?.played
                menu.label = `actions.mark_${isPlayed ? "not_" : ""}played`
                menu.icon = isPlayed ? "remove" : "check"
                menu.iconColor = isPlayed ? "var(--secondary)" : "var(--text)"
                enabled = isPlayed
            },
            category_action: () => {
                const categoryId = sel?.data?.[0]
                enabled = !!categoriesStore[categoryId]?.action
            },
            category_template: () => {
                const categoryId = sel?.data?.[0]
                enabled = !!categoriesStore[categoryId]?.template
            },
            metadata_display: () => {
                const categoryId = sel?.data?.[0]
                enabled = !!categoriesStore[categoryId]?.metadata
            },
            type_default: () => {
                const folderId = sel?.data?.[0]
                if (!folderId) return
                const folder = mediaFoldersStore[folderId]
                enabled = !folder?.mediaType
            },
            type_background: () => {
                const folderId = sel?.data?.[0]
                if (!folderId) return
                const folder = mediaFoldersStore[folderId]
                enabled = folder?.mediaType === "background"
            },
            type_foreground: () => {
                const folderId = sel?.data?.[0]
                if (!folderId) return
                const folder = mediaFoldersStore[folderId]
                enabled = folder?.mediaType === "foreground"
            }
        }

        if (conditions[id]) conditions[id]()

        return { disabled, hide, enabled, customTitle, menu }
    }, [
        baseMenu,
        disabledProp,
        id,
        contextElem,
        sel,
        showsStore,
        showsCacheStore,
        activeShowStore,
        activeEditStore,
        activePageStore,
        activeProjectStore,
        projectsStore,
        outputsStore,
        stageShowsStore,
        stylesStore,
        contextDataStore,
        undoHistoryStore,
        redoHistoryStore,
        globalTagsStore,
        specialStore,
        spellcheckStore,
        disabledServersStore,
        effectsStore,
        scenesStore,
        timersStore,
        actionsStore,
        slidesOptionsStore,
        eventsStore,
        mediaStore,
        effectsLibraryStore,
        overlaysStore,
        colorbarsStore,
        livePrepareStore,
        forceClockStore,
        activeRecordingStore,
        categoriesStore,
        overlayCategoriesStore,
        templateCategoriesStore,
        mediaFoldersStore,
        scripturesStore
    ])

    useEffect(() => {
        setEnabledState(derived.enabled)
    }, [derived.enabled])

    useEffect(() => {
        if (!highlighted || derived.disabled || derived.hide) {
            if (id === "remove_group" || id === "delete_slide" || id === "delete_group" || id === "delete") {
                slideDeleteHighlight.set(null)
            }
            return
        }
        if (id === "remove_group" || id === "delete_slide" || id === "delete_group" || (id === "delete" && sel?.id === "slide")) {
            const indexes = getSlideHighlightIndexes(id, sel)
            const color = derived.menu?.iconColor || derived.menu?.color || "#ff5454"
            const icon = id.includes("remove") ? "remove" : derived.menu?.icon || "delete"
            slideDeleteHighlight.set(indexes.length ? { indexes, color, icon } : null)
        }
    }, [highlighted, derived.disabled, derived.hide, derived.menu?.iconColor, derived.menu?.color, derived.menu?.icon, id, sel])

    function getShortcuts(shortcuts: string[] | undefined) {
        if (!shortcuts?.length) return ""
        let s = shortcuts[0]
        if ((osStore as unknown as never)?.platform === "darwin") s = s.replaceAll("Ctrl", "Cmd").replaceAll("Alt", "Option")
        return s
    }

    const shortcut = getShortcuts(derived.menu?.shortcuts)
    const customStyle = id === "uppercase" ? "text-transform: uppercase;" : id === "lowercase" ? "text-transform: lowercase;" : ""

    function contextItemClick() {
        if (derived.disabled) return

        slideDeleteHighlight.set(null)

        const actionItem: HTMLElement | null = contextElem?.classList.contains("_" + id) ? contextElem : (contextElem?.querySelector("._" + id) as HTMLElement | null) || null

        menuClick(id, enabledState, derived.menu, contextElem, actionItem, sel)

        const keepOpen = ["uppercase", "lowercase", "capitalize", "trim"]
        if (keepOpen.includes(id)) return
        const keepOpenToggle = [
            "enabled_drawer_tabs",
            "tag_set",
            "tag_filter",
            "media_tag_set",
            "media_tag_filter",
            "player_tag_set",
            "player_tag_filter",
            "action_tag_set",
            "action_tag_filter",
            "variable_tag_set",
            "variable_tag_filter",
            "timer_tag_set",
            "timer_tag_filter",
            "bind_slide",
            "bind_item",
            "bind_effect",
            "bind_scene"
        ]
        if (keepOpenToggle.includes(id)) {
            setEnabledState((e) => !e)
            return
        }

        if (topBar) topContextActive.set(false)
        else closeContextMenu()
    }

    function keydown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            contextItemClick()
        }
    }

    const classes = [styles.item, enabledState ? styles.enabled : "", derived.disabled ? styles.disabled : "", derived.hide ? styles.hide : "", highlighted ? styles.highlighted : "", group ? styles.group : ""].filter(Boolean).join(" ")

    const labelContent =
        derived.menu?.translate === false ? (
            derived.menu?.label ? (
                derived.menu.label
            ) : (
                <span style={{ opacity: 0.5, fontStyle: "italic", pointerEvents: "none" }}>
                    <T id="main.unnamed" />
                </span>
            )
        ) : (
            translateText(derived.menu?.label || id, dict)
        )

    return (
        <div
            onClick={contextItemClick}
            onMouseEnter={() => {
                if (derived.disabled || derived.hide) return
                if (id === "remove_group" || id === "delete_slide" || id === "delete_group" || (id === "delete" && sel?.id === "slide")) {
                    const indexes = getSlideHighlightIndexes(id, sel)
                    const color = derived.menu?.iconColor || derived.menu?.color || "#ff5454"
                    const icon = id.includes("remove") ? "remove" : derived.menu?.icon || "delete"
                    slideDeleteHighlight.set(indexes.length ? { indexes, color, icon } : null)
                }
            }}
            onMouseLeave={() => {
                if (id === "remove_group" || id === "delete_slide" || id === "delete_group" || id === "delete") {
                    slideDeleteHighlight.set(null)
                }
            }}
            className={classes}
            data-title={translateText(derived.menu?.tooltip || "")}
            style={{ color: derived.menu?.color || "unset", fontWeight: derived.menu?.color ? 500 : "normal", ...(derived.menu?.style ? styleFromString(derived.menu.style) : {}) }}
            tabIndex={0}
            onKeyDown={keydown}
            role="menuitem"
        >
            <span className={styles.innerItem} data-title={group && !derived.menu?.tooltip ? `${shortcut}` : derived.customTitle || ""}>
                {derived.menu?.icon ? <Icon style={{ color: "var(--text-muted)" }} id={derived.menu.icon} size={group ? 1.4 : 1} white /> : null}
                {enabledState === true ? <Icon id="check" style={{ fill: "var(--text)" } as unknown as never} size={0.7} white /> : null}
                <p className={styles.text} style={{ display: "flex", alignItems: "center", gap: 5, ...(customStyle ? styleFromString(customStyle) : {}) }}>
                    {labelContent}
                    {derived.menu?.external ? <Icon id="launch" style={{ opacity: 0.8 }} white /> : null}
                </p>
            </span>

            {shortcut && !group ? <span style={{ opacity: 0.4, fontSize: "0.8em" }}>{shortcut}</span> : null}
        </div>
    )
}

function styleFromString(style: string): React.CSSProperties {
    const out: Record<string, string> = {}
    style.split(";").forEach((part) => {
        const [rawKey, ...rest] = part.split(":")
        if (!rawKey || rest.length === 0) return
        const key = rawKey.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        const value = rest.join(":").trim()
        if (key && value) out[key] = value
    })
    return out
}

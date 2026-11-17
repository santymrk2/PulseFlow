import type { CSSProperties } from "react"
import type { SelectIds } from "../../../types/Main"
import { getActionIcon } from "../../components/actions/actions"
import { clone } from "../../components/helpers/array"
import { getFirstActiveOutput } from "../../components/helpers/output"
import { metadataDisplayValues } from "../../components/helpers/show"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { cn } from "../../lib/utils"
import { actions, activeActionTagFilter, activeDrawerTab, activePlaylist, activeTimerTagFilter, activeVariableTagFilter, audioPlaylists, dictionary, drawerTabsData, outputs, templates } from "../../stores"
import { translateText } from "../../utils/language"
import { customIconsColors } from "../../values/customIcons"
import { Button, type ButtonClickDetail } from "../ui/button/Button"
import { HiddenInput, type HiddenInputEdit } from "../ui/hidden-input/HiddenInput"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { SelectElem } from "../system/SelectElem"
import styles from "./DrawerTab.module.css"

// Port de components/drawer/DrawerTab.svelte. `dispatch("rename", {id, value})` → onRename({id, value}).
// `<svelte:self>` → recursión directa. El `id` de SelectElem y las clases `context #…` se conservan.
export interface DrawerTabOption {
    title: string
    icon: string
    style?: string
}

export interface DrawerTabSubmenu {
    options?: DrawerTabCategory[]
}

export interface DrawerTabCategory {
    id: string
    label: string
    icon: string
    option?: null | DrawerTabOption
    action?: string
    template?: string
    metadata?: string
    count?: number
    readOnly?: boolean
    customIcon?: boolean
    boxedIcon?: boolean
    color?: string
    openTrigger?: (id: string, add?: boolean) => void
    onDoubleClick?: () => void
    submenu?: DrawerTabSubmenu
}

export interface DrawerTabProps {
    category: DrawerTabCategory
    parentId?: string
    isSubmenu?: boolean
    active: string
    onRename?: (detail: { id: string; value: string }) => void
}

const DEFAULT_FOLDERS: readonly string[] = ["all", "unlabeled", "number", "favourites", "effects_library", "effects", "online", "inputs", "metronome"]
const TABS_WITH_CATEGORIES: readonly string[] = ["shows", "media", "audio", "overlays", "templates", "scripture"]

// OutSlide no tiene `categoryId` tipado (en el Svelte se casteaba a any): guarda de tipo en un solo lugar.
function slideCategoryId(slide: unknown): string | undefined {
    if (typeof slide !== "object" || slide === null || !("categoryId" in slide)) return undefined
    const value = (slide as { categoryId?: unknown }).categoryId
    return typeof value === "string" ? value : undefined
}

export function DrawerTab({ category, parentId = "", isSubmenu = false, active, onRename }: DrawerTabProps) {
    const dict = useStore(dictionary)
    const actionTagFilter = useStore(activeActionTagFilter)
    const variableTagFilter = useStore(activeVariableTagFilter)
    const timerTagFilter = useStore(activeTimerTagFilter)
    const drawerId = useStore(activeDrawerTab)
    const playlist = useStore(activePlaylist)
    const playlists = useStore(audioPlaylists)
    const tabsData = useStore(drawerTabsData)
    const outputsValue = useStore(outputs)
    const templatesValue = useStore(templates)
    const actionsValue = useStore(actions)

    const id = category.id
    const label = category.label
    const icon = category.icon
    const option = category.option
    const action = category.action || ""
    const template = category.template || ""
    const metadata = category.metadata || ""
    const count = category.count || 0
    const readOnly = category.readOnly || false
    const customIcon = category.customIcon || false
    const boxedIcon = category.boxedIcon || false
    const submenu = category.submenu || {}

    const submenuActive = isSubmenu ? (active === "actions" ? actionTagFilter.includes(id) : active === "variables" ? variableTagFilter.includes(id) : active === "timer" ? timerTagFilter.includes(id) : false) : false
    const isActive = submenuActive || active === id

    const output = getFirstActiveOutput(outputsValue)
    const showOutline = drawerId === "scripture" ? slideCategoryId(output?.out?.slide) === id : drawerId === "audio" ? playlist?.id === id : false

    const selectId = `category_${drawerId}${drawerId === "scripture" ? "___" + icon : ""}` as SelectIds

    const noEdit = !TABS_WITH_CATEGORIES.includes(drawerId) || DEFAULT_FOLDERS.includes(id)
    const contextClass = noEdit ? "" : playlists[id] ? "context #playlist" : `context #category_${drawerId}_button${readOnly ? "_readonly" : ""}`
    const draggable = drawerId === "audio" && !!playlists[id]

    const openedSubmenus = tabsData[drawerId]?.openedSubmenus || []
    const submenuOpened = openedSubmenus.includes(id)

    function click(detail: ButtonClickDetail) {
        const { ctrl, shift } = detail
        if (ctrl) return

        if (category.openTrigger) category.openTrigger(id, shift)
        if (shift) return

        drawerTabsData.update((a) => {
            const next = { ...a }
            next[drawerId] = { ...a[drawerId], activeSubTab: parentId || id }
            if (isSubmenu) next[drawerId].activeSubmenu = id
            else delete next[drawerId].activeSubmenu
            return next
        })
    }

    function dblclick() {
        if (category.onDoubleClick) category.onDoubleClick()
    }

    function rename(detail: HiddenInputEdit) {
        onRename?.({ id, value: detail.value })
    }

    function openSubMenu() {
        drawerTabsData.update((a) => {
            if (!a[drawerId]) return a
            const opened = clone(openedSubmenus)

            const existingIndex = opened.findIndex((menuId) => menuId === id) ?? -1
            if (existingIndex < 0) opened.push(id)
            else {
                opened.splice(existingIndex, 1)
                if (category.openTrigger) category.openTrigger(id)
            }

            const next = { ...a }
            next[drawerId] = { ...a[drawerId], openedSubmenus: opened }
            if (existingIndex >= 0) delete next[drawerId].activeSubmenu
            return next
        })
    }

    const translatedLabel = translateText(label, dict)
    const innerStyle: CSSProperties = { maxWidth: "85%", ...(boxedIcon ? { gap: "9px" } : {}) }

    return (
        <>
            <SelectElem style={{ width: "100%" }} id={selectId} selectable={!noEdit} draggable={draggable} borders="center" trigger="column" data={id} className={styles.div}>
                <div className={cn(styles.div, styles.row)}>
                    <Button className={contextClass} style={{ width: "100%", fontWeight: "normal", padding: `0 ${boxedIcon ? 0.64 : 0.8}em` }} isActive={isActive} showOutline={showOutline} onClick={click} onDblClick={dblclick} tab>
                        <div style={innerStyle} data-title={translatedLabel}>
                            <Icon id={icon} size={isSubmenu ? 0.85 : 1} color={isSubmenu ? category.color : boxedIcon ? customIconsColors[icon] || "" : ""} white custom={customIcon} boxed={isSubmenu || boxedIcon} />

                            {noEdit || isSubmenu ? <p style={{ margin: `${isSubmenu ? 3 : 5}px` }}>{label ? translatedLabel : <span style={{ opacity: 0.5, fontStyle: "italic", pointerEvents: "none" }}>{translateText("main.unnamed", dict)}</span>}</p> : <HiddenInput value={translatedLabel} id={`category_${drawerId}_${id}`} onEdit={rename} />}
                        </div>

                        <div className={cn(styles.div, styles.icons)}>
                            {option ? (
                                <span style={{ padding: "0 2px", ...(option.style ? cssTextToStyle(option.style) : {}) }} data-title={translateText(option.title, dict)}>
                                    <Icon id={option.icon} size={0.8} white />
                                </span>
                            ) : null}
                            {metadata ? (
                                <span style={{ padding: "0 2px" }} data-title={translateText(`tools.metadata: <b>${metadataDisplayValues.find((a) => a.id === metadata)?.name}</b>`, dict)}>
                                    <Icon id="info" size={0.8} white />
                                </span>
                            ) : null}
                            {template && templatesValue[template] ? (
                                <span style={{ padding: "0 2px" }} data-title={translateText(`info.template: <b>${templatesValue[template].name}</b>`, dict)}>
                                    <Icon id="templates" size={0.8} white />
                                </span>
                            ) : null}
                            {action && actionsValue[action] ? (
                                <span style={{ padding: "0 2px" }} data-title={translateText(`popup.action: <b>${actionsValue[action].name}</b>`, dict)}>
                                    <Icon id={getActionIcon(action)} size={0.8} white />
                                </span>
                            ) : null}

                            {count ? (
                                <span className={styles.count} style={translatedLabel.length > 25 ? { minWidth: "10px" } : undefined}>
                                    {count}
                                </span>
                            ) : null}
                        </div>

                        {!isSubmenu && submenu?.options?.length ? (
                            <Button style={{ borderLeft: "1px solid var(--primary-lighter)", padding: "0.8em", position: "absolute", right: 0 }} onClick={openSubMenu}>
                                {submenuOpened ? <Icon id="arrow_down" size={1.4} /> : <Icon id="arrow_right" size={1.4} white />}
                            </Button>
                        ) : null}
                    </Button>
                </div>
            </SelectElem>

            {!isSubmenu && submenuOpened && submenu?.options?.length ? (
                <div className={cn(styles.div, styles.submenus)}>
                    {/* el Svelte no ponía key en el each: se usa la posición */}
                    {submenu.options.map((subOption, index) => (
                        <DrawerTab key={index} parentId={id} category={subOption} active={active} isSubmenu onRename={onRename} />
                    ))}
                </div>
            ) : null}
        </>
    )
}

import { useEffect, useRef, useState } from "react"
import { activeEdit, activePage, activePopup, activeStage, dictionary, selected, stageShows } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { Menu, MenuItem, MenuSeparator } from "../ui/menu"
import { getDynamicIds, replaceDynamicValues } from "../../shared/utils/helpers/showActions"
import { addStageItem } from "../../components/stage/stage"
import { addItem } from "../../components/edit/scripts/itemHelpers"
import { slideItems, stageItems, type AddItem } from "../../components/edit/values/items"
import styles from "./ItemAddMenu.module.css"

export interface ItemAddMenuProps {
    isLocked?: boolean
}

export function ItemAddMenu({ isLocked = false }: ItemAddMenuProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentActivePage = useStore(activePage)
    const currentActiveStage = useStore(activeStage)
    const currentDictionary = useStore(dictionary)
    const currentStageShows = useStore(stageShows)

    const [menuOpen, setMenuOpen] = useState(false)
    const [barWidth, setBarWidth] = useState(0)
    const host = useRef<HTMLDivElement>(null)

    const isStage = currentActivePage === "stage"

    const stageId = currentActiveStage.id || ""
    const stageShow = currentStageShows[stageId]
    const slideTextItemsCount = Object.values(stageShow?.items || {}).filter((a) => (a as { type?: string }).type === "slide_text").length

    const groupedItems = (isStage ? stageItems : slideItems).map((group) => {
        return {
            ...group,
            items: group.items.map((item: AddItem) => {
                if (item.id === "slide_text") {
                    return {
                        ...item,
                        label: slideTextItemsCount === 1 ? "stage.next_slide_text" : "items.slide_text",
                        suffix: slideTextItemsCount > 1 ? ` (+${slideTextItemsCount})` : ""
                    }
                }

                if (item.id === "dynamic_values") {
                    const excludeValues = ["time_", "exif_", "audio_", "meta_", "slide_text_", "show_text_full", "slide_group_text", "slide_group_color", "slide_group_next_color", "slide_group_upcoming_color", "interaction_", "timer_m", "timer_s"]
                    const ref = { type: "stage" }
                    const children = getDynamicIds(false, "dropdown")
                        .filter((id) => !excludeValues.find((v) => id.includes(v)))
                        .map((id) => {
                            const dynamicId = `{${id}}`
                            const value = replaceDynamicValues(dynamicId, ref).slice(0, 30)
                            return {
                                id: dynamicId,
                                label: dynamicId,
                                icon: "",
                                title: `<b>${dynamicId}</b><br>${value}`,
                                data: value
                            }
                        })
                    return { ...item, children }
                }

                return item
            })
        }
    })

    function handleAdd(type: string) {
        setMenuOpen(false)

        if (isStage) {
            if (typeof type === "string" && type.startsWith("{")) {
                addStageItem("text", type)
            } else {
                addStageItem(type)
            }
        } else {
            if (type === "icon") {
                selected.set({ id: "slide_icon", data: [{ ...currentActiveEdit }] })
                activePopup.set("icon")
            } else {
                const textVal = type === "text" && currentActiveEdit.type === "template" ? translateText("example.text", currentDictionary) : ""
                addItem(type as never, null, {}, textVal)
            }
        }
    }

    useEffect(() => {
        const parent = host.current?.parentElement
        if (!parent) return
        const observer = new ResizeObserver(() => setBarWidth(parent.clientWidth))
        observer.observe(parent)
        setBarWidth(parent.clientWidth)
        return () => observer.disconnect()
    }, [])

    const flat = groupedItems.flatMap((group) => group.items) as AddItem[]
    const direct = flat.filter((item) => !item.children)
    const submenus = flat.filter((item) => item.children?.length)

    const LABELED = 88
    const COMPACT = 38
    const MORE_BUTTON = 44
    const available = Math.max(0, barWidth - 48)
    const labeled = direct.length * LABELED + (submenus.length ? MORE_BUTTON : 0) <= available
    const slots = labeled ? direct.length : Math.max(1, Math.floor((available - MORE_BUTTON) / COMPACT))
    const visibleItems = direct.slice(0, slots)
    const overflowItems = direct.slice(slots)
    const hasMore = overflowItems.length > 0 || submenus.length > 0

    const showBar = !isLocked && (isStage ? !!currentActiveStage.id : currentActiveEdit.slide !== undefined || currentActiveEdit.type === "overlay" || currentActiveEdit.type === "template")

    return (
        <>
            <div ref={host} className="hidden"></div>

            {showBar ? (
                <FloatingBar side="center" style={{ maxWidth: "calc(100% - 24px)", overflow: "visible" }}>
                    {visibleItems.map((item) => (
                        <Button key={item.id} className="addItem" title={item.title || item.label} onClick={() => handleAdd(item.id)} white>
                            <Icon id={item.icon} size={1.1} white />
                            {labeled ? (
                                <span className={styles.label}>
                                    <T id={item.label} />
                                    {item.suffix || ""}
                                </span>
                            ) : null}
                        </Button>
                    ))}

                    {hasMore ? (
                        <div className={styles.more}>
                            <Button title="main.more" onClick={() => setMenuOpen(!menuOpen)} isActive={menuOpen} white>
                                <Icon id="more" size={1.1} white />
                            </Button>
                            <Menu open={menuOpen} onClose={() => setMenuOpen(false)} className="more-menu">
                                {overflowItems.map((item) => (
                                    <MenuItem key={item.id} onClick={() => handleAdd(item.id)}>
                                        {translateText(item.label, currentDictionary)}
                                        {item.suffix || ""}
                                    </MenuItem>
                                ))}
                                {submenus.map((group, groupIndex) => (
                                    <div key={group.id || groupIndex}>
                                        {overflowItems.length || groupIndex > 0 ? <MenuSeparator /> : null}
                                        {(group.children || []).map((sub: { id: string; title?: string; label: string; suffix?: string; data?: string }) => (
                                            <MenuItem key={sub.id} onClick={() => handleAdd(sub.id)} title={sub.title || ""}>
                                                {translateText(sub.label, currentDictionary)}
                                                {sub.suffix || ""}
                                                {sub.data ? <span className={styles.preview}>{sub.data}</span> : null}
                                            </MenuItem>
                                        ))}
                                    </div>
                                ))}
                            </Menu>
                        </div>
                    ) : null}
                </FloatingBar>
            ) : null}
        </>
    )
}

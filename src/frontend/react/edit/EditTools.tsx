import { useEffect, useMemo, useRef, useState } from "react"
import type { Item, ItemType, Line, Slide } from "../../../types/Show"
import type { TabsObj } from "../../../types/Tabs"
import { activeEdit, activeShow, copyPasteEdit, overlays, selected, showsCache, storedEditMenuState, templates } from "../../shared/core/stores"
import { getAccess } from "../../utils/profile"
import { clone } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { getLayoutRef, isSlideLocked } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { getStyles } from "../../components/helpers/style"
import { getBoxStyle, getFilterStyle, getItemStyle, getSlideStyle, setBoxStyle, setFilterStyle, setItemStyle, setSlideStyle } from "../../components/edit/scripts/itemClipboard"
import { DEFAULT_ITEM_STYLE } from "../../components/edit/scripts/itemHelpers"
import { addStyleString } from "../../components/edit/scripts/textStyle"
import { itemBoxes } from "../../components/edit/values/boxes"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Center } from "../system/Center"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { EditTabs } from "./EditTabs"
import styles from "./EditTools.module.css"
import { BoxStyle } from "./tools/BoxStyle"
import { ItemStyle } from "./tools/ItemStyle"
import { OverlayStyle } from "./tools/OverlayStyle"
import { SlideFilters } from "./tools/SlideFilters"
import { SlideStyle } from "./tools/SlideStyle"
import { TemplateStyle } from "./tools/TemplateStyle"

const initialTabs: TabsObj = {
    text: { name: "items.text", icon: "text" },
    item: { name: "tools.item", icon: "item" },
    slide: { name: "tools.slide", icon: "options", overflow: true },
    filters: { name: "edit.filters", icon: "filter", overflow: true }
}

export function EditTools() {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentCopyPasteEdit = useStore(copyPasteEdit)
    const currentOverlays = useStore(overlays)
    const currentSelected = useStore(selected)
    const currentShowsCache = useStore(showsCache)
    const currentTemplates = useStore(templates)

    const [active, setActive] = useState(Object.keys(initialTabs)[0])
    const previousCount = useRef(0)

    const activeId = currentActiveEdit.id || ""
    const activeSlide = currentActiveEdit.slide ?? -1

    const isShow = !activeId
    const templateTextMode = currentActiveEdit.type === "template" && currentTemplates[activeId]?.settings?.mode === "text"
    const templateItemMode = currentActiveEdit.type === "template" && currentTemplates[activeId]?.settings?.mode === "item"

    const showIsActive = !!(currentActiveShow && (currentActiveShow.type === undefined || currentActiveShow.type === "show"))
    const editSlideSelected = currentActiveEdit.slide !== null && currentActiveEdit.slide !== undefined
    const activeIsShow = !!(currentActiveShow && (currentActiveShow.type || "show") === "show")

    const ref = useMemo(() => getLayoutRef("active", currentShowsCache), [currentShowsCache])

    const allSlideItems: Item[] = useMemo(() => {
        if (currentActiveEdit.type === "overlay") return clone(currentOverlays[activeId]?.items || [])
        if (currentActiveEdit.type === "template") return clone(currentTemplates[activeId]?.items || [])
        return editSlideSelected && activeIsShow && ref.length > activeSlide ? clone(_show().slides([ref[activeSlide]?.id]).get("items")[0] || []) : []
    }, [currentActiveEdit.type, currentOverlays, currentTemplates, activeId, editSlideSelected, activeIsShow, ref, activeSlide])

    const getItemsByIndex = (array: number[]): Item[] => array.map((i) => allSlideItems[i])
    const items = currentActiveEdit.items.length ? getItemsByIndex([...currentActiveEdit.items].sort((a, b) => a - b)) : allSlideItems
    const item = items?.length ? items[items.length - 1] : null

    const isEmpty = !allSlideItems?.length

    const slides: Slide[] = useMemo(() => {
        if (allSlideItems && ((currentActiveEdit?.id && editSlideSelected) || showIsActive)) {
            return _show(currentActiveEdit?.id || currentActiveShow?.id)
                .slides()
                .get() as Slide[]
        }
        return []
    }, [allSlideItems, currentActiveEdit?.id, editSlideSelected, showIsActive, currentActiveShow?.id, currentShowsCache])

    void slides

    const tabs = useMemo(() => {
        const t = clone(initialTabs) as TabsObj
        t.text.icon = item?.type && itemBoxes[item.type] ? itemBoxes[item.type]!.icon : "text"
        t.text.name = "items." + (item?.type || "text")
        t.filters.remove = !isShow
        t.slide.remove = (!isShow && currentActiveEdit.type !== "template" && currentActiveEdit.type !== "overlay") || templateTextMode
        if (templateTextMode) {
            t.item.remove = true
        } else {
            t.item.remove = false
        }
        if (templateItemMode) {
            t.text.remove = true
        } else {
            t.text.remove = false
        }
        t.item.disabled = isEmpty
        if (item === null) t.text.disabled = true
        else t.text.disabled = false
        return t
    }, [item, isShow, currentActiveEdit.type, templateTextMode, templateItemMode, isEmpty])

    useEffect(() => {
        if ((tabs.slide.remove && active === "slide") || (tabs.filters.remove && active === "filters")) setActive("text")
    }, [tabs.slide.remove, tabs.filters.remove, active])

    useEffect(() => {
        if (templateItemMode && active === "text") setActive("item")
    }, [templateItemMode, active])

    useEffect(() => {
        if (editSlideSelected && activeIsShow && ref.length <= activeSlide && ref.length > 0) activeEdit.set({ slide: 0, items: [], showId: currentActiveShow?.id })
    }, [editSlideSelected, activeIsShow, ref, activeSlide, currentActiveShow?.id])

    useEffect(() => {
        if (isEmpty || activeId || activeSlide) {
            previousCount.current = 0
        }
    }, [isEmpty, activeId, activeSlide])

    useEffect(() => {
        if (item === undefined) return
        if (item === null) {
            if (active === "text" || active === "item") setActive("text")
            previousCount.current = 0
            return
        }

        const currentCount = allSlideItems.length
        if (previousCount.current === currentCount) return
        previousCount.current = currentCount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item, allSlideItems.length])

    const itemType = active === "text" ? item?.type || "text" : ""
    const type = `${active}${itemType}`

    function getCurrentStyle(targetItem: Item | null = null) {
        if (active === "text" && targetItem) return getBoxStyle(targetItem)
        if (active === "item" && targetItem) return getItemStyle(targetItem)
        if (active === "slide") return getSlideStyle()
        if (active === "filters") return getFilterStyle()
        return null
    }

    function getItemsStyle(_updater: unknown = null) {
        if (!items?.length) return [getCurrentStyle()]
        return items.map((i) => getCurrentStyle(i))
    }

    function copyStyle() {
        const stylesData = getItemsStyle()

        copyPasteEdit.update((a) => {
            a[type] = stylesData
            return a
        })
    }

    function clearClipboard() {
        copyPasteEdit.update((a) => {
            delete a[type]
            return a
        })
    }

    function pasteStyle(applyToAll = false, applyToFollowing = false) {
        let stylesData = currentCopyPasteEdit[type]
        if (!Array.isArray(stylesData)) return

        let targetSlides: unknown[] = []
        if (currentActiveEdit.type === "overlay") targetSlides = [currentOverlays[activeId]]
        else if (currentActiveEdit.type === "template") targetSlides = [currentTemplates[activeId]]
        else {
            let activeSlides: string[] = []
            if (applyToAll) activeSlides = []
            else if (currentSelected.id === "slide" && currentSelected.data.length) activeSlides = currentSelected.data.map(({ index }: { index: number }) => ref[index]?.id)
            else activeSlides = [ref[activeSlide]?.id]

            targetSlides = _show().slides(activeSlides).get()
        }

        targetSlides = clone(targetSlides)

        if (active === "text") return setBoxStyle(stylesData, targetSlides, itemType as ItemType)
        if (active === "item") return setItemStyle(stylesData, targetSlides)
        if (active === "slide") return setSlideStyle(stylesData[0], targetSlides)
        if (active === "filters") {
            let indexes: number[] = []
            if (applyToFollowing) indexes = ref.map((_, i) => i).filter((a) => a >= activeSlide)
            else if (applyToAll) indexes = ref.map((_, i) => i)
            else indexes = [activeSlide]

            return setFilterStyle(stylesData[0], indexes)
        }
    }

    function reset() {
        if (!isShow) {
            if (active === "item") {
                history({
                    id: "UPDATE",
                    oldData: { id: currentActiveEdit.id },
                    newData: { key: "items", subkey: "style", data: DEFAULT_ITEM_STYLE, indexes: currentActiveEdit.items },
                    location: { page: "edit", id: currentActiveEdit.type + "_items", override: true }
                })
                return
            }

            if (active === "slide") {
                if (currentActiveEdit.type !== "template") return

                const id = currentActiveEdit?.id || ""
                history({ id: "UPDATE", newData: { key: "settings", data: {} }, oldData: { id }, location: { page: "edit", id: "template_settings", override: id } })
                return
            }

            if (active !== "text") return

            if (currentActiveEdit.type === "overlay") overlays.update(updateItemValues as never)
            else if (currentActiveEdit.type === "template") templates.update(updateItemValues as never)

            function updateItemValues(a: Record<string, { items?: Item[]; modified?: number }>) {
                const id = currentActiveEdit.id
                if (!id || !a[id]?.items) return a

                currentActiveEdit.items.forEach((i: number) => {
                    const item = a[id]?.items?.[i]
                    if (!item?.lines) return

                    item.lines.forEach((line: Line) => {
                        line.text?.forEach((text) => {
                            text.style = ""
                        })
                    })
                })

                const target = a[id]
                if (target) target.modified = Date.now()
                return a
            }

            return
        }

        const layoutRef = getLayoutRef()
        const slideId = layoutRef[activeSlide]?.id
        if (!slideId) return

        storedEditMenuState.set({})

        if (active === "item") {
            history({
                id: "setStyle",
                newData: { style: { key: "style", values: [DEFAULT_ITEM_STYLE] } },
                location: { page: "edit", show: currentActiveShow!, slide: slideId, items: currentActiveEdit.items }
            })
            return
        }

        if (active === "filters") {
            const indexes = [activeSlide]
            if (typeof indexes[0] !== "number") return

            history({ id: "SHOW_LAYOUT", newData: { key: "filterEnabled", data: undefined, indexes } })
            history({ id: "SHOW_LAYOUT", newData: { key: "filter", data: undefined, indexes } })
            history({ id: "SHOW_LAYOUT", newData: { key: "backdrop-filter", data: undefined, indexes } })
            return
        }

        if (active === "slide") {
            history({
                id: "slideStyle",
                oldData: { style: _show().slides([slideId]).get("settings")[0] },
                newData: { style: {} },
                location: { page: "edit", show: currentActiveShow!, slide: slideId }
            })
            return
        }

        if (active !== "text") return

        const values: unknown[] = []
        items.forEach((currentItem) => {
            if (currentItem.lines) {
                const text = currentItem.lines.map((a) => {
                    return (a.text || []).map((t) => {
                        t.style = ""
                        return t
                    })
                })
                values.push(text)
            }
        })

        if (values.length) {
            history({
                id: "textStyle",
                newData: { style: { key: "text", values } },
                location: {
                    page: "edit",
                    show: currentActiveShow!,
                    slide: slideId,
                    items: currentActiveEdit.items
                }
            })
        }

        let deleteKeys = ["auto", "textFit", "specialStyle", "scrolling"]
        if (item && item[item.type || ""]) deleteKeys = [item.type!]

        deleteKeys.forEach((key) => {
            history({
                id: "setItems",
                newData: { style: { key, values: [undefined] } },
                location: { page: "edit", show: currentActiveShow!, slide: slideId, items: currentActiveEdit.items, id: key }
            })
        })
    }

    useEffect(() => {
        function keydown(e: KeyboardEvent) {
            if ((document.activeElement as HTMLElement | null)?.closest(".edit")) return

            if (e.key.includes("Arrow") && currentActiveEdit.items.length) {
                e.preventDefault()

                const key = ["ArrowLeft", "ArrowRight"].includes(e.key) ? "left" : "top"
                let value = ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1
                if (e.ctrlKey || e.metaKey) value *= 10

                let selectedItems: number[] = currentActiveEdit.items || allSlideItems.map((_, i) => i)
                if (!selectedItems.length) return

                const values: string[] = []

                selectedItems.forEach((index) => {
                    const currentItem = allSlideItems[index]
                    if (!currentItem) return

                    const previousItemValue = Number(getStyles(currentItem.style, true)?.[key] || "0")
                    const newValue = previousItemValue + value + "px"

                    values.push(addStyleString(currentItem.style, [key, newValue]))
                })

                if (activeId) {
                    history({
                        id: "UPDATE",
                        oldData: { id: activeId },
                        newData: { key: "items", subkey: "style", data: values, indexes: selectedItems },
                        location: { page: "edit", id: currentActiveEdit.type + "_items", override: true }
                    })
                    return
                }

                const layoutRef = getLayoutRef()
                const slideId = layoutRef[activeSlide ?? ""]?.id

                history({
                    id: "setItems",
                    newData: { style: { key: "style", values } },
                    location: { page: "edit", show: currentActiveShow!, slide: slideId, items: selectedItems, override: "slideitem_" + slideId + "_items_" + selectedItems.join(",") }
                })
            }
        }

        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [currentActiveEdit, allSlideItems, activeId, activeSlide, currentActiveShow])

    const slideActive = !!((slides?.length && showIsActive && activeSlide !== null) || activeId)
    const profile = getAccess("shows")

    const currentShow = currentShowsCache[currentActiveShow?.id || ""]
    const isLocked = activeId ? false : currentShow?.locked || isSlideLocked(currentActiveShow?.id || "", ref[activeSlide]?.id || "", currentShow) || profile.global === "read" || profile[currentShow?.category || ""] === "read"
    const overflowHidden = !!(isShow || currentActiveEdit.type === "template" || currentActiveEdit.type === "overlay")

    const currentCopied = currentCopyPasteEdit[type]
    const currentItemStyle = getItemsStyle(currentShowsCache[currentActiveEdit?.id || currentActiveShow?.id || ""])
    const copiedStyleDifferent = currentCopied && JSON.stringify(currentCopied) !== JSON.stringify(currentItemStyle)

    const customLocalFonts = showIsActive ? currentShowsCache[currentActiveEdit?.id || currentActiveShow?.id || ""]?.settings?.customFonts || [] : []

    return (
        <div className={`main border editTools ${styles.main}`}>
            {slideActive && !isLocked ? (
                <>
                    <EditTabs tabs={tabs} active={active} onActiveChange={setActive} overflowHidden={overflowHidden} />

                    {active === "text" ? (
                        <div className={styles.content}>
                            {item ? (
                                <BoxStyle id={(item?.type || "text") as ItemType} allSlideItems={allSlideItems} item={item} customLocalFonts={customLocalFonts} />
                            ) : (
                                <Center faded>
                                    <T id="empty.items" />
                                </Center>
                            )}
                        </div>
                    ) : active === "item" ? (
                        <div className={styles.content}>
                            <ItemStyle allSlideItems={allSlideItems} item={item} />
                        </div>
                    ) : active === "filters" ? (
                        <div className={styles.content}>
                            <SlideFilters />
                        </div>
                    ) : active === "slide" ? (
                        <div className={styles.content}>{currentActiveEdit.type === "template" ? <TemplateStyle allSlideItems={allSlideItems} /> : currentActiveEdit.type === "overlay" ? <OverlayStyle allSlideItems={allSlideItems} /> : <SlideStyle allSlideItems={allSlideItems} />}</div>
                    ) : null}

                    {item || active === "slide" || active === "filters" ? (
                        <FloatingBar>
                            {copiedStyleDifferent ? (
                                <>
                                    <Button icon="paste" title="actions.paste" onClick={() => pasteStyle()}>
                                        <T id="actions.paste" />
                                    </Button>
                                    <div className="divider"></div>
                                </>
                            ) : null}
                            {currentCopied && !copiedStyleDifferent ? (
                                isShow ? (
                                    <>
                                        {active === "filters" ? (
                                            <>
                                                <Button icon="down" title="actions.to_following" onClick={() => pasteStyle(false, true)} />
                                                <div className="divider"></div>
                                            </>
                                        ) : null}
                                        <Button icon="paste" title="actions.to_all" onClick={() => pasteStyle(true)}>
                                            <T id="actions.to_all" />
                                        </Button>
                                    </>
                                ) : null
                            ) : (
                                <Button disabled={!currentItemStyle?.length} title="actions.copy" onClick={copyStyle}>
                                    <Icon id="copy" white={copiedStyleDifferent} />
                                    {!copiedStyleDifferent ? <T id="actions.copy" /> : null}
                                </Button>
                            )}

                            <div className="divider"></div>

                            {currentCopied ? <Button icon="clear" title="clear.general: formats.clipboard" onClick={clearClipboard}></Button> : <Button icon="reset" title="actions.reset" onClick={reset}></Button>}
                        </FloatingBar>
                    ) : null}
                </>
            ) : isLocked ? (
                <Center faded>
                    <Icon id="lock" size={2} white />
                    <p style={{ marginTop: "8px" }}>
                        <T id="output.state_locked" />
                    </p>
                </Center>
            ) : (
                <Center faded>
                    <T id="empty.slides" />
                </Center>
            )}
        </div>
    )
}

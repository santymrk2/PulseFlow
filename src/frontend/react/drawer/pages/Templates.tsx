import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type WheelEvent } from "react"
import type { Template } from "../../../../types/Show"
import { activeEdit, activePage, activePopup, activeProfile, activeShow, alertMessage, categories, labelsDisabled, mediaOptions, outputs, previewOutputId, profiles, selected, showsCache, special, styles as stylesStore, templateApplied, templateCategories, templates } from "../../../stores"
import { translateText } from "../../../utils/language"
import { getAccess } from "../../../utils/profile"
import { clone, keysToID, sortByName } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { getFirstActiveOutput, getResolution } from "../../../components/helpers/output"
import { deselect } from "../../../components/helpers/select"
import { getLayoutRef } from "../../../components/helpers/show"
import { _show } from "../../../components/helpers/shows"
import Actions from "../../../components/slide/Actions.svelte"
import TemplateSlide from "../../../components/drawer/pages/TemplateSlide.svelte"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { T } from "../../helpers/T"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { DropArea } from "../../system/DropArea"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { Card } from "../Card"
import styles from "./Templates.module.css"

// Port de components/drawer/pages/Templates.svelte: grilla de plantillas con carga por lotes.
// `slide/Actions.svelte` y `TemplateSlide.svelte` siguen en Svelte y se montan como islas.
export interface TemplatesProps {
    active: string | null
    // Theme editor: lista de una columna en el panel izquierdo; un clic abre la plantilla para editarla (no la aplica al show)
    columns?: number | null
    editOnClick?: boolean
}

interface TemplateWithId extends Template {
    id: string
}

interface LayoutSlideRef {
    index?: number
    id: string
    parent?: { id: string }
}

interface SelectedSlideRef {
    index: number
    showId?: string
}

interface LazyState {
    active: string | null
    count: number
    loaded: boolean
}

function isTextTemplate(template: TemplateWithId): boolean {
    return template.settings?.mode === "text"
}

function filterTemplates(allTemplates: Record<string, Template>, active: string | null, templateCategoriesValue: Record<string, { isArchive?: boolean } | undefined>): TemplateWithId[] {
    return sortByName(keysToID(clone(allTemplates)).filter((s) => (active === "all" && !templateCategoriesValue[s?.category || ""]?.isArchive) || active === s.category || (active === "unlabeled" && (s.category === null || !templateCategoriesValue[s.category])))).filter((a) => !isTextTemplate(a)) as TemplateWithId[]
}

export function Templates({ active, columns = null, editOnClick = false }: TemplatesProps) {
    const templatesValue = useStore(templates)
    const templateCategoriesValue = useStore(templateCategories)
    const activeProfileValue = useStore(activeProfile)
    const activeShowValue = useStore(activeShow)
    const showsCacheValue = useStore(showsCache)
    const selectedValue = useStore(selected)
    const categoriesValue = useStore(categories)
    const stylesValue = useStore(stylesStore)
    const specialValue = useStore(special)
    const mediaOptionsValue = useStore(mediaOptions)
    const activeEditValue = useStore(activeEdit)
    const activePageValue = useStore(activePage)
    const labelsDisabledValue = useStore(labelsDisabled)
    useStore(outputs)
    useStore(previewOutputId)
    useStore(profiles)

    const profile = (activeProfileValue ? getAccess("templates") : {}) as Record<string, string | undefined>
    const readOnly = profile.global === "read" || profile[active || ""] === "read"
    const gridColumns = columns ?? mediaOptionsValue.columns

    const resolution = getResolution()

    const filteredTemplates = filterTemplates(templatesValue, active, templateCategoriesValue)
    const fullFilteredTemplates = clone(filteredTemplates)

    const activeTemplate = (activeShowValue && activeShowValue.type === undefined) || activeShowValue?.type === "show" ? showsCacheValue[activeShowValue.id]?.settings?.template : null

    // lazy loader: el estado guarda la categoría para resetearse junto con el cambio de `active`
    const [lazy, setLazy] = useState<LazyState>(() => ({ active, count: 0, loaded: false }))
    useEffect(() => {
        if (lazy.active !== active) {
            setLazy({ active, count: 0, loaded: false })
            return
        }
        if (lazy.loaded || !fullFilteredTemplates.length) return
        if (lazy.count >= fullFilteredTemplates.length) {
            setLazy({ ...lazy, loaded: true })
            return
        }

        const timeout = setTimeout(
            () => {
                setLazy((current) => ({ ...current, count: current.count + (current.count === 0 ? 4 : Math.min(32, current.count * 2)) }))
            },
            lazy.count === 0 ? 60 : 30
        )

        return () => clearTimeout(timeout)
    }, [lazy, active, fullFilteredTemplates.length])

    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    function wheel(e: WheelEvent<HTMLDivElement>) {
        if (columns !== null || (!e.ctrlKey && !e.metaKey)) return
        if (nextScrollTimeout.current) return

        mediaOptions.set({ ...mediaOptionsValue, columns: Math.max(2, Math.min(10, mediaOptionsValue.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout.current = setTimeout(() => {
            nextScrollTimeout.current = null
        }, 500)
    }

    const templateWithNonExistentCategory = active === "unlabeled" && filteredTemplates.some((s) => s.category)
    function createNonExistentCategories() {
        const nonexistentCategories = [...new Set(filteredTemplates.map((s) => s.category))].filter((c) => c && !templateCategoriesValue[c]) as string[]

        templateCategories.update((a) => {
            nonexistentCategories.forEach((id) => {
                if (a[id]) return
                a[id] = { name: translateText("main.unnamed") }
            })
            return a
        })
    }

    const isShowActive = !!(activeShowValue && (activeShowValue?.type || "show") === "show")
    const alerted = useRef(false)
    function templateClick(e: ReactMouseEvent<HTMLDivElement> | null = null, templateId: string) {
        const target = e?.target instanceof Element ? e.target : null
        if (target?.closest(".edit") || target?.closest(".icons")) return
        if (editOnClick) {
            activeEdit.set({ type: "template", id: templateId, items: [] })
            activePage.set("edit")
            return
        }
        if (!activeShowValue || !isShowActive || e?.ctrlKey || e?.metaKey) return

        const activeShowId = activeShowValue.id
        if (showsCacheValue[activeShowId]?.locked) {
            alertMessage.set("show.locked")
            activePopup.set("alert")
            return
        }

        const showProfile = getAccess("shows") as Record<string, string | undefined>
        const showReadOnly = showProfile.global === "read" || showProfile[showsCacheValue[activeShowId]?.category || ""] === "read"
        if (showReadOnly) {
            alertMessage.set("profile.locked")
            activePopup.set("alert")
            return
        }

        // one selected slides
        const ref = getLayoutRef() as LayoutSlideRef[]
        if (selectedValue.id === "slide" && selectedValue.data.length < ref.length) {
            ;(selectedValue.data as SelectedSlideRef[]).forEach(({ index, showId }) => {
                const layoutSlide = ref[index]
                if (!layoutSlide) return
                const slideId = layoutSlide.id

                // check if locked
                const groupSlide = _show(showId || "active")
                    .slides([layoutSlide.parent?.id || layoutSlide.id])
                    .get()[0]
                if (groupSlide?.locked) return

                const slideSettings = _show(showId || "active")
                    .slides([slideId])
                    .get("settings")
                const oldData = { style: clone(slideSettings) }
                const newData = { style: { ...clone(slideSettings), template: templateId } }

                // WIP apply to all slides at once...
                history({
                    id: "slideStyle",
                    oldData,
                    newData,
                    location: { page: "edit", show: activeShowValue, slide: slideId }
                })
            })

            deselect()
            // WIP refresh slides (apply template)
            return
        }

        // alert if show category has a template
        const categoryId = showsCacheValue[activeShowId]?.category || ""
        const categoryTemplate = (categoriesValue[categoryId] as { template?: string } | undefined)?.template || ""
        if (categoryTemplate) {
            if (!alerted.current) {
                alertMessage.set("tips.category_template")
                activePopup.set("alert")
                alerted.current = true
            }
            return
        }

        templateApplied.set(true)
        setTimeout(() => templateApplied.set(false), 500)

        history({ id: "TEMPLATE", newData: { id: templateId, data: { createItems: true, shiftItems: e?.shiftKey } }, location: { page: "none", override: "show#" + activeShowId } })

        // alert if first output has a style template
        if (specialValue.styleTemplatePreview !== false) {
            const outputStyleId = getFirstActiveOutput()?.style || ""
            const styleTemplate = (stylesValue[outputStyleId] as { template?: string } | undefined)?.template || ""
            if (styleTemplate && !alerted.current) {
                alertMessage.set("tips.style_template_active")
                activePopup.set("alert")
                alerted.current = true
            }
        }
    }

    return (
        <>
            <div style={{ position: "relative", height: "100%", overflowY: "auto" }} className="context #drawer_templates" onWheel={wheel}>
                <DropArea id="templates">
                    {fullFilteredTemplates.length ? (
                        <div className={styles.grid} style={{ "--width": `${100 / gridColumns}%` } as CSSProperties}>
                            {fullFilteredTemplates.map((template, i) => {
                                const isReadOnly = readOnly || profile[template.category || ""] === "read"

                                return (
                                    <SelectElem key={template.id} id="template" data={template.id} className={`context #template_card${template.isDefault && !isReadOnly ? "_default" : ""}${isReadOnly ? "_readonly" : ""}`} draggable fill>
                                        <Card width={100} preview={activePageValue === "edit" && activeEditValue.type === "template" && activeEditValue.id === template.id} active={template.id === activeTemplate} label={template.name} renameId={`template_${template.id}`} icon={template.isDefault ? "protected" : null} color={template.color} resolution={resolution} showApplyOnHover={isShowActive} onClick={(e) => templateClick(e, template.id)}>
                                            {lazy.loaded || i < lazy.count ? (
                                                <>
                                                    {/* icons */}
                                                    {template.settings?.actions?.length ? <SvelteIsland component={Actions} props={{ columns: gridColumns, templateId: template.id, actions: { slideActions: template.settings?.actions } }} /> : null}

                                                    <SvelteIsland component={TemplateSlide} props={{ templateId: template.id, template, preview: true }} />
                                                </>
                                            ) : null}
                                        </Card>
                                    </SelectElem>
                                )
                            })}
                        </div>
                    ) : (
                        <Center size={1.2} faded>
                            {filteredTemplates.length ? <T id="empty.search" /> : <T id="empty.general" />}
                        </Center>
                    )}
                </DropArea>
            </div>

            {templateWithNonExistentCategory ? (
                <FloatingBar side="left" onlyOne>
                    <Button onClick={createNonExistentCategories}>
                        <Icon id="autofill" />
                        <T id="category.create_nonexistent" />
                    </Button>
                </FloatingBar>
            ) : null}

            <FloatingBar onlyOne>
                <Button disabled={readOnly} icon="add" title="new.template" onClick={() => history({ id: "UPDATE", location: { page: "drawer", id: "template" } })}>
                    {!labelsDisabledValue ? <T id="new.template" /> : null}
                </Button>
            </FloatingBar>
        </>
    )
}

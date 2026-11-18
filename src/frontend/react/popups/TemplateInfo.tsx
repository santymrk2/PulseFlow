import { useState } from "react"
import { get } from "../../lib/store"
import { allOutputsHasStyleTemplate, getFirstActiveOutput } from "../../components/helpers/output"
import { getLayoutRef, removeTemplatesFromShow } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { openSettings } from "../../components/settings/openSettings"
import { activeEdit, activePage, activePopup, activeShow, activeStyle, alertMessage, categories, groups, showsCache, special, styles, templates } from "../../stores"
import { translateText } from "../../utils/language"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { HRule } from "../ui/h-rule/HRule"
import stylesModule from "./TemplateInfo.module.css"

// Port de components/main/popups/TemplateInfo.svelte. Lee: activeShow/showsCache/activeEdit/groups/styles/special/templates (al montar) y
// activePage/templates/styles en el render. Escribe: activeStyle + openSettings("styles") y activePopup, activeEdit + activePage + activePopup,
// alertMessage + activePopup ("alert") o removeTemplatesFromShow + activePopup al quitar la plantilla del show.
// El Svelte usaba una variable `open` sin declarar dentro de `|| open`: se conserva como global (window.open, siempre truthy en la app).
function initialInfo() {
    const showId = get(activeShow)?.id || ""
    const currentShow = get(showsCache)[showId]
    const referenceType = currentShow?.reference?.type
    const isScripture = referenceType === "scripture"

    const outputStyleId = getFirstActiveOutput()?.style || ""
    const outputStyleTemplate = allOutputsHasStyleTemplate(isScripture) ? get(styles)[outputStyleId]?.[isScripture ? "templateScripture" : "template"] || "" : ""
    const enableStylePreview = !!(outputStyleTemplate && get(special).styleTemplatePreview !== false && get(templates)[outputStyleTemplate])

    const ref = showId && currentShow ? getLayoutRef(showId) : []
    const activeEditValue = get(activeEdit)
    const slideIndex = activeEditValue.slide !== null ? activeEditValue.slide! : -1
    const Slide = slideIndex >= 0 && ref?.[slideIndex] ? _show(showId).slides([ref[slideIndex]?.id]).get()?.[0] : null
    const slideTemplate = Slide?.settings?.template

    const parentId = slideIndex >= 0 && ref?.[slideIndex] ? ref[slideIndex]?.parent?.id || ref[slideIndex]?.id : ""
    const slideGroup = _show(showId).slides([parentId]).get()?.[0]?.globalGroup || ""
    const groupTemplate = get(groups)[slideGroup]?.template

    const showTemplateId = currentShow?.settings?.template || ""
    const showTemplateIcon = !!(showTemplateId && get(templates)[showTemplateId])
    const inheritedOpen = (globalThis as { open?: unknown }).open
    const enableShowTemplate = showTemplateIcon && (!referenceType || referenceType === "scripture" || !!inheritedOpen)

    return { showId, isScripture, outputStyleId, outputStyleTemplate, enableStylePreview, slideTemplate, groupTemplate, showTemplateId, enableShowTemplate }
}

export function TemplateInfo() {
    const [info] = useState(initialInfo)
    const [enableShowTemplate, setEnableShowTemplate] = useState(info.enableShowTemplate)
    const page = useStore(activePage)
    const templatesValue = useStore(templates)
    const stylesValue = useStore(styles)

    function openStylePage() {
        activeStyle.set(info.outputStyleId)
        openSettings("styles")
        // scroll to bottom
        setTimeout(() => {
            document.querySelector(".row")?.querySelector(".center")?.querySelector(".scroll")?.scrollTo(0, 1000)
        }, 80)

        activePopup.set(null)
    }

    function editTemplate(templateId: string) {
        activeEdit.set({ type: "template", id: templateId, items: [] })
        activePage.set("edit")
        activePopup.set(null)
    }

    function removeShowTemplate() {
        const categoryId = get(showsCache)[info.showId]?.category || ""
        const categoryTemplate = get(categories)[categoryId]?.template || ""
        if (categoryTemplate) {
            alertMessage.set("tips.category_template")
            activePopup.set("alert")
            return
        }

        removeTemplatesFromShow(info.showId, "", true)
        setEnableShowTemplate(false)
        activePopup.set(null)
    }

    const styleTemplateName = templatesValue[info.outputStyleTemplate]?.name || ""
    const styleName = stylesValue[info.outputStyleId]?.name || ""

    return (
        <>
            {info.enableStylePreview ? (
                <>
                    <p>
                        <b>{translateText("edit.style")}:</b> {translateText(`settings.override${info.isScripture ? "_scripture" : ""}_with_template`)}
                    </p>

                    <div className={stylesModule.flex}>
                        <Button style={{ flex: 1 }} variant="outline" title={`menu.edit: ${styleTemplateName}`} onClick={() => editTemplate(info.outputStyleTemplate)}>
                            <Icon size={1.1} id="edit" />
                            <p>
                                {translateText("menu.edit")}: <b>{styleTemplateName}</b>
                            </p>
                        </Button>

                        <Button style={{ flex: 1 }} variant="outline" title={`edit.style: ${styleName}`} onClick={openStylePage}>
                            <Icon size={1.1} id="styles" />
                            <p>
                                {translateText("edit.style")}: <b>{styleName}</b>
                            </p>
                        </Button>
                    </div>
                </>
            ) : null}

            {info.enableStylePreview && (info.slideTemplate || info.groupTemplate || enableShowTemplate) ? <HRule /> : null}

            {page === "edit" ? (
                <>
                    {info.slideTemplate ? (
                        <>
                            <p>
                                <b>{translateText("tools.slide")}:</b>
                            </p>

                            <div className={stylesModule.flex}>
                                <Button style={{ flex: 1 }} variant="outline" title={`menu.edit: ${templatesValue[info.slideTemplate]?.name || ""}`} onClick={() => editTemplate(info.slideTemplate)}>
                                    <Icon size={1.1} id="edit" />
                                    <p>
                                        {translateText("menu.edit")}: <b>{templatesValue[info.slideTemplate]?.name || ""}</b>
                                    </p>
                                </Button>
                            </div>
                        </>
                    ) : null}

                    {info.groupTemplate ? (
                        <>
                            <p style={info.slideTemplate ? { marginTop: "10px" } : undefined}>
                                <b>{translateText("inputs.group")}:</b>
                            </p>

                            <div className={stylesModule.flex}>
                                <Button style={{ flex: 1 }} variant="outline" title={`menu.edit: ${templatesValue[info.groupTemplate]?.name || ""}`} onClick={() => editTemplate(info.groupTemplate || "")}>
                                    <Icon size={1.1} id="edit" />
                                    <p>
                                        {translateText("menu.edit")}: <b>{templatesValue[info.groupTemplate]?.name || ""}</b>
                                    </p>
                                </Button>

                                <Button style={{ flex: 1 }} variant="outline" title="popup.manage_groups" onClick={() => activePopup.set("manage_groups")}>
                                    <Icon size={1.1} id="groups" />
                                    <p>{translateText("popup.manage_groups")}</p>
                                </Button>
                            </div>
                        </>
                    ) : null}

                    {(info.slideTemplate || info.groupTemplate) && enableShowTemplate ? <HRule /> : null}
                </>
            ) : null}

            {enableShowTemplate ? (
                <>
                    <p>
                        <b>{translateText("formats.show")}:</b>
                    </p>

                    <div className={stylesModule.flex}>
                        <Button style={{ flex: 1 }} variant="outline" title={`menu.edit: <b>${templatesValue[info.showTemplateId]?.name || "info.template"}</b>`} onClick={() => editTemplate(info.showTemplateId)}>
                            <Icon size={1.1} id="edit" />
                            <p>
                                {translateText("menu.edit")}: <b>{templatesValue[info.showTemplateId]?.name || "info.template"}</b>
                            </p>
                        </Button>

                        <Button style={{ flex: 1 }} variant="outline" title="actions.remove_template_from_show" onClick={removeShowTemplate}>
                            <Icon size={1.1} id="remove_circle" />
                            <p>{translateText("actions.remove_template_from_show")}</p>
                        </Button>
                    </div>
                </>
            ) : null}
        </>
    )
}

import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { Metadata } from "../../../types/Settings"
import { Tip } from "../main/Tip"
import { clone } from "../../components/helpers/array"
import { metadataDisplayValues } from "../../components/helpers/show"
import { activeEdit, activePage, activePopup, categories, currentMetadataPopupData, popupData, styles, templates } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { PopupField } from "../ui/popup-field/PopupField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import stylesModule from "./MetadataDisplay.module.css"

// Port de components/main/popups/MetadataDisplay.svelte. Lee: popupData (al montar), currentMetadataPopupData, categories, styles y templates.
// Escribe: currentMetadataPopupData al montar; categories/styles en cada cambio; activeEdit/activePage/activePopup al editar plantilla;
// trigger del popup (cuando no es categoría ni estilo) y activePopup = null si se elige el display ya activo.
// Tip usa el port React; Icon usa el helper React ya migrado.
interface MetadataPopupData {
    type?: string
    id?: string
    ids?: string[]
    trigger?: (value: unknown) => void
}
type MetadataValue = string | boolean | null

const iconSize = 95
const icons = {
    never: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g>',
    always: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g><line x1="16.333" y1="42" x2="38.333" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="61.667" y1="42" x2="83.667" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="61.667" y1="69" x2="83.667" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="16.333" y1="69" x2="38.333" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
    first: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g><line x1="16.333" y1="42" x2="38.333" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
    last: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g><line x1="61.667" y1="69" x2="83.667" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
    first_last:
        '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g><line x1="16.333" y1="42" x2="38.333" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="61.667" y1="69" x2="83.667" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>'
}

export function MetadataDisplay() {
    const categoriesValue = useStore(categories)
    const stylesValue = useStore(styles)
    const templatesValue = useStore(templates)
    useStore(currentMetadataPopupData)

    const [data] = useState<MetadataPopupData>(() => {
        const popup = get(popupData) as MetadataPopupData
        if (popup.type === "show_category" || popup.type === "style") {
            const cloned = clone(popup)
            currentMetadataPopupData.set(cloned)
            return cloned
        }
        return get(currentMetadataPopupData) as MetadataPopupData
    })

    const type = data.type
    const ids = data.id ? [data.id] : data.ids || []
    let currentValue: Metadata = {}
    if (type === "show_category") currentValue = categoriesValue[ids[0]]?.metadata || {}
    else if (type === "style") currentValue = stylesValue[ids[0]]?.metadata || {}

    const display = currentValue.display || (type === "style" ? "default" : "never")
    const templateAll = currentValue.templateAll || "metadata"
    const template = currentValue.template || (display === "always" ? templateAll : "metadata")
    const templateFirst = currentValue.templateFirst || (display === "always" ? templateAll : template)
    const displayValues = type === "style" ? [{ id: "default", name: "example.default" }, ...metadataDisplayValues] : metadataDisplayValues

    const [showMore, setShowMore] = useState(currentValue.ignoreEmpty ?? false)

    function changeMetadata(key: string, value: MetadataValue) {
        if (key === "display" && currentValue[key as keyof Metadata] === value) {
            activePopup.set(null)
            return
        }

        if (key === "template" && value === "metadata") changeMetadata("templateFirst", value)
        let nextValue = value
        if (display === "always" && (key === "template" || key === "templateFirst") && nextValue === templateAll) nextValue = ""
        ;(currentValue as unknown as Record<string, MetadataValue>)[key] = nextValue

        if (type === "show_category") {
            categories.update((a) => {
                ids.forEach((id) => {
                    if (!a[id]) return

                    if (key === "display" && nextValue === "never") {
                        delete a[id].metadata
                        return
                    }

                    if (!a[id].metadata) a[id].metadata = {}
                    a[id].metadata[key] = nextValue as string
                })
                return a
            })
            return
        }

        if (type === "style") {
            styles.update((a) => {
                const id = ids[0] || "default"
                if (!a[id]) a[id] = { name: translateText("example.default") }

                if (key === "display" && nextValue === "default") {
                    delete a[id].metadata
                    return a
                }

                if (!a[id].metadata) a[id].metadata = {}
                a[id].metadata[key] = nextValue as string

                return a
            })
        }

        if (data.trigger) {
            data.trigger(nextValue)
            return
        }
    }

    function editTemplate(id: string) {
        activeEdit.set({ type: "template", id, items: [] })
        activePage.set("edit")
        activePopup.set(null)
    }

    return (
        <>
            <div className={stylesModule.types}>
                {displayValues.map((item) => {
                    const isActive = item.id === display
                    return (
                        <Button key={item.id} style={{ backgroundColor: "var(--primary-darker)" }} showOutline={isActive} isActive={isActive} onClick={() => changeMetadata("display", item.id)}>
                            {item.id === "default" ? <Icon id="shows" style={{ height: `${iconSize}pt`, opacity: 0.8 }} size={2} white /> : <svg viewBox="0 0 100 100" width={`${iconSize}pt`} height={`${iconSize}pt`} dangerouslySetInnerHTML={{ __html: icons[item.id as keyof typeof icons] }} />}

                            <p style={{ fontSize: "0.75em", opacity: 0.9 }}>{translateText(item.name)}</p>
                        </Button>
                    )
                })}
            </div>

            {display === "default" ? (
                <Tip value="tips.display_metadata" top={20} />
            ) : display !== "never" ? (
                <>
                    <Button className={`popup-options ${showMore ? "active" : ""}`} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

                    <div style={{ marginTop: "20px" }}>
                        {display === "always" ? (
                            <InputRow>
                                <PopupField label="meta.meta_template" value={templateAll} defaultValue="metadata" name={templatesValue[templateAll]?.name || ""} popupId="select_template" icon="templates" data={{ revert: "metadata_display" }} onChange={(value) => changeMetadata("templateAll", value)} />
                                {templateAll && templatesValue[templateAll] ? <Button title="titlebar.edit" icon="edit" onClick={() => editTemplate(templateAll)} /> : null}
                            </InputRow>
                        ) : null}

                        {display === "first_last" || display === "always" ? (
                            <InputRow>
                                <PopupField label="meta.meta_template (show_at.first)" value={templateFirst} defaultValue={display === "always" ? templateAll : template} name={templatesValue[templateFirst]?.name || ""} popupId="select_template" icon="templates" data={{ revert: "metadata_display" }} onChange={(value) => changeMetadata("templateFirst", value)} />
                                {templateFirst && templatesValue[templateFirst] ? <Button title="titlebar.edit" icon="edit" onClick={() => editTemplate(templateFirst)} /> : null}
                            </InputRow>
                        ) : null}

                        <InputRow>
                            <PopupField label={`meta.meta_template${display === "first_last" || display === "always" ? " (show_at.last)" : ""}`} value={template} defaultValue={display === "always" ? templateAll : "metadata"} name={templatesValue[template]?.name || ""} popupId="select_template" icon="templates" data={{ revert: "metadata_display" }} onChange={(value) => changeMetadata("template", value)} />
                            {template && templatesValue[template] ? <Button title="titlebar.edit" icon="edit" onClick={() => editTemplate(template)} /> : null}
                        </InputRow>

                        {showMore ? <ToggleField label="meta.ignore_empty" checked={currentValue.ignoreEmpty} defaultValue={false} onChange={(value) => changeMetadata("ignoreEmpty", value)} /> : null}

                        <Tip value="tips.metadata_customize" top={20} />
                    </div>
                </>
            ) : null}
        </>
    )
}

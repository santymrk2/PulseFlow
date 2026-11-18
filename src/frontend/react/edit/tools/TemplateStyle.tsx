import { useMemo, useState } from "react"
import type { Item, TemplateSettings } from "../../../../types/Show"
import { activeEdit, activePopup, overlays, popupData, templates } from "../../../stores"
import { translateText } from "../../../utils/language"
import { mediaExtensions } from "../../../values/extensions"
import { clone, keysToID, sortByName } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import { ColorField } from "../../ui/color-field/ColorField"
import { FileField } from "../../ui/file-field/FileField"
import { InputRow } from "../../ui/input-row/InputRow"
import { NumberField } from "../../ui/number-field/NumberField"
import { PopupField } from "../../ui/popup-field/PopupField"
import { SelectField } from "../../ui/select-field/SelectField"
import { ToggleField } from "../../ui/toggle-field/ToggleField"
import { ItemsList } from "./ItemsList"
import styles from "./TemplateStyle.module.css"

export interface TemplateStyleProps {
    allSlideItems: Item[]
}

const modes = [
    { value: "default", label: translateText("example.default") },
    { value: "scripture", label: translateText("tabs.scripture") },
    { value: "item", label: translateText("tools.item") }
]

export function TemplateStyle({ allSlideItems }: TemplateStyleProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentTemplates = useStore(templates)
    const currentOverlays = useStore(overlays)

    const templateId = currentActiveEdit?.id || ""
    const template = currentTemplates[templateId]

    const derivedSettings = useMemo<TemplateSettings>(
        () => ({
            backgroundColor: template?.settings?.backgroundColor || "",
            ...(template?.settings || {})
        }),
        [template]
    )

    const [local, setLocal] = useState<{ id: string; settings: TemplateSettings }>({ id: templateId, settings: derivedSettings })
    const settings = local.id === templateId ? local.settings : derivedSettings

    function update(nextSettings: TemplateSettings) {
        setLocal({ id: templateId, settings: nextSettings })
        if (!template || !templateId) return
        const newData = { key: "settings", data: clone(nextSettings) }
        history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: templateId } })
    }

    function setValue(value: unknown, key: string) {
        update({ ...settings, [key]: value })
    }

    const overlayList = sortByName(keysToID(currentOverlays))
        .filter((a: { name?: string }) => a.name)
        .map((a: { id: string; name?: string }) => ({ value: a.id, label: a.name || "" }))

    const mode = template?.settings?.mode || "default"

    return (
        <div className={styles.tools}>
            <div>
                <SelectField label="actions.mode" options={modes} value={mode} defaultValue="default" onChange={(value) => setValue(value, "mode")} />
            </div>

            <div>
                <ColorField label="edit.background_color" value={settings.backgroundColor || ""} onInput={(value) => update({ ...settings, backgroundColor: value })} allowEmpty allowGradients noLabel />

                <InputRow>
                    <FileField label="edit.background_media" value={settings.backgroundPath} filter={{ name: "Media files", extensions: mediaExtensions }} onChange={(value) => setValue(Array.isArray(value) ? value[0] : value, "backgroundPath")} allowEmpty />
                </InputRow>
            </div>

            {mode !== "scripture" ? (
                <div>
                    <div className={styles.title}>
                        <span style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 12px" }}>
                            <Icon id="text" white />
                            <p>{translateText("edit.text")}</p>
                        </span>
                    </div>

                    <NumberField label="edit.max_lines_per_slide" value={Number(settings?.maxLinesPerSlide || 0)} max={100} onChange={(value) => setValue(value, "maxLinesPerSlide")} />
                    <NumberField label="edit.break_long_lines_tip" value={Number(settings?.breakLongLines || 0)} max={100} onChange={(value) => setValue(value, "breakLongLines")} />
                </div>
            ) : null}

            <div>
                <div className={styles.title}>
                    <span style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 12px" }}>
                        <Icon id="special" white />
                        <p>{translateText("edit.special")}</p>
                    </span>
                </div>

                <SelectField label="edit.overlay_content" options={overlayList} value={settings.overlayId || ""} onChange={(value) => setValue(value || "", "overlayId")} allowEmpty />

                <InputRow>
                    <PopupField
                        label="edit.different_first_template"
                        value={settings.firstSlideTemplate || ""}
                        name={currentTemplates[settings.firstSlideTemplate || ""]?.name || ""}
                        popupId="select_template"
                        icon="templates"
                        onChange={(value) => {
                            const next = { ...settings, firstSlideTemplate: value || "" }
                            if (!value) next.createFirstSlide = false
                            update(next)
                        }}
                        allowEmpty
                    />
                </InputRow>

                {settings.firstSlideTemplate ? <ToggleField label="settings.always_place_empty_slide_first" checked={!!settings.createFirstSlide} defaultValue={false} onChange={(value) => setValue(value, "createFirstSlide")} /> : null}

                <Button
                    variant="outline"
                    icon="text"
                    style={{ width: "100%" }}
                    onClick={() => {
                        popupData.set({ templateId })
                        activePopup.set("template_style_overrides")
                    }}
                >
                    {translateText("popup.template_style_overrides")}
                </Button>
            </div>

            <ItemsList allSlideItems={allSlideItems} />
        </div>
    )
}

import { useMemo, useState } from "react"
import type { Item } from "../../../../types/Show"
import { activeEdit, activePage, activeShow, showsCache, templates } from "../../../shared/core/stores"
import { mediaExtensions } from "../../../shared/core/values/extensions"
import { clone } from "../../../shared/utils/helpers/array"
import { history } from "../../../shared/utils/helpers/history"
import { getLayoutRef } from "../../../shared/utils/helpers/show"
import { _show } from "../../../shared/utils/helpers/shows"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import { ColorField } from "../../ui/color-field/ColorField"
import { FileField } from "../../ui/file-field/FileField"
import { InputRow } from "../../ui/input-row/InputRow"
import { PopupField } from "../../ui/popup-field/PopupField"
import { ItemsList } from "./ItemsList"
import styles from "./SlideStyle.module.css"

export interface SlideStyleProps {
    allSlideItems: Item[]
}

export function SlideStyle({ allSlideItems }: SlideStyleProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentShowsCache = useStore(showsCache)
    const currentTemplates = useStore(templates)

    const slideId = getLayoutRef()?.[currentActiveEdit.slide || 0]?.id
    const editSlide = currentShowsCache && currentActiveEdit.slide !== null && slideId ? _show().slides([slideId]).get()[0] : null

    const derived = useMemo(
        () => ({
            template: editSlide?.settings?.template,
            color: editSlide?.settings?.color || "",
            backgroundImage: editSlide?.settings?.backgroundImage || ""
        }),
        [editSlide]
    )

    const [local, setLocal] = useState({ slideId: slideId || "", settings: derived })
    const settings = local.slideId === (slideId || "") ? local.settings : derived

    function update(next: typeof settings) {
        setLocal({ slideId: slideId || "", settings: next })
        if (!editSlide || !slideId) return
        const newData = { style: clone(next) }
        history({
            id: "slideStyle",
            oldData: { style: editSlide?.settings },
            newData,
            location: { page: "edit", show: currentActiveShow!, slide: slideId }
        })
    }

    function editTemplate(id: string) {
        activeEdit.set({ type: "template", id, items: [] })
        activePage.set("edit")
    }

    function editBackgroundImage() {
        const bgImage = settings.backgroundImage
        if (!bgImage) return
        activeEdit.set({ type: "media", id: bgImage, items: [] })
        activePage.set("edit")
    }

    const bgImage = settings.backgroundImage

    return (
        <div className={styles.tools}>
            <div>
                <ColorField label="edit.background_color" value={settings.color} onInput={(value) => update({ ...settings, color: value })} allowGradients allowEmpty noLabel />

                <InputRow>
                    <FileField label="edit.background_media" value={bgImage} filter={{ name: "Media files", extensions: mediaExtensions }} onChange={(value) => update({ ...settings, backgroundImage: (Array.isArray(value) ? value[0] : value) || "" })} allowEmpty />
                    {bgImage ? <Button title="titlebar.edit" icon="edit" onClick={editBackgroundImage} /> : null}
                </InputRow>

                <InputRow>
                    <PopupField label="show.slide_template" value={settings.template || ""} name={currentTemplates[settings.template || ""]?.name || ""} popupId="select_template" icon="templates" onChange={(value) => update({ ...settings, template: value || "" })} allowEmpty />
                    {settings.template && currentTemplates[settings.template] ? <Button title="titlebar.edit" icon="edit" onClick={() => editTemplate(settings.template || "")} /> : null}
                </InputRow>
            </div>

            <ItemsList allSlideItems={allSlideItems} />
        </div>
    )
}

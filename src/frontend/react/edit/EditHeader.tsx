import { useEffect, useState } from "react"
import { activeEdit, activePopup, editMode, groups, showsCache, slideNotesActive, special, templates } from "../../shared/core/stores"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { _show } from "../../shared/utils/helpers/shows"
import styles from "./EditHeader.module.css"

export interface EditHeaderProps {
    showId: string
    hideOptions?: boolean
}

export function EditHeader({ showId, hideOptions = false }: EditHeaderProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentEditMode = useStore(editMode)
    const currentGroups = useStore(groups)
    const currentShowsCache = useStore(showsCache)
    const currentSlideNotesActive = useStore(slideNotesActive)
    const currentSpecial = useStore(special)
    const currentTemplates = useStore(templates)

    const [showDropdown, setShowDropdown] = useState(false)

    const currentShow = currentShowsCache[showId]

    useEffect(() => {
        function mousedown(e: MouseEvent) {
            const target = e.target as HTMLElement | null
            if (!target?.closest(".showDropdown") && !target?.closest(".header .right")) setShowDropdown(false)
        }
        window.addEventListener("mousedown", mousedown)
        return () => window.removeEventListener("mousedown", mousedown)
    }, [])

    const ref = showId && currentShow ? getLayoutRef(showId) : []
    const slide = currentActiveEdit.slide !== null && currentActiveEdit.slide !== undefined && ref?.[currentActiveEdit.slide] ? _show(showId).slides([ref[currentActiveEdit.slide]?.id]).get()?.[0] : null

    const parentId = currentActiveEdit.slide !== null && currentActiveEdit.slide !== undefined && ref?.[currentActiveEdit.slide] ? ref[currentActiveEdit.slide]?.parent?.id || ref[currentActiveEdit.slide]?.id : ""
    const slideGroup = _show(showId).slides([parentId]).get()?.[0]?.globalGroup || ""
    const templateId = slide?.settings?.template || currentGroups[slideGroup]?.template || currentShow?.settings?.template || ""

    return (
        <div className={`header ${styles.header}`}>
            <div className={styles.name} data-title={currentShow?.name}>
                {currentShow?.name ? (
                    currentShow.name
                ) : (
                    <span style={{ opacity: 0.5, fontStyle: "italic" }}>
                        <T id="main.unnamed" />
                    </span>
                )}
            </div>

            {currentEditMode === "default" ? (
                <div className={`right ${styles.right}`}>
                    {templateId ? (
                        <Button style={{ width: "32px", height: "100%", padding: "0.3em 0.5em" }} title={`formats.template: <b>${currentTemplates[templateId]?.name || "info.template"}</b>`} onClick={() => activePopup.set("template_info")}>
                            <Icon size={0.8} id="templates" white />
                        </Button>
                    ) : null}

                    {!hideOptions ? (
                        <Button style={{ width: "32px", height: "100%", padding: "0.3em 0.5em", borderBottomRightRadius: "10px", ...(showDropdown ? {} : { opacity: 0.8 }) }} title="create_show.more_options" icon="more" onClick={() => setShowDropdown(!showDropdown)} white={!showDropdown}>
                            <span style={{ display: "none" }}></span>
                        </Button>
                    ) : null}

                    {showDropdown && currentShow ? (
                        <div className={`showDropdown ${styles.showDropdown}`} role="none" onClick={() => setShowDropdown(false)}>
                            <Button title="tooltip.notes" onClick={() => slideNotesActive.set(!currentSlideNotesActive)}>
                                <Icon id="notes" white={!currentSlideNotesActive} />
                                {currentSlideNotesActive ? <Icon id="check" size={0.7} white /> : null}
                                <p>
                                    <T id="items.slide_notes" />
                                </p>
                            </Button>

                            <div className={styles.DIVIDER}></div>

                            <Button title="timeline.toggle_timeline" onClick={() => special.update((a) => ({ ...a, slideTimelineActive: !a.slideTimelineActive }))}>
                                <Icon id="timeline" white={!currentSpecial.slideTimelineActive} />
                                {currentSpecial.slideTimelineActive ? <Icon id="check" size={0.7} white /> : null}
                                <p>
                                    <T id="timeline.toggle_timeline" />
                                </p>
                            </Button>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../IPC/main"
import { activeEdit, activePage, activePopup, autoOpenedTimeline, openToolsTab, outputs, showNotesActive, shows, showsCache, special, styles as stylesStore, templates } from "../../stores"
import { translateText } from "../../utils/language"
import { history } from "../../components/helpers/history"
import { allOutputsHasStyleTemplate, getFirstActiveOutput } from "../../components/helpers/output"
import { removeTemplatesFromShow } from "../../components/helpers/show"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import styles from "./ShowHeader.module.css"

interface NotesInfo {
    text: string
    id: string
    title: string
    icon: string
    tab: string
}

export interface ShowHeaderProps {
    showId: string
    hideOptions?: boolean
}

// (F24.20a).
export function ShowHeader({ showId, hideOptions = false }: ShowHeaderProps) {
    const currentShowsCache = useStore(showsCache)
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(stylesStore)
    const currentSpecial = useStore(special)
    const currentTemplates = useStore(templates)
    const currentShowNotesActive = useStore(showNotesActive)

    const currentShow = currentShowsCache[showId]
    const layouts = currentShow?.layouts
    const activeLayout = currentShow?.settings?.activeLayout || ""
    const slideCount = currentShow?.layouts?.[activeLayout]?.slides?.length ?? 0

    const [notes, setNotes] = useState<NotesInfo | null>(null)
    const [showDropdown, setShowDropdown] = useState(false)
    const [listScrollY] = useState(0)

    const referenceType = currentShow?.reference?.type
    const outputStyleId = getFirstActiveOutput(currentOutputs)?.style || ""
    const outputStyleTemplate = allOutputsHasStyleTemplate(referenceType === "scripture") ? currentStyles[outputStyleId]?.[referenceType === "scripture" ? "templateScripture" : "template"] || "" : ""
    const enableStylePreview = !!(outputStyleTemplate && currentSpecial.styleTemplatePreview !== false && currentTemplates[outputStyleTemplate])
    const showTemplateId = currentShow?.settings?.template || ""
    const showTemplateIcon = !!(showTemplateId && currentTemplates[showTemplateId])
    const enableShowTemplate = showTemplateIcon && (!referenceType || referenceType === "scripture" || showDropdown)

    function updateNotes() {
        setNotes(null)
        const metadataValues = Object.values(currentShow?.meta || {}).filter((value) => value !== currentShow?.name)
        const metadataText = metadataValues.reduce<string>((value, item) => value + item, "")
        if (metadataText.length) {
            const text = metadataValues
                .filter((value) => value?.length)
                .join("; ")
                .replaceAll("<br>", " ")
            setNotes({ text, id: "metadata", title: "tools.metadata", icon: "info", tab: "metadata" })
        }
    }

    useEffect(() => {
        updateNotes()
    }, [layouts, currentShow])

    function openTab(event: ReactMouseEvent<HTMLElement>, id: string) {
        const target = event.target as HTMLElement
        if (target?.closest("a")) {
            event.preventDefault()
            const url = target.closest("a")?.getAttribute("href") || ""
            sendMain(Main.URL, url)
            return
        }
        openToolsTab.set(id)
    }

    useEffect(() => {
        const mousedown = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (!target?.closest(".showDropdown") && !target?.closest(".header .right")) setShowDropdown(false)
        }
        window.addEventListener("mousedown", mousedown)
        return () => window.removeEventListener("mousedown", mousedown)
    }, [])

    function toggleShowLock() {
        const shouldBeLocked = !currentShow?.locked
        showsCache.update((all) => {
            if (!all[showId]) return all
            all[showId].locked = shouldBeLocked
            removeTemplatesFromShow(showId)
            return all
        })
        shows.update((all) => {
            if (shouldBeLocked) all[showId].locked = true
            else delete all[showId].locked
            return all
        })
    }

    return (
        <>
            <div className={`header ${styles.header} ${listScrollY > 0 ? styles.shadow : ""}`}>
                <div className={styles["name-notes"]} data-title={currentShow?.name}>
                    <Icon id="layout" size={0.9} white right />
                    <div className={styles.name}>
                        {currentShow?.name ? (
                            currentShow.name
                        ) : (
                            <span style={{ opacity: 0.5, fontStyle: "italic" }}>
                                <T id="main.unnamed" />
                            </span>
                        )}
                    </div>

                    {layouts && activeLayout ? <span className={styles.layout}>· {currentShow?.layouts?.[activeLayout]?.name || activeLayout}</span> : null}
                    {currentShow ? <span className={`${styles.layout} ${styles.count}`}>· {translateText(slideCount === 1 ? "ui.slide" : "ui.slides", null, [String(slideCount)])}</span> : null}

                    {notes ? (
                        <span className={styles.notes} role="none" data-title={translateText(notes.title)} onClick={(event) => openTab(event, notes?.tab || "")}>
                            <Icon id={notes.icon} size={0.8} right white />
                            <p dangerouslySetInnerHTML={{ __html: notes.text }} />
                        </span>
                    ) : null}
                </div>

                <div className={`right ${styles.right}`}>
                    {currentShow ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            title="new.slide"
                            onClick={() => {
                                if (currentShow?.locked) return
                                history({ id: "SLIDES" })
                                activeEdit.set({ type: "show", slide: 0, items: [] })
                                activePage.set("edit")
                            }}
                            disabled={!!currentShow?.locked}
                        >
                            <Icon id="add" size={0.9} white right />
                            <T id="new.slide" />
                        </Button>
                    ) : null}

                    {enableStylePreview ? (
                        <Button variant="ghost" size="icon" title={`formats.template: <b>${currentTemplates[outputStyleTemplate]?.name || ""}</b>`} onClick={() => activePopup.set("template_info")}>
                            <Icon size={0.8} id="styles" white />
                        </Button>
                    ) : enableShowTemplate ? (
                        <Button variant="ghost" size="icon" className="context #show_template" title={`formats.template: <b>${currentTemplates[showTemplateId]?.name || "info.template"}</b>`} onClick={() => activePopup.set("template_info")}>
                            <Icon size={0.8} id="templates" white />
                        </Button>
                    ) : null}

                    {!hideOptions ? (
                        <Button variant="ghost" size="icon" isActive={showDropdown} title="create_show.more_options" icon="more" onClick={() => setShowDropdown(!showDropdown)} white={!showDropdown}>
                            <span style={{ display: "none" }}></span>
                        </Button>
                    ) : null}

                    {showDropdown && currentShow ? (
                        <div className={styles.showDropdown} role="none" onClick={() => setShowDropdown(false)}>
                            <Button title="tooltip.notes" onClick={() => showNotesActive.set(!currentShowNotesActive)}>
                                <Icon id="notes" white={!currentShowNotesActive} />
                                {currentShowNotesActive ? <Icon id="check" size={0.7} white /> : null}
                                <p>
                                    <T id="tools.notes" />
                                </p>
                            </Button>

                            <div className={styles.DIVIDER}></div>

                            <Button
                                title="timeline.toggle_timeline"
                                onClick={() => {
                                    special.update((all) => ({ ...all, timelineActive: !all.timelineActive }))
                                    autoOpenedTimeline.set(false)
                                }}
                            >
                                <Icon id="timeline" white={!currentSpecial.timelineActive} />
                                {currentSpecial.timelineActive ? <Icon id="check" size={0.7} white /> : null}
                                <p>
                                    <T id="timeline.toggle_timeline" />
                                </p>
                            </Button>

                            <div className={styles.DIVIDER}></div>

                            <Button title="context.lockForChanges" onClick={toggleShowLock}>
                                <Icon id="lock" white={!currentShow.locked} />
                                {currentShow.locked ? <Icon id="check" size={0.7} white /> : null}
                                <p>
                                    <T id="context.lockForChanges" />
                                </p>
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>
        </>
    )
}

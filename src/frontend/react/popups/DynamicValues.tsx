import { useEffect, useRef, useState, type MouseEvent } from "react"
import { get } from "../../shared/core/lib/store"
import type { Line } from "../../../types/Show"
import { clone } from "../../shared/utils/helpers/array"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { dynamicValueText, getDynamicIds, replaceDynamicValues } from "../../shared/utils/helpers/showActions"
import { _show } from "../../shared/utils/helpers/shows"
import { activeEdit, activePage, activePopup, activeShow, activeStage, dynamicValuesRevealUsed, overlays, popupData, refreshEditSlide, showsCache, special, stageShows, templates } from "../../shared/core/stores"
import { formatSearch } from "../../shared/utils/search"
import { setPopupSubmit } from "../../shared/utils/popup"
import { T } from "../helpers/T"
import { triggerClickOnEnterSpace } from "../helpers/triggerClickOnEnterSpace"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { HRule } from "../ui/h-rule/HRule"
import { TextField } from "../ui/text-field/TextField"
import styles from "./DynamicValues.module.css"

// Port de components/main/popups/DynamicValues.svelte. Lee (al montar): popupData.obj (contextElem) y popupData.caret, special.disabledDynamicValues,
// dynamicValuesRevealUsed, activePage/activeEdit/templates (modo "scripture" de plantillas). Escribe: popupData = {} al montar, dynamicValuesRevealUsed (ojo),
// y al elegir un valor inserta `{id}` en el texto del cursor: stageShows[...].items[...] (stage), overlays[id].items / templates[id].items (con modified)
// o showsCache[show].slides[slide].items; luego refreshEditSlide = true y activePopup = null (con Ctrl se queda abierto y vacía la búsqueda).
// Enter aplica el primer resultado si hay búsqueda de 2+ letras. Cerrar sin elegir no escribe nada.
// Se conserva del Svelte: el `$: if (defaultValues) search()` (al cambiar la lista completa se vacía la búsqueda aplicada, aunque el campo conserve el texto: por eso
// la primera letra escrita con "ver todos" apagado reinicia la lista) y que `values.length` (un objeto) es siempre undefined, así que el vacío dice "empty.general".
// `caret.pos` se avanza en el mismo objeto de popupData.caret (varios valores seguidos con Ctrl).
type Group = { id: string }[]
type Groups = { [key: string]: Group }
type Mode = null | "scripture"
interface Caret {
    line?: number
    pos?: number
}
interface ItemWithLines {
    lines?: Line[]
}

const SEPARATORS = ["$", "timer_", "meta_", "rss_", "txt_", "project_", "time_", "show_", "slide_text", "exif_", "video_", "audio_", "scripture_", "interaction_"]

function getTitle(id: string) {
    const titles: { [key: string]: string } = {
        interaction_: "tabs.interactions",
        scripture_: "tabs.scripture",
        time_: "timer.time",
        project_: "guide_title.project",
        show_: "guide_title.show",
        slide_text: "edit.text",
        exif_: "items.image (EXIF)",
        video_: "edit.video",
        audio_: "tools.audio",
        meta_: "tools.metadata",
        timer_: "items.timer",
        rss_: "settings.rss",
        txt_: "settings.txt",
        $: "items.variable"
    }
    return titles[id] || ""
}

function getValues(mode: Mode, showAll: boolean): Groups {
    let list = getDynamicIds(false, mode, showAll).map((id) => ({ id }))

    // WIP organize better - and don't hide any values
    // _color is only for CSS "var(--slide-group-color)", but we should show them in a seperate way

    const isStage = get(activePage) === "stage"
    const hidden = ["slide_text", "slide_group_color", "slide_group_upcoming_color"]
    const nonStageHidden = ["show_text_full", "slide_group_text"]
    if (get(showsCache)[get(activeShow)?.id || ""]?.reference?.type !== "interaction") nonStageHidden.push("interaction_")
    const stageHidden = ["interaction_"]
    if (isStage) list = list.filter((a) => !hidden.includes(a.id) && !stageHidden.some((h) => a.id.startsWith(h)))
    else list = list.filter((a) => !hidden.includes(a.id) && !nonStageHidden.some((h) => a.id.startsWith(h)))

    let separatorId = ""
    // the ones that can have a custom name should be first (to prevent it from overwriting a category)
    const newList: Groups = {}
    list.forEach((value) => {
        const separator = SEPARATORS.find((a) => value.id.startsWith(a)) || ""
        if (separator && separatorId !== separator && separatorId !== "$" && !newList[separator]?.length) {
            separatorId = separator
            newList[separatorId] = []
        }

        if (hidden.includes(separatorId.slice(0, -1))) return

        newList[separatorId].push(value)
    })

    return newList
}

export function DynamicValues() {
    const obj = useRef<{ contextElem?: HTMLElement | null }>(get(popupData).obj || {})
    const caret = useRef<Caret>(get(popupData).caret || {})
    const hidden = useRef<string[]>(get(special).disabledDynamicValues || [])
    const [mode] = useState<Mode>(() => {
        const edit = get(activeEdit)
        const template = get(templates)[edit.id || ""]
        return get(activePage) === "edit" && edit.type === "template" && (template?.settings?.mode === "scripture" || template?.category === "scripture") ? "scripture" : null
    })

    const [showAll, setShowAll] = useState(() => get(dynamicValuesRevealUsed))
    const [defaultValues, setDefaultValues] = useState<Groups>(() => clone(getValues(mode, get(dynamicValuesRevealUsed))))
    const [searchedValues, setSearchedValues] = useState<Groups>(() => clone(defaultValues))
    const [searchValue, setSearchValue] = useState("")
    const [resetInput, setResetInput] = useState(false)
    const [updateDynamic, setUpdateDynamic] = useState(0)

    // custom ref
    const [ref] = useState(() => {
        const edit = get(activeEdit)
        return { showId: get(activeShow)?.id, layoutId: _show().get("settings.activeLayout"), slideIndex: edit.slide, type: get(activePage) === "stage" ? "stage" : edit.type || "show", id: edit.id, mode }
    })

    useEffect(() => {
        popupData.set({})
    }, [])

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    useEffect(() => {
        const dynamicInterval = setInterval(() => setUpdateDynamic((a) => a + 1), 1000)
        return () => clearInterval(dynamicInterval)
    }, [])

    // `$: if (defaultValues) search()`
    useEffect(() => {
        search("", defaultValues)
    }, [defaultValues])

    // Enter: aplica el primer resultado (se vuelve a registrar en cada render para ver la búsqueda actual)
    useEffect(() => setPopupSubmit(() => applyValue()))

    function toggleShowAll(): Groups {
        const next = !showAll
        const values = getValues(mode, next)
        const defaults = clone(values)
        setShowAll(next)
        setDefaultValues(defaults)
        dynamicValuesRevealUsed.set(next)
        return defaults
    }

    function search(value = "", defaults = defaultValues) {
        if (value.length && !showAll) defaults = toggleShowAll()

        const formatted = formatSearch(value.replaceAll(" ", "_"))
        setSearchValue(formatted)

        if (formatted.length < 2) {
            setSearchedValues(clone(defaults))
            return
        }

        setSearchedValues({
            search: Object.values(clone(defaults))
                .flat()
                .filter((a) => formatSearch(a.id).includes(formatted))
        })
    }

    function applyValue(e?: MouseEvent, id = "") {
        if (!id) {
            if (searchValue.length < 2) return
            id = Object.values(searchedValues)[0]?.[0]?.id
        }
        if (!id) return

        const contextElem = obj.current.contextElem || null
        const contextEditItem = contextElem?.closest(".editItem") as HTMLElement | null
        const isStage = !!contextElem?.closest(".stage_item")
        if (!contextEditItem && !isStage) return

        const edit = get(activeEdit)
        const selectedItemIndex = edit.items?.[0] ?? Number(contextEditItem?.getAttribute("data-index") || 0)

        function updateItemText<T extends ItemWithLines | ItemWithLines[]>(items: T): T {
            let replaced = false
            const caretLine = Number.isFinite(caret.current.line) ? (caret.current.line as number) : 0
            let caretPos = Number.isFinite(caret.current.pos) ? (caret.current.pos as number) : 0

            const lines = (Array.isArray(items) ? items[selectedItemIndex]?.lines : (items as ItemWithLines)?.lines) || []
            const lineIndex = lines[caretLine]?.text ? caretLine : 0

            lines[lineIndex]?.text?.forEach((text) => {
                if (replaced) return

                const value = text.value
                if (value.length < caretPos) {
                    caretPos -= value.length
                    return
                }

                const valueIdString = dynamicValueText(id)
                text.value = value.slice(0, caretPos) + valueIdString + value.slice(caretPos)
                replaced = true

                // if applying multiple
                caret.current.pos = caretPos + valueIdString.length
            })

            return items
        }

        function finish() {
            if (e?.ctrlKey) {
                setResetInput(true)
                setTimeout(() => setResetInput(false))
                setSearchValue("")
                search("")
            } else {
                activePopup.set(null)
            }
        }

        if (isStage) {
            const activeStageValue = get(activeStage)
            const activeItemId = activeStageValue?.items[0]
            if (!get(stageShows)[activeStageValue.id!] || !activeItemId) return

            stageShows.update((a) => {
                a[activeStageValue.id!].items[activeItemId] = updateItemText(a[activeStageValue.id!]?.items[activeItemId])
                a[activeStageValue.id!].modified = Date.now()
                return a
            })

            refreshEditSlide.set(true)
            finish()
            return
        }

        if (edit.id) {
            if (edit.type === "overlay") {
                overlays.update((a) => {
                    a[edit.id!].items = updateItemText(a[edit.id!].items)
                    a[edit.id!].modified = Date.now()
                    return a
                })
            } else if (edit.type === "template") {
                templates.update((a) => {
                    a[edit.id!].items = updateItemText(a[edit.id!].items)
                    a[edit.id!].modified = Date.now()
                    return a
                })
            }

            refreshEditSlide.set(true)
            finish()
            return
        }

        const showId = get(activeShow)?.id || ""
        const layoutRef = getLayoutRef(showId)
        const slideId = layoutRef[edit.slide || 0]?.id || ""

        showsCache.update((a) => {
            if (!a[showId]?.slides?.[slideId]) return a

            a[showId].slides[slideId].items = updateItemText(a[showId].slides[slideId].items)
            return a
        })

        refreshEditSlide.set(true)
        finish()
    }

    return (
        <>
            <Button className="popup-reset" icon="edit" iconSize={1.1} title="create_show.more_options" onClick={() => activePopup.set("manage_dynamic_values")} white />

            <Button className={`popup-options ${showAll ? "active" : ""}`} icon={showAll ? "eye" : "hide"} iconSize={1.3} title={showAll ? "actions.close" : "create_show.more_options"} onClick={toggleShowAll} white />

            <TextField key={String(resetInput)} label="main.search" value="" onInput={(value) => search(value ?? "")} autofocus />

            <div style={{ position: "relative", height: "100%", width: "calc(100vw - (var(--navigation-width) + 20px) * 2)", overflowY: "auto" }}>
                {Object.values(searchedValues)[0]?.length ? (
                    <div className={styles.list} style={searchValue.length > 1 ? { marginTop: "10px" } : undefined}>
                        {Object.entries(searchedValues).map(([key, values]) => (
                            <div key={key} style={{ display: "contents" }}>
                                {key !== "search" && !hidden.current.includes(key.slice(0, -1)) ? <HRule title={getTitle(key)} /> : null}

                                <div className={styles.grid}>
                                    {values.map((value, i) => {
                                        const preview = replaceDynamicValues(`{${value.id}}`, ref, updateDynamic, true)
                                        return (
                                            <div key={i} className={`${styles.value} ${searchValue.length > 1 && i === 0 ? styles.active : ""}`} role="button" tabIndex={0} onClick={(e) => applyValue(e, value.id)} onKeyDown={triggerClickOnEnterSpace}>
                                                {preview ? <p className={styles.preview} dangerouslySetInnerHTML={{ __html: preview }} /> : <p className={styles.preview}>—</p>}

                                                <p style={{ display: "inline-flex" }} data-title={value.id}>
                                                    <span style={{ color: "var(--secondary)" }}>{"{"}</span>
                                                    {value.id.startsWith("$") ? (
                                                        <>
                                                            <span style={{ color: "var(--secondary)" }}>{"$"}</span>
                                                            {value.id.slice(1)}
                                                        </>
                                                    ) : (
                                                        value.id
                                                    )}
                                                    <span style={{ color: "var(--secondary)" }}>{"}"}</span>
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Center size={1.2} faded style={{ height: "100px", paddingTop: "20px" }}>
                        {/* `values.length` del Svelte (un objeto) siempre es undefined: el vacío es siempre "empty.general" */}
                        <T id="empty.general" />
                    </Center>
                )}
            </div>
        </>
    )
}

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react"
import type { ShowList } from "../../../../types/Show"
import { ShowObj } from "../../../classes/Show"
import { activeEdit, activeFocus, activePopup, activeProfile, activeProject, activeShow, activeTagFilter, categories, drawer, focusedArea, focusMode, labelsDisabled, profiles, shows, sorted, sortedShowsList } from "../../../stores"
import { translateText } from "../../../utils/language"
import { getAccess } from "../../../utils/profile"
import { clone } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { updateShowsList } from "../../../components/helpers/show"
import { dateToString } from "../../../components/helpers/time"
import { T } from "../../helpers/T"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { ShowButton } from "../../show/ShowButton"
import { Autoscroll } from "../../system/Autoscroll"
import { Center } from "../../system/Center"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { VirtualList } from "../VirtualList"
import styles from "./Shows.module.css"

// Port de components/drawer/pages/Shows.svelte: lista virtualizada de shows con orden por columnas y filtro por etiquetas.
// ShowButton ya es React: se importa directamente. El `<div on:click>` que abría el popup al tocar el fondo no traía
// `detail` de botón (`e.detail` nativo es un número), así que ese camino siempre abre el popup igual.
export interface ShowsProps {
    active: string | null
}

interface SortHeader {
    id: "name" | "number" | "modified"
    style: CSSProperties
    label: string
    asc: string
    desc: string
    default: "asc" | "desc"
}

function filterByTags(list: ShowList[], tags: string[]): ShowList[] {
    if (!tags.length) return list
    return list.filter((a) => !tags.find((tagId) => !a.quickAccess?.tags?.includes(tagId)))
}

function filteredByCategory(allShows: ShowList[], active: string | null, categoriesValue: Record<string, unknown>, profile: Record<string, string | undefined>): ShowList[] {
    if (active === "all") return allShows.filter((a) => !(categoriesValue[a?.category || ""] as { isArchive?: boolean } | undefined)?.isArchive && profile[a?.category || ""] !== "none")
    if (active === "locked") return allShows.filter((a) => a.locked)
    return allShows.filter((s) => profile[s?.category || ""] !== "none" && (active === s.category || (active === "unlabeled" && (s.category === null || !categoriesValue[s.category]))))
}

function sortTypeOf(value: unknown): string {
    if (typeof value !== "object" || value === null || !("shows" in value)) return "name"
    const showsData = (value as { shows?: unknown }).shows
    if (typeof showsData !== "object" || showsData === null || !("type" in showsData)) return "name"
    const type = (showsData as { type?: unknown }).type
    return typeof type === "string" && type ? type : "name"
}

function secondaryText(show: ShowList, sortType: string): string {
    const timestamps = show.timestamps as unknown as Record<string, unknown> | undefined
    const raw = timestamps?.[sortType.replace("_old", "")] || timestamps?.modified || timestamps?.created || ""
    const value = typeof raw === "string" || typeof raw === "number" || raw instanceof Date ? raw : ""
    return dateToString(value, true)
}

export function Shows({ active }: ShowsProps) {
    const showsSorted = useStore(sortedShowsList)
    const categoriesValue = useStore(categories)
    const drawerValue = useStore(drawer)
    const activeProfileValue = useStore(activeProfile)
    const activeTagFilterValue = useStore(activeTagFilter)
    const sortedValue = useStore(sorted)
    const showsValue = useStore(shows)
    const activeShowValue = useStore(activeShow)
    const activeEditValue = useStore(activeEdit)
    const activeProjectValue = useStore(activeProject)
    const focusModeValue = useStore(focusMode)
    const labelsDisabledValue = useStore(labelsDisabled)
    useStore(profiles)

    const profile = (activeProfileValue ? getAccess("shows") : {}) as Record<string, string | undefined>
    const readOnly = profile.global === "read"

    const filteredStored = filteredByCategory(showsSorted, active, categoriesValue, profile)
    const drawerIsClosed = drawerValue.height <= 40

    // filteredShows se recalcula sólo con el cajón abierto: los cambios hechos con el cajón cerrado se aplican al abrirlo.
    const shouldUpdate = useRef(false)
    const filteredStoredRef = useRef(filteredStored)
    filteredStoredRef.current = filteredStored
    const [filteredShows, setFilteredShows] = useState<ShowList[]>(() => filterByTags(filteredStored, activeTagFilterValue))

    useEffect(() => {
        if (drawerIsClosed) {
            shouldUpdate.current = true
            return
        }

        shouldUpdate.current = false
        setFilteredShows(filterByTags(clone(filteredStoredRef.current), activeTagFilterValue))
    }, [active, showsSorted, categoriesValue, activeProfileValue, activeTagFilterValue, drawerIsClosed])

    // <svelte:window on:keydown={keydown} />
    useEffect(() => {
        function keydown(e: KeyboardEvent) {
            const target = e.target instanceof Element ? e.target : null
            if (target?.closest("input") || target?.closest(".edit") || (!e.ctrlKey && !e.metaKey) || !filteredShows.length) return
            if (activeEditValue.items.length) return

            let id = ""
            const activeShowData = activeShowValue
            if (e.key === "ArrowRight") {
                if (!activeShowData || (activeShowData.type !== undefined && activeShowData.type !== "show")) id = filteredShows[0].id
                else {
                    const currentIndex = filteredShows.findIndex((a) => a.id === activeShowData.id)
                    if (currentIndex < filteredShows.length - 1) id = filteredShows[currentIndex + 1].id
                }
            } else if (e.key === "ArrowLeft") {
                if (!activeShowData || (activeShowData.type !== undefined && activeShowData.type !== "show")) id = filteredShows[filteredShows.length - 1].id
                else {
                    const currentIndex = filteredShows.findIndex((a) => a.id === activeShowData.id)
                    if (currentIndex > 0) id = filteredShows[currentIndex - 1].id
                }
            }

            if (!id) return
            if (focusModeValue) activeFocus.set({ id, type: "show" })
            else activeShow.set({ id, type: "show" })
        }

        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [filteredShows, activeShowValue, activeEditValue, focusModeValue])

    const showWithNumber = filteredShows.some((a) => a.quickAccess?.number)
    const sortType = sortTypeOf(sortedValue)
    const modifiedType = ["modified", "created", "used"].includes(sortType.replace("_old", "")) ? sortType.replace("_old", "") : "modified"
    const sortHeaders: SortHeader[] = [
        { id: "name", style: { flex: 1 }, label: translateText("show.name"), asc: "name", desc: "name_des", default: "asc" },
        ...(showWithNumber ? [{ id: "number" as const, style: { minWidth: "var(--number-width)" }, label: translateText("meta.number"), asc: "number", desc: "number_des", default: "asc" as const }] : []),
        { id: "modified", style: { minWidth: "var(--modified-width)" }, label: translateText(`info.${modifiedType}`), asc: `${modifiedType}_old`, desc: modifiedType, default: "desc" }
    ]

    function toggleSort(columnId: SortHeader["id"]) {
        const definition = sortHeaders.find((header) => header.id === columnId)
        if (!definition) return

        const currentType = sortTypeOf(sortedValue)
        let nextType = definition.default === "desc" ? definition.desc : definition.asc
        if (currentType === definition.asc) nextType = definition.desc
        else if (currentType === definition.desc) nextType = definition.asc

        sorted.update((state) => {
            if (!state.shows) state.shows = {}
            state.shows.type = nextType
            return state
        })

        updateShowsList(showsValue)
    }

    function createShow(ctrl: boolean) {
        if (ctrl) {
            const show = new ShowObj()
            const selectedIndex = activeShowValue?.index === undefined ? undefined : activeShowValue.index + 1
            history({ id: "UPDATE", newData: { data: show, remember: { project: activeProjectValue, index: selectedIndex } }, location: { page: "show", id: "show" } })
        } else {
            activePopup.set("show")
        }
    }

    // El fondo del FloatingBar abría el popup: los clics sobre el botón los maneja el Button.
    function createShowFromBorder(e: ReactMouseEvent<HTMLDivElement>) {
        const target = e.target instanceof Element ? e.target : null
        if (target?.closest("button")) return
        createShow(false)
    }

    const showWithNonExistentCategory = active === "unlabeled" && filteredStored.some((s) => s.category)
    function createNonExistentCategories() {
        const nonexistentCategories = [...new Set(filteredStored.map((s) => s.category))] as string[]

        categories.update((a) => {
            nonexistentCategories.forEach((id) => {
                if (a[id]) return
                a[id] = { name: translateText("main.unnamed") }
            })
            return a
        })
    }

    return (
        <>
            <Autoscroll style={{ overflowY: "auto", flex: 1 }}>
                <div className={`${styles.column} ${readOnly ? "" : "context #drawer_show"}`} onMouseUp={() => focusedArea.set("show_drawer")}>
                    {filteredShows.length ? (
                        <>
                            <div className={styles.sortHeader} role="group">
                                {sortHeaders.map((header) => {
                                    const direction = sortType === header.asc ? "asc" : sortType === header.desc ? "desc" : ""
                                    const isActive = direction !== ""

                                    return (
                                        <Button key={header.id} style={header.style} isActive={isActive} onClick={() => toggleSort(header.id)} title={header.label}>
                                            <p>{header.label}</p>
                                            {direction ? (
                                                <span className={styles.sortIndicator}>
                                                    <Icon id={direction === "asc" ? "arrow_down" : "arrow_up"} size={1.3} white />
                                                </span>
                                            ) : null}
                                        </Button>
                                    )
                                })}
                            </div>

                            {/* reload list when changing category */}
                            <VirtualList
                                key={active ?? "null"}
                                items={filteredShows}
                                className={styles.list}
                                activeIndex={filteredShows.findIndex((a) => a.id === activeShowValue?.id)}
                                render={(show) => (
                                    <SelectElem id="show_drawer" data={{ id: show.id }} shiftRange={filteredShows} draggable>
                                        <ShowButton id={show.id} show={show} data={secondaryText(show, sortType)} className="#drawer_show_button" />
                                    </SelectElem>
                                )}
                            />
                        </>
                    ) : (
                        <Center size={1.2} faded>
                            <T id="empty.shows" />
                        </Center>
                    )}
                </div>
            </Autoscroll>

            {showWithNonExistentCategory ? (
                <FloatingBar side="left" onlyOne>
                    <Button onClick={createNonExistentCategories}>
                        <Icon id="autofill" />
                        <T id="category.create_nonexistent" />
                    </Button>
                </FloatingBar>
            ) : active === "all" && filteredShows.length < 20 ? (
                <FloatingBar side="left" onlyOne>
                    <Button variant="outline" title="actions.import [Ctrl+I]" onClick={() => activePopup.set("import")}>
                        <Icon id="import" />
                        <T id="actions.import" />
                    </Button>
                </FloatingBar>
            ) : null}

            <FloatingBar onlyOne>
                <div role="none" className="overflow-interact" onClick={createShowFromBorder}>
                    <Button icon="add" className="context #drawer_new_show" title="tooltip.show [Ctrl+N]" disabled={readOnly} onClick={(detail) => createShow(detail.ctrl)} white>
                        {!labelsDisabledValue ? <T id="new.show" /> : null}
                    </Button>
                </div>
            </FloatingBar>
        </>
    )
}

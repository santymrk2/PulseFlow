import type { ShowList } from "../../../../types/Show"
import { dateToString } from "../../../components/helpers/time"
import { cn } from "../../../shared/core/lib/utils"
import { activeShow, focusedArea, sorted } from "../../../shared/core/stores"
import { VirtualList } from "../../drawer/VirtualList"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { ShowButton } from "../ShowButton"
import { Center } from "../../system/Center"
import { SelectElem } from "../../system/SelectElem"
import styles from "./LibraryShowList.module.css"

// Port de components/show/left/LibraryShowList.svelte: lista de shows de una biblioteca, sin columnas de orden.
// ShowButton ya es React: se importa directamente. El texto secundario usa el mismo sortType del store `sorted`.
export interface LibraryShowListProps {
    shows: ShowList[]
    searching?: boolean
}

interface SortedShows {
    type?: string
}

function sortTypeOf(value: unknown): string {
    if (typeof value !== "object" || value === null || !("shows" in value)) return "name"
    const shows = (value as { shows?: unknown }).shows
    if (typeof shows !== "object" || shows === null || !("type" in shows)) return "name"
    const type = (shows as SortedShows).type
    return typeof type === "string" && type ? type : "name"
}

function secondaryText(show: ShowList, sortType: string): string {
    const timestamps = show.timestamps as unknown as Record<string, unknown> | undefined
    const raw = timestamps?.[sortType.replace("_old", "")] || timestamps?.modified || timestamps?.created || ""
    const value = typeof raw === "string" || typeof raw === "number" || raw instanceof Date ? raw : ""
    return dateToString(value, true)
}

export function LibraryShowList({ shows, searching = false }: LibraryShowListProps) {
    const sortedValue = useStore(sorted) as unknown
    const currentShow = useStore(activeShow)
    const sortType = sortTypeOf(sortedValue)
    const activeIndex = shows.findIndex((a) => a.id === currentShow?.id)

    return (
        <div className={cn("list", styles.list, "context #drawer_show")} role="none" onMouseUp={() => focusedArea.set("show_drawer")}>
            {shows.length ? (
                <VirtualList
                    items={shows}
                    activeIndex={activeIndex}
                    render={(show) => (
                        <SelectElem id="show_drawer" data={{ id: show.id }} shiftRange={shows} draggable>
                            <ShowButton id={show.id} show={show} data={secondaryText(show, sortType)} className="#drawer_show_button" />
                        </SelectElem>
                    )}
                />
            ) : (
                <Center size={1} faded>
                    {searching ? <T id="ui.no_results" /> : <T id="empty.shows" />}
                </Center>
            )}
        </div>
    )
}

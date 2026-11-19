import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { ShowList } from "../../../types/Show"
import { clone, keysToID, sortByName } from "../../components/helpers/array"
import { activePopup, popupData, shows, sortedShowsList } from "../../shared/core/stores"
import { formatSearch, showSearch } from "../../utils/search"
import { VirtualList } from "../drawer/VirtualList"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { TextField } from "../ui/text-field/TextField"
import styles from "./SelectShow.module.css"

// Port de components/main/popups/SelectShow.svelte. Lee: sortedShowsList, shows, popupData (active, action, trigger, revert).
// Escribe: el trigger con el id del show (o popupData.showId) y activePopup = popupData.revert.
// VirtualList, TextField, Icon, Button y Center ya son React; no quedan islas Svelte.
export function SelectShow() {
    const sortedShowsValue = useStore(sortedShowsList)
    const showsValue = useStore(shows)
    const popupDataValue = useStore(popupData)
    const [showPrivate] = useState(false)
    const [searchValue, setSearchValue] = useState("")
    const [searchedShows, setSearchedShows] = useState<ShowList[]>(() => clone(get(sortedShowsList)))

    const privateShows = sortByName(keysToID(showsValue).filter((a) => a.private === true))
    const defaultShows = clone<ShowList[]>([...(showPrivate ? privateShows : []), ...sortedShowsValue])
    const active = (popupDataValue.active || "") as string

    function search(value: string) {
        setSearchValue(value || "")

        if (formatSearch(value || "").trim().length < 2) {
            setSearchedShows(clone(defaultShows))
            return
        }

        setSearchedShows(showSearch(value || "", defaultShows))

        document.querySelector("svelte-virtual-list-viewport")?.scrollTo(0, 0)
    }

    // `$: if (defaultShows) search(searchValue)` — el valor de búsqueda se toma del render actual, no dispara el efecto.
    useEffect(() => {
        search(searchValue)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showPrivate, sortedShowsValue, showsValue])

    function selectShow(show: ShowList) {
        const data = get(popupData)
        if (data.action !== "select_show") return

        if (data.trigger) data.trigger(show.id)
        else popupData.set({ ...data, showId: show.id })

        activePopup.set(data.revert || null)
    }

    return (
        <>
            <TextField label="main.search" value="" onInput={(value) => search(value || "")} autofocus />

            <div className={styles.list}>
                {sortedShowsValue.length ? (
                    formatSearch(searchValue).trim().length > 1 && searchedShows.length === 0 ? (
                        <Center size={1.2} faded>
                            <T id="empty.search" />
                        </Center>
                    ) : (
                        <VirtualList
                            items={searchedShows}
                            render={(show) => (
                                <Button isActive={active === show.id} style={{ width: "100%", fontWeight: "normal", justifyContent: "start", padding: "4px 12px" }} onClick={() => selectShow(show)}>
                                    {show.private ? <Icon id="locked" right /> : null}
                                    {show.name}
                                </Button>
                            )}
                        />
                    )
                ) : (
                    <Center size={1.2} faded>
                        <T id="empty.shows" />
                    </Center>
                )}
            </div>
        </>
    )
}

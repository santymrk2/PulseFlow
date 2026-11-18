import { useEffect, useState } from "react"
import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import { Loader } from "../main/Loader"
import { destroyMain, receiveMain, requestMain, sendMain } from "../../IPC/main"
import { activePage, activePopup, deletedShows, popupData, shows, showsCache } from "../../stores"
import { T } from "../helpers/T"
import { useFreshStore } from "../hooks/useFreshStore"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { Center } from "../system/Center"
import styles from "./CleaningUtility.module.css"

// Port de components/main/popups/CleaningUtility.svelte. Lee: popupData.type (al montar), shows, showsCache, deletedShows.
// Escribe: popupData = {} al montar (y { id: "delete_duplicated_shows", data } al abrir ese popup), activePage = "show", activePopup = "delete_duplicated_shows".
// IPC: FULL_SHOWS_LIST (envío + receptor, que se quita al desmontar), GET_EMPTY_SHOWS ({ cached }, 60 s), DELETE_SHOWS_NI ({ shows }), DELETE_SHOWS ({ shows: vacíos }).
// Loader es el port React. Las listas no tenían key en el Svelte: se usa la posición.
interface EmptyShow {
    id: string
    name: string
}
interface DuplicatedShows {
    ids: string[]
}

function findDuplicatedShows(): DuplicatedShows[] {
    const names: Record<string, string[]> = {}
    Object.entries(get(shows)).forEach(([id, show]) => {
        if (!show?.name) return
        // remove any numbers (less than 4 chars) at the end of name (but not if "1-3"|"-5" in case of scripture)
        const trimmedName = show.name
            .toLowerCase()
            .replace(/(?<![-\d])\d{1,3}$/, "")
            .trim()
        if (!trimmedName.length) return

        if (names[trimmedName]) names[trimmedName].push(id)
        else names[trimmedName] = [id]
    })

    return Object.values(names)
        .filter((a) => a.length > 1)
        .map((ids) => ({ ids }))
}

// delete shows from folder that are not indexed
function deleteBrokenShows() {
    sendMain(Main.DELETE_SHOWS_NI, { shows: get(shows) })

    setTimeout(() => {
        // this will not include newly created shows not saved yet, but it should not be an issue.
        sendMain(Main.FULL_SHOWS_LIST)
    }, 800)
}

export function CleaningUtility() {
    const [type] = useState<string | undefined>(() => get(popupData).type)
    const showsValue = useFreshStore(shows)

    const [loadingEmpty, setLoadingEmpty] = useState(false)
    const [allShowsInFolder, setAllShowsInFolder] = useState<string[]>([])
    const [emptyShows, setEmptyShows] = useState<EmptyShow[]>([])
    const [duplicatedShows, setDuplicatedShows] = useState<DuplicatedShows[]>([])

    useEffect(() => {
        // el receptor se registra antes de pedir la lista, como en el Svelte (script antes de onMount)
        const listenerId = receiveMain(Main.FULL_SHOWS_LIST, (data) => {
            const deletedShowNames = get(deletedShows).map((a) => a.name + ".show")
            setAllShowsInFolder((data || []).filter((name: string) => !deletedShowNames.includes(name)))
        })

        popupData.set({})

        sendMain(Main.FULL_SHOWS_LIST)

        setLoadingEmpty(true)
        requestMain(
            Main.GET_EMPTY_SHOWS,
            { cached: get(showsCache) },
            (a) => {
                if (a) setEmptyShows(a)
                setLoadingEmpty(false)
            },
            60000
        )

        setDuplicatedShows(findDuplicatedShows())

        return () => destroyMain(listenerId)
    }, [])

    function deleteEmptyShows() {
        sendMain(Main.DELETE_SHOWS, { shows: emptyShows })
        activePage.set("show")
    }

    function deleteDuplicatedShows() {
        popupData.set({ id: "delete_duplicated_shows", data: duplicatedShows })
        activePopup.set("delete_duplicated_shows")
    }

    if (type !== "shows") return null

    const notIndexed = allShowsInFolder.length - Object.keys(showsValue).length

    if (!(notIndexed > 0 || emptyShows.length || duplicatedShows.length)) {
        return (
            <Center faded>
                <T id="empty.search" /> :D
            </Center>
        )
    }

    return (
        <div className={styles.list}>
            {/* USED TO DELETE "BROKEN" SHOWS */}
            {notIndexed > 0 ? (
                <InputRow>
                    <Button style={{ width: "100%" }} icon="delete" info={"" + notIndexed} onClick={deleteBrokenShows} red white>
                        <T id="actions.delete_shows_not_indexed" />
                    </Button>
                </InputRow>
            ) : null}

            {/* DELETE EMPTY SHOWS */}
            {emptyShows.length ? (
                <InputRow
                    arrow
                    menu={
                        <div>
                            <ul style={{ listStylePosition: "inside", marginLeft: "20px" }}>
                                {emptyShows.map((show, i) => (
                                    <li key={i}>{show.name}</li>
                                ))}
                            </ul>
                        </div>
                    }
                >
                    <Button style={{ width: "100%" }} icon="delete" info={"" + emptyShows.length} onClick={deleteEmptyShows} red white>
                        <T id="actions.delete_empty_shows" />
                    </Button>
                </InputRow>
            ) : loadingEmpty ? (
                <Center padding={10}>
                    <Loader />
                </Center>
            ) : null}

            {/* REMOVE DUPLICATED SHOWS */}
            {duplicatedShows.length ? (
                <InputRow>
                    <Button style={{ width: "100%" }} icon="launch" info={"" + duplicatedShows.length} onClick={deleteDuplicatedShows} white>
                        <T id="popup.delete_duplicated_shows" />
                    </Button>
                </InputRow>
            ) : null}
        </div>
    )
}

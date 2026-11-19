import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { Main } from "../../../types/IPC/Main"
import type { LyricSearchResult } from "../../../types/Main"
import { Loader } from "../../app/main/Loader"
import { destroyMain, receiveMain, sendMain } from "../../shared/core/ipc/main"
import { special } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { translateText } from "../../shared/utils/language"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"
import { Center } from "../../shared/ui/system/Center"
import styles from "./WebSearch.module.css"

// Port de components/main/popups/createShow/WebSearch.svelte. Lee y escribe `special.blockedArtists`;
// IPC: SEARCH_LYRICS (pedido y receptor) y GET_LYRICS (pedido y receptor), con ambos receptores dados de baja al desmontar.
// `update` (antes `dispatch("update")`) entrega la letra elegida o "" cuando no hay resultados/letra. Loader es el port React.
export interface LyricData {
    lyrics: string
    source: string
    title: string
    artist: string
}

export interface WebSearchProps {
    query: string
    onUpdate: (data: LyricData | "") => void
}

// encode using btoa()
const blockedWords = ["ZnVjaw==", "Yml0Y2g=", "bmlnZ2E="]
const blockedArtists = ["R2hvc3Q=", "R2VuZXNpcw==", "QUMvREM=", "RGlzdHVyYmVk", "Qm9iIFJpdmVycw==", "Q2FyeSBBbm4gSGVhcnN0"]

export function WebSearch({ query, onUpdate }: WebSearchProps) {
    const [songs, setSongs] = useState<LyricSearchResult[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [tempBlocked, setTempBlocked] = useState<string[]>([])

    // los callbacks de islas/IPC leen siempre la última versión de las props
    const live = useRef(onUpdate)
    useEffect(() => {
        live.current = onUpdate
    })

    function setValue(data: LyricData | "") {
        live.current(data)
    }

    function searchLyrics() {
        const artist = ""
        const title = query
        if (!title) {
            newToast("toast.no_name")
            return
        }

        sendMain(Main.SEARCH_LYRICS, { artist, title })
        setLoading(true)
    }

    function getLyrics(song: LyricSearchResult) {
        sendMain(Main.GET_LYRICS, { song })
        setLoading(true)
    }

    function filterBadArtists(data: LyricSearchResult[]) {
        return data.filter(
            (a) =>
                !blockedArtists.find((eArtist) => {
                    const artist = atob(eArtist)
                    return !!a.artist && a.artist === artist
                }) && !(get(special).blockedArtists || []).includes(a.artist)
        )
    }

    function blockArtist(artist: string) {
        const undo = tempBlocked.includes(artist)

        special.update((a) => {
            if (!a.blockedArtists) a.blockedArtists = []

            if (undo) {
                const index = a.blockedArtists.indexOf(artist)
                if (index > -1) a.blockedArtists.splice(index, 1)
            } else {
                a.blockedArtists.push(artist)
            }

            return a
        })

        setTempBlocked((current) => {
            if (!current.includes(artist)) return [...current, artist]
            return current.filter((item) => item !== artist)
        })
    }

    useEffect(() => {
        // los receptores se registran antes del pedido, como en el script del Svelte (antes de onMount)
        const listenerIdSearch = receiveMain(Main.SEARCH_LYRICS, (data: LyricSearchResult[]) => {
            const filtered = filterBadArtists(data)

            if (!filtered.length) {
                newToast("empty.search")
                setValue("")
            }

            setLoading(false)
            setSongs(filtered)
        })
        const listenerIdLyrics = receiveMain(Main.GET_LYRICS, (data: LyricData) => {
            setLoading(false)

            // filter out songs with bad words
            blockedWords.forEach((eWord) => {
                const word = atob(eWord)
                if (data.lyrics.includes(word)) data.lyrics = ""
            })

            if (!data.lyrics) {
                newToast("toast.lyrics_undefined")
                setValue("")
                return
            }

            setValue(data)
            newToast(translateText(`toast.lyrics_copied ${data.source}!`))
        })

        searchLyrics()

        return () => {
            destroyMain(listenerIdSearch)
            destroyMain(listenerIdLyrics)
        }
    }, [])

    if (loading) {
        return (
            <Center style={{ overflow: "hidden" }}>
                <Loader />
            </Center>
        )
    }

    if (songs !== null) {
        return (
            <>
                <div className={styles.header}>
                    <Icon id="search" white right />
                    <T id="create_show.search_results" />
                </div>

                <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex" }}>
                    <table className={styles.searchResultTable}>
                        <thead>
                            <tr>
                                <th>
                                    <T id="show.song" />
                                </th>
                                <th>
                                    <T id="show.artist" />
                                </th>
                                <th>
                                    <T id="show.source" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {songs ? (
                                songs.map((song, index) => {
                                    const blocked = tempBlocked.includes(song.artist)
                                    return (
                                        <tr
                                            key={index}
                                            onClick={(e) => {
                                                const target = e.target instanceof Element ? e.target : null
                                                if (target?.closest("button") || target?.closest("path")) return
                                                getLyrics(song)
                                            }}
                                        >
                                            <td className={styles.title}>{song.title}</td>
                                            <td className={styles["flex-table"]} style={blocked ? { textDecoration: "line-through" } : undefined}>
                                                {song.artist}
                                                {song.artist && song.source !== "Hymnary" ? (
                                                    <Button align="start" title={translateText(blocked ? "actions.undo" : "create_show.block")} style={{ padding: "2px" }} onClick={() => blockArtist(song.artist)}>
                                                        <Icon style={{ opacity: 0.4 }} id={blocked ? "undo" : "block"} white />
                                                    </Button>
                                                ) : null}
                                            </td>
                                            <td>{song.source}</td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={3}>No songs found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </>
        )
    }

    return null
}

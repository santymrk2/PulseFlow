import { Fragment, useRef, useState } from "react"
import { get } from "../../lib/store"
import type { Show } from "../../../types/Show"
import { getTextLines } from "../../components/edit/scripts/textStyle"
import { history } from "../../components/helpers/history"
import { loadShows } from "../../components/helpers/setShow"
import { dateToString } from "../../components/helpers/time"
import { Loader } from "../main/Loader"
import { activePopup, popupData, shows, showsCache } from "../../stores"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { HRule } from "../ui/h-rule/HRule"
import { InputRow } from "../ui/input-row/InputRow"
import { TextareaField } from "../ui/textarea-field/TextareaField"
import styles from "./DeleteDuplicatedShows.module.css"

// Port de components/main/popups/DeleteDuplicatedShows.svelte (lo abre CleaningUtility con popupData = { id, data: [{ ids }] }).
// Lee: popupData.data (una vez), shows (nombres, fechas, modificado/creado) y showsCache (texto, tras loadShows).
// Escribe (nunca borra directo): history SHOWS { oldData: { data: [{ id }] } } con los ids a borrar, por los botones "iguales", "conservar última", "conservar primera" o "borrar" del modo manual;
// después cierra el popup a los 500 ms si sigue siendo este (el timeout no se cancela al desmontar, como el Svelte). Cerrar sin elegir no borra nada.
// El Svelte mutaba `data` (alias de popupData.data) al borrar en modo manual; aquí se trabaja sobre una copia de los grupos: popupData.data ya no cambia
// (sólo se lee al abrir, y CleaningUtility lo reescribe al volver a abrirlo). "oldest"/"newest" se calculan una vez, al montar.
// Loader es el port React. Las filas del modo manual y las listas desplegables van con key por posición/id, como el original sin key.
type Group = { ids: string[] }

function getShowText(show: Show | undefined) {
    if (!show) return ""

    const texts: string[] = []
    Object.values(show.slides || {}).forEach((slide) => {
        texts.push(getTextLines(slide).join("\n"))
    })

    return texts.join("\n\n")
}

function deleteShows(ids: string[]) {
    const data = ids.map((id) => ({ id }))
    history({ id: "SHOWS", oldData: { data }, location: { page: "drawer" } })
}

function close() {
    // give time for deletion to run
    setTimeout(() => {
        if (get(activePopup) === "delete_duplicated_shows") activePopup.set(null)
    }, 500)
}

function getOldestShows(data: Group[]) {
    const allShows = get(shows)
    const deleteIds: string[] = []

    data.forEach(({ ids }) => {
        let keepId = ""

        ids.forEach((id) => {
            const show = allShows[id]
            if (!show) return

            const compareShow = allShows[keepId]
            if (!compareShow) {
                keepId = id
                return
            }

            const first = show.timestamps?.modified || 0
            const second = compareShow.timestamps?.modified || 0
            if (first > second) keepId = id
        })

        deleteIds.push(...ids.filter((id) => id !== keepId))
    })

    return deleteIds
}

function getNewestShows(data: Group[]) {
    const allShows = get(shows)
    const deleteIds: string[] = []

    data.forEach(({ ids }) => {
        let keepId = ""

        ids.forEach((id) => {
            const show = allShows[id]
            if (!show) return

            const compareShow = allShows[keepId]
            if (!compareShow) {
                keepId = id
                return
            }

            if (show.timestamps?.created < compareShow.timestamps?.created) keepId = id
        })

        deleteIds.push(...ids.filter((id) => id !== keepId))
    })

    return deleteIds
}

export function DeleteDuplicatedShows() {
    const showsValue = useStore(shows)
    const [initial] = useState(() => {
        const data: Group[] = (get(popupData).data || []).map((group: Group) => ({ ids: [...group.ids] }))
        return { data, oldest: getOldestShows(data), newest: getNewestShows(data) }
    })
    const { oldest, newest } = initial
    // grupos que se van achicando en el modo manual; el ref evita leer un estado viejo en los pasos asíncronos
    const [data, setDataState] = useState(initial.data)
    const dataRef = useRef(data)
    function setData(next: Group[]) {
        dataRef.current = next
        setDataState(next)
    }

    const [loading, setLoading] = useState(false)
    const [manualDeletion, setManualDeletion] = useState(false)
    const [manualIndex, setManualIndexState] = useState(-1)
    const manualIndexRef = useRef(-1)
    const [loadedTexts, setLoadedTexts] = useState<string[]>([])
    const textsRef = useRef<string[]>([])
    function setTexts(next: string[]) {
        textsRef.current = next
        setLoadedTexts(next)
    }

    async function deleteMatching() {
        setLoading(true)
        const deleteIds: string[] = []

        await Promise.all(
            dataRef.current.map(async ({ ids }) => {
                await loadShows(ids)
                const cache = get(showsCache)
                const compareShowText = getShowText(cache[ids[0]])
                if (!compareShowText) return
                const dIds: string[] = []

                ids.forEach((id, i) => {
                    if (i === 0) {
                        dIds.push(id)
                        return
                    }

                    const showText = getShowText(cache[id])
                    if (compareShowText === showText) dIds.push(id)
                })

                dIds.shift()
                if (dIds.length) deleteIds.push(...dIds)
            })
        )

        deleteShows(deleteIds)
        close()
    }

    function deleteOldest() {
        deleteShows(oldest)
        close()
    }

    function deleteNewest() {
        deleteShows(newest)
        close()
    }

    // MANUAL

    function deleteManual() {
        next()
        setManualDeletion(true)
    }

    async function loadContent(index: number) {
        const ids = dataRef.current[index]?.ids || []
        await loadShows(ids)

        const cache = get(showsCache)
        setTexts([...textsRef.current, ...ids.map((id) => getShowText(cache[id]))])
    }

    function next() {
        if (!dataRef.current[manualIndexRef.current + 1]) {
            close()
            return
        }

        manualIndexRef.current++
        setManualIndexState(manualIndexRef.current)
        setTexts([])
        loadContent(manualIndexRef.current)
    }

    function deleteAtIndex(index: number) {
        const group = dataRef.current[manualIndexRef.current]
        deleteShows([group.ids[index]])

        const nextData = dataRef.current.map((g, i) => (i === manualIndexRef.current ? { ids: g.ids.filter((_, j) => j !== index) } : g))
        setData(nextData)
        setTexts(textsRef.current.filter((_, j) => j !== index))

        if (nextData[manualIndexRef.current].ids.length < 2) next()
    }

    const names = (ids: string[]) => ids.filter((id) => showsValue[id]).map((id) => <li key={id}>{showsValue[id].name}</li>)

    if (manualDeletion) {
        return (
            <>
                <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setManualDeletion(false)} />

                <div className={styles.shows}>
                    {(data[manualIndex]?.ids || []).map((showId, i) => {
                        const show = showsValue[showId] || ({} as Partial<Show>)

                        return (
                            <Fragment key={showId}>
                                <div className={styles.show}>
                                    <p style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "5px" }}>
                                        <span>{show.name || "—"}</span>
                                        {/* creation/modified date! */}
                                        <span style={{ opacity: 0.5, fontSize: "0.7em" }}>{dateToString(show.timestamps?.modified || "", true)}</span>
                                    </p>

                                    {loadedTexts[i] ? <TextareaField label="edit.text" rows={5} value={loadedTexts[i]} disabled /> : null}

                                    <Button icon="delete" style={{ padding: "5px" }} onClick={() => deleteAtIndex(i)} white red>
                                        <T id="actions.delete" />
                                    </Button>
                                </div>

                                <HRule />
                            </Fragment>
                        )
                    })}
                </div>

                <Button variant="outline" icon="forward" info={`(${manualIndex + 1}/${data.length})`} onClick={next}>
                    <T id="guide.skip" />
                </Button>
            </>
        )
    }

    if (loading) {
        return (
            <Center style={{ overflow: "hidden" }}>
                <Loader />
            </Center>
        )
    }

    return (
        <>
            <Button variant="outline" icon="launch" info={`${data.length} (${data.map((d) => d.ids.length).reduce((a, b) => a + b, 0)})`} onClick={deleteManual} white>
                <T id="show.delete_manual" />
            </Button>

            <HRule />

            <div className={styles.list}>
                <Button variant="outline" icon="delete" onClick={deleteMatching} red white>
                    <T id="show.delete_match" />
                </Button>

                <InputRow
                    arrow
                    menu={
                        <div>
                            <ul style={{ listStylePosition: "inside", marginLeft: "20px" }}>{names(oldest)}</ul>
                        </div>
                    }
                >
                    <Button disabled={!oldest.length} variant="outline" icon="delete" info={"" + oldest.length} style={{ width: "100%" }} onClick={deleteOldest} red white>
                        <T id="show.delete_keep_last_modified" />
                    </Button>
                </InputRow>

                <InputRow
                    arrow
                    menu={
                        <div>
                            <ul style={{ listStylePosition: "inside", marginLeft: "20px" }}>{names(newest)}</ul>
                        </div>
                    }
                >
                    <Button disabled={!newest.length} variant="outline" icon="delete" info={"" + newest.length} style={{ width: "100%" }} onClick={deleteNewest} red white>
                        <T id="show.delete_keep_first_created" />
                    </Button>
                </InputRow>
            </div>
        </>
    )
}

import { useEffect, useState } from "react"
import type { Line, SlideData } from "../../../types/Show"
import { activePopup, activeShow, audioRouting, calendars, customScriptureBooks, drawerTabsData, effectsLibrary, scripturesCache, selected, showsCache } from "../../stores"
import { renameCalendar } from "../../components/drawer/calendar/calendars"
import { clone, removeDuplicates } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { getLayoutRef } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { setPopupSubmit } from "../../utils/popup"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { TextField } from "../ui/text-field/TextField"

// Port de components/main/popups/Rename.svelte. Lee selected y los stores de cada tipo de selección (ver abajo) y escribe el store correspondiente
// según selected.id (slide, group, chord, audio_channel, audio_effect, bible_book, calendar), además de activePopup, selected y groupName local.
// El $: del Svelte calculaba `list` y asignaba `groupName` al cambiar la selección: acá `list` se calcula en cada render y `groupName` se inicializa una vez
// (el popup se abre con la selección ya hecha y se cierra al renombrar, así que no hay diferencia observable).
interface SelectedItem {
    id?: string
    index?: number
    parent?: { id: string; index: number }
    chord?: { id?: string; key?: string }
    name?: string
    slideId?: string
    itemIndex?: number
    path?: string
}
interface ChordSelection extends SelectedItem {
    slideId: string
    itemIndex: number
    index: number
}
interface SelectionSnapshot {
    list: string[]
    groupName: string
}
interface ComputeArgs {
    selectedId: string | null
    selectionData: SelectedItem[]
    activeShowId?: string
    shows: Record<string, { slides?: Record<string, { group?: string | null }> }>
    drawerTab: { scripture?: { activeSubTab?: string } }
    scriptures: Record<string, { books?: Array<{ name: string; customName?: string }> }>
    routing: { channels?: Array<{ id?: string; name?: string }> } | null
    calendarsValue: Record<string, { name?: string }>
}

function computeSelection(args: ComputeArgs): SelectionSnapshot {
    let list: string[] = []
    let groupName = ""
    const { selectedId, selectionData, activeShowId, shows, drawerTab, scriptures, routing, calendarsValue } = args

    if ((activeShowId && selectedId === "slide") || selectedId === "group") {
        selectionData.forEach((a, i) => {
            const ref: SelectedItem | undefined = a.id ? a : getLayoutRef()[a.index ?? 0]
            if (!ref) return

            const slideKey = ref.parent ? ref.parent.id : ref.id
            let name = shows[activeShowId || ""]?.slides?.[slideKey || ""]?.group || ""
            if (name === ".") name = ""
            list.push(name || "—")
            if (i === 0) groupName = name
        })
        list = removeDuplicates(list)
    } else if (selectedId === "chord") {
        groupName = selectionData[0]?.chord?.key || ""
    } else if (selectedId === "bible_book") {
        const scriptureId = drawerTab.scripture?.activeSubTab || ""
        const activeBible = scriptures[scriptureId]
        const bookIndex = (selectionData[0]?.index ?? 1) - 1
        const book = (activeBible?.books?.[bookIndex] || {}) as { customName?: string; name?: string }
        groupName = book.customName || book.name || ""
    } else if (selectedId === "audio_channel") {
        const channelId = selectionData[0]?.id
        const channel = (routing?.channels || []).find((m) => m.id === channelId)
        groupName = channel?.name || ""
    } else if (selectedId === "calendar") {
        const calId = selectionData[0]?.id
        groupName = calendarsValue[calId || ""]?.name || ""
    } else if (selectionData[0]?.name) {
        groupName = selectionData[0].name
    }

    return { list, groupName }
}

export function Rename() {
    const selectedValue = useStore(selected)
    const activeShowValue = useStore(activeShow)
    const showsCacheValue = useStore(showsCache)
    const audioRoutingValue = useStore(audioRouting)
    const calendarsValue = useStore(calendars)
    const drawerTabsDataValue = useStore(drawerTabsData)
    const scripturesCacheValue = useStore(scripturesCache)

    const selectedId = selectedValue.id as string | null
    const selectionData: SelectedItem[] = Array.isArray(selectedValue.data) ? (selectedValue.data as SelectedItem[]) : []
    const snapshot = computeSelection({
        selectedId,
        selectionData,
        activeShowId: activeShowValue?.id,
        shows: showsCacheValue as never,
        drawerTab: drawerTabsDataValue as never,
        scriptures: scripturesCacheValue as never,
        routing: audioRoutingValue as never,
        calendarsValue: calendarsValue as never
    })
    const [groupName, setGroupName] = useState(() => snapshot.groupName)

    const renameAction: Record<string, () => void> = {
        slide: () => {
            const data = selectedValue.data
            if (!Array.isArray(data)) return

            const showId = activeShowValue?.id
            if (!showId) return

            const ref = getLayoutRef()

            // ids seleccionados (sin duplicados)
            let ids: string[] = []
            ;(data as SelectedItem[]).forEach((a) => {
                const id = a.id || ref[a.index ?? 0]?.id
                ids.push(id || "")
            })
            ids = [...new Set(ids)]

            // sacar los hijos si su padre también está seleccionado
            ids.forEach((id) => {
                const slide = _show().slides([id]).get()[0]
                if (slide?.children?.length) ids = ids.filter((childId) => !slide.children?.includes(childId))
            })

            let refs = ids.map((id) => ref.find((a) => a.id === id))
            refs = refs.sort((a, b) => (b?.layoutIndex ?? 0) - (a?.layoutIndex ?? 0))

            refs.forEach((item) => {
                if (!item?.id) return

                const slideId = item.id
                if (activeShowValue && showsCacheValue[showId].slides[slideId].globalGroup) history({ id: "UPDATE", newData: { data: null, key: "slides", keys: [slideId], subkey: "globalGroup" }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })

                history({ id: "UPDATE", newData: { data: groupName, key: "slides", keys: [slideId], subkey: "group" }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })

                if (!item.parent) return

                // convertir el hijo en padre
                const children = (_show().slides([item.parent.id]).get("children")[0] || []) as string[]
                const offsetIndex = item.parent.index - children.indexOf(item.id)

                history({
                    id: "UPDATE",
                    newData: { data: children.filter((a) => a !== item.id), key: "slides", keys: [item.parent.id], subkey: "children" },
                    oldData: { id: showId },
                    location: { page: "show", id: "show_key" }
                })

                const currentLayouts = _show().layouts().get("slides") as SlideData[][]
                const layoutIds = Object.keys(showsCacheValue[showId].layouts)
                const newLayouts: Record<string, SlideData[]> = {}

                currentLayouts.forEach((layout, i) => {
                    const l: SlideData[] = []
                    let added = false
                    layout.forEach((slide, index) => {
                        l.push(slide)
                        if (added || index + 1 < offsetIndex || slide.id !== item.parent?.id) return
                        added = true
                        l.push({ id: item.id, ...((slide.children?.[item.id] || {}) as Partial<SlideData>) } as SlideData)
                    })

                    newLayouts[layoutIds[i]] = l
                })

                history({ id: "UPDATE", newData: { key: "layouts", keys: layoutIds, subkey: "slides", data: newLayouts }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
            })
        },
        group: () => {
            selectionData.forEach((a) => {
                if (!a?.id) return

                const slideId = a.id
                if (activeShowValue && showsCacheValue[activeShowValue.id].slides[slideId].globalGroup) history({ id: "UPDATE", newData: { data: null, key: "slides", keys: [slideId], subkey: "globalGroup" }, oldData: { id: activeShowValue?.id }, location: { page: "show", id: "show_key" } })

                history({ id: "UPDATE", newData: { data: groupName, key: "slides", keys: [slideId], subkey: "group" }, oldData: { id: activeShowValue?.id }, location: { page: "show", id: "show_key" } })
            })
        },
        chord: () => {
            const chord = selectedValue.data[0] as ChordSelection
            const lines = _show().slides([chord.slideId]).items([chord.itemIndex]).get("lines")[0][0] as Line[]

            if (!chord.chord) return

            const newLines = clone(lines)
            const chords = newLines[chord.index].chords || []
            chords.forEach((a, i) => {
                if (a.id === chord.chord?.id) newLines[chord.index].chords![i].key = groupName
            })

            _show()
                .slides([chord.slideId])
                .items([chord.itemIndex])
                .set({ key: "lines", values: [newLines] })
        },
        audio_channel: () => {
            const channelId = selectedValue.data?.[0]?.id
            if (!channelId) return
            audioRouting.update((c) => {
                const list = c?.channels || []
                const channel = list.find((m) => m.id === channelId)
                if (channel) {
                    channel.name = groupName
                    delete channel.outputLink
                }
                return { ...(c || { channels: [], connections: [] }), channels: list, connections: c?.connections || [] }
            })
        },
        audio_effect: () => {
            const selectedPath = selectedValue.data?.[0]?.path
            effectsLibrary.update((a) => {
                const index = a.findIndex((item) => item.path === selectedPath)
                if (index > -1) a[index].name = groupName
                return a
            })
        },
        bible_book: () => {
            const scriptureId = drawerTabsDataValue.scripture?.activeSubTab || ""
            const bookIndex = selectedValue.data[0]?.index - 1
            scripturesCache.update((a) => {
                if (!a[scriptureId]?.books?.[bookIndex]) return a
                ;(a[scriptureId].books[bookIndex] as { customName?: string }).customName = groupName
                return a
            })

            // actualizar el cajón en tiempo real
            customScriptureBooks.update((a) => {
                if (!a[scriptureId]) a[scriptureId] = []
                a[scriptureId][bookIndex] = groupName
                return a
            })
        },
        calendar: () => {
            const oldName = selectedValue.data?.[0]?.id
            if (oldName && groupName && groupName.trim() && groupName.trim() !== oldName) renameCalendar(oldName, groupName.trim())
        }
    }

    function rename() {
        if (selectedId && renameAction[selectedId]) renameAction[selectedId]()
        activePopup.set(null)
        setGroupName("")
        selected.set({ id: null, data: [] })
    }

    useEffect(() => setPopupSubmit(rename))

    return (
        <>
            {snapshot.list.length > 1 ? (
                <>
                    <p>
                        <T id="popup.change_name" />
                        <span>:</span>
                    </p>
                    <ul style={{ listStylePosition: "inside", marginBottom: "20px" }}>
                        {snapshot.list.map((text, i) => (
                            <li key={i} style={{ fontWeight: "bold" }}>
                                {text}
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}

            <TextField label="inputs.name" value={groupName} onInput={(value) => setGroupName(value ?? "")} onChange={(value) => setGroupName(value ?? "")} autoselect />

            <Button variant="default" style={{ marginTop: "20px" }} icon="edit" onClick={rename}>
                <T id="actions.rename" />
            </Button>
        </>
    )
}

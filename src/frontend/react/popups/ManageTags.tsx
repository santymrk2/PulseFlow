import { Fragment, useState } from "react"
import { get } from "../../lib/store"
import { uid } from "uid"
import type { Tag } from "../../../types/Show"
import { keysToID, sortByName } from "../../components/helpers/array"
import { actionTags, activeActionTagFilter, activeMediaTagFilter, activePlayerTagFilter, activeTagFilter, activeTimerTagFilter, globalTags, mediaTags, playerTags, popupData, timerTags, variableTags } from "../../stores"
import { T } from "../helpers/T"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { ColorField } from "../ui/color-field/ColorField"
import { InputRow } from "../ui/input-row/InputRow"
import { TextField } from "../ui/text-field/TextField"
import styles from "./ManageTags.module.css"

// Port de components/main/popups/ManageTags.svelte. Lee popupData.type (al montar; por defecto "show") y el store de etiquetas de ese tipo (globalTags, mediaTags,
// playerTags, actionTags, variableTags o timerTags). Escribe ese store (crear con uid(5), nombre vacío y color blanco, borrar por id, editar name / color en el lugar) y,
// al borrar, vacía el filtro activo del tipo (show, media, player, action, timer; variable no tiene).
// Como el Svelte, la lista es una foto del store que se vuelve a tomar tras cada operación (getTags) y `{#key tags}` recrea todas las filas: la `key` del Fragment cambia
// con cada foto. Sólo la primera foto va ordenada por nombre (se toma al crear el estado, no en un efecto). Los `null` de TextField se tratan como "" sólo por el tipo.
const stores = {
    show: globalTags,
    media: mediaTags,
    player: playerTags,
    action: actionTags,
    variable: variableTags,
    timer: timerTags
}
type TagType = keyof typeof stores
type TagWithId = Tag & { id: string }

const isTagType = (type: string): type is TagType => type in stores

export function ManageTags() {
    const [type] = useState<string>(() => get(popupData).type || "show")
    const [snapshot, setSnapshot] = useState(() => ({ version: 0, tags: getTags(type, true) }))
    const { version, tags } = snapshot

    const emptyTag = !!tags.find((a) => !a.name)

    function refresh() {
        setSnapshot((current) => ({ version: current.version + 1, tags: getTags(type, false) }))
    }

    function createTag() {
        if (emptyTag || !isTagType(type)) return

        stores[type].update((a) => {
            a[uid(5)] = { name: "", color: "#ffffff" }
            return a
        })

        refresh()
    }

    function deleteTag(tagId: string) {
        if (!isTagType(type)) return

        stores[type].update((a) => {
            delete a[tagId]
            return a
        })
        if (type === "show") activeTagFilter.set([])
        else if (type === "media") activeMediaTagFilter.set([])
        else if (type === "player") activePlayerTagFilter.set([])
        else if (type === "action") activeActionTagFilter.set([])
        else if (type === "timer") activeTimerTagFilter.set([])

        refresh()
    }

    function updateKey(value: string, tagId: string, key: keyof Tag) {
        if (!isTagType(type)) return

        stores[type].update((a) => {
            a[tagId][key] = value
            return a
        })

        refresh()
    }

    return (
        <div className={styles.tags}>
            {tags.length ? (
                <Fragment key={version}>
                    {tags.map((tag) => (
                        <InputRow key={tag.id}>
                            <TextField label="inputs.name" value={tag.name} onChange={(value) => updateKey(value ?? "", tag.id, "name")} autofocus={!tag.name} />
                            <ColorField label="edit.color" value={tag.color} style={{ minWidth: "200px", maxWidth: "200px" }} onChange={(value) => updateKey(value, tag.id, "color")} noLabel />
                            <Button icon="delete" title="actions.delete" onClick={() => deleteTag(tag.id)} white />
                        </InputRow>
                    ))}
                </Fragment>
            ) : (
                <Center faded>
                    <T id="empty.general" />
                </Center>
            )}

            <Button variant="outline" icon="add" style={{ marginTop: "20px", width: "100%" }} disabled={emptyTag} onClick={createTag}>
                <T id="meta.new_tag" />
            </Button>
        </div>
    )
}

function getTags(type: string, sort: boolean): TagWithId[] {
    if (!isTagType(type)) return []

    const tags: TagWithId[] = keysToID(get(stores[type]))
    return sort ? sortByName(tags) : tags
}

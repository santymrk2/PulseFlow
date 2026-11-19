import { useState, type CSSProperties, type MouseEvent } from "react"
import type { Tag as TagData } from "../../../types/Show"
import { activeShow, globalTags, selected } from "../../shared/core/stores"
import { history } from "../../shared/utils/helpers/history"
import { _show } from "../../shared/utils/helpers/shows"
import { translateText } from "../../shared/utils/language"
import { HiddenInput } from "../ui/hidden-input/HiddenInput"
import { useStore } from "../hooks/useStore"
import { triggerClickOnEnterSpace } from "../helpers/triggerClickOnEnterSpace"
import styles from "./Tag.module.css"

export interface TagProps {
    tag: TagData & { id?: string }
    active?: boolean
}

interface QuickAccess {
    tags?: string[]
}

// (F24.20a). `bind:edit` → edit/onEditChange, `on:edit` → onEdit.
export function Tag({ tag, active = false }: TagProps) {
    const tagId = tag.id || ""
    const currentGlobalTags = useStore(globalTags)
    const currentActiveShow = useStore(activeShow)
    const [editActive, setEditActive] = useState(false)
    const [name, setName] = useState(tag.name || "")

    function rename(detail: { value: string }) {
        const value = detail?.value
        const previous = currentGlobalTags[tagId]?.name
        if (previous) {
            if (!value) {
                setName(previous)
                return
            }
            history({ id: "UPDATE", newData: { data: value, key: "name" }, oldData: { id: tagId }, location: { page: "show", id: "tag_key" } })
        } else {
            globalTags.update((a) => {
                if (a[tagId]) a[tagId].name = value
                return a
            })
        }
        setName(value)
    }

    function select(event: MouseEvent<HTMLDivElement>) {
        if (event.button !== 2) return
        selected.set({ id: "tag", data: [{ id: tagId }] })
    }

    function toggleTag() {
        if (editActive) return
        const quickAccess = (_show().get("quickAccess") || {}) as QuickAccess
        const tags = quickAccess.tags || []
        const existingIndex = tags.indexOf(tagId)
        if (existingIndex < 0) tags.push(tagId)
        else tags.splice(existingIndex, 1)
        quickAccess.tags = tags

        const showId = currentActiveShow?.id
        if (!showId) return
        history({ id: "UPDATE", newData: { data: quickAccess, key: "quickAccess" }, oldData: { id: showId }, location: { page: "show", id: "show_key", override: "toggle_tag" } })
    }

    return (
        <div onMouseUp={select} onClick={toggleTag} onKeyDown={triggerClickOnEnterSpace} className={`tag context #tag ${active || editActive ? styles.active : ""} ${styles.tag}`} style={{ "--color": tag.color || "white" } as CSSProperties} tabIndex={0} role="button" data-title={translateText(tag.name || "")}>
            <HiddenInput id={`tag_${tagId}`} value={name} edit={editActive} onEdit={(detail) => rename(detail)} onEditChange={(edit) => setEditActive(!!edit)} />
        </div>
    )
}

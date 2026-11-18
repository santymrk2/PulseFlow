import { uid } from "uid"
import { activeShow, globalTags, shows } from "../../stores"
import { keysToID, sortByName, sortObject } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { _show } from "../../components/helpers/shows"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { Center } from "../system/Center"
import { useStore } from "../hooks/useStore"
import { Tag } from "./Tag"
import styles from "./Tags.module.css"

export interface TagsProps {
    list?: boolean
}

interface QuickAccess {
    tags?: string[]
}

// Port de components/show/Tags.svelte (F24.20a). El orden es nombre y después color, igual que en Svelte.
export function Tags({ list = false }: TagsProps) {
    const currentActiveShow = useStore(activeShow)
    const currentShows = useStore(shows)
    const currentGlobalTags = useStore(globalTags)

    const currentShow = currentShows[currentActiveShow?.id || ""]
    const showTags = currentShow?.quickAccess?.tags || []
    const tags = sortObject(sortByName(keysToID(currentGlobalTags)), "color") as Array<{ id: string; name: string; color: string }>

    function enableTag(tagId: string) {
        const quickAccess = (_show().get("quickAccess") || {}) as QuickAccess
        quickAccess.tags = [...(quickAccess.tags || []), tagId]
        const showId = currentActiveShow?.id
        if (!showId) return
        history({ id: "UPDATE", newData: { data: quickAccess, key: "quickAccess" }, oldData: { id: showId }, location: { page: "show", id: "show_key", override: "toggle_tag" } })
    }

    function createNewTag() {
        const tagId = uid(5)
        history({ id: "UPDATE", oldData: { id: tagId }, location: { page: "show", id: "tag" } })
        enableTag(tagId)
    }

    return (
        <>
            <div className={`${styles.tags} ${list ? styles.list : ""}`}>
                {tags.length ? (
                    tags.map((tag) => <Tag key={tag.id} tag={tag} active={showTags.includes(tag.id)} />)
                ) : (
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                )}
            </div>
            {!list ? (
                <Button onClick={createNewTag} style={{ width: "100%" }}>
                    <Icon id="tag" right />
                    <T id="meta.new_tag" />
                </Button>
            ) : null}
        </>
    )
}

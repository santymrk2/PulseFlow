import type { ReactNode } from "react"
import { T } from "../../helpers/T"
import { Center } from "../../system/Center"
import { Button } from "../button/Button"
import { InputRow } from "../input-row/InputRow"

// Port de ui/dynamic-list/dynamic-list.svelte. dispatch("open"|"delete", id) → onOpen/onDelete(id); dispatch("add") → onAdd();
// `<slot {item} />` → children(item). El `{#each}` no tenía key: se usa la posición.
export interface DynamicListItem {
    id: string
    [key: string]: unknown
}

export interface DynamicListProps<I extends DynamicListItem = DynamicListItem> {
    items: I[]
    allowOpen?: boolean
    addDisabled?: boolean
    nothingText?: boolean
    children?: (item: I) => ReactNode
    onOpen?: (id: string) => void
    onDelete?: (id: string) => void
    onAdd?: () => void
}

export function DynamicList<I extends DynamicListItem = DynamicListItem>({ items, allowOpen = true, addDisabled = false, nothingText = true, children, onOpen, onDelete, onAdd }: DynamicListProps<I>) {
    return (
        <>
            {items.length ? (
                items.map((item, index) => (
                    <InputRow key={index}>
                        {allowOpen ? (
                            <Button style={{ width: "100%", fontWeight: "normal" }} title="titlebar.edit" onClick={() => onOpen?.(item.id)}>
                                {children?.(item)}
                            </Button>
                        ) : (
                            children?.(item)
                        )}

                        <Button icon="delete" style={{ width: "40px" }} title="actions.delete" onClick={() => onDelete?.(item.id)} white />
                    </InputRow>
                ))
            ) : nothingText ? (
                <>
                    <Center faded>
                        <T id="empty.general" />
                    </Center>

                    <br />
                </>
            ) : null}

            <Button variant="outline" style={{ width: "100%" }} icon="add" disabled={addDisabled} onClick={() => onAdd?.()}>
                <T id="settings.add" />
            </Button>
        </>
    )
}

import { useMemo, useState } from "react"
import type { Writable } from "../../lib/store"
import { uid } from "uid"
import { activePopup, drawerTabsData, overlayCategories, selected, templateCategories } from "../../stores"
import { setExampleEffects, setExampleOverlays, setExampleTemplates } from "../../utils/createData"
import { translateText } from "../../utils/language"
import { getAccess } from "../../utils/profile"
import { deleteAction } from "../../components/helpers/clipboard"
import { keysToID, sortObject } from "../../components/helpers/array"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { Input } from "../ui/input/Input"
import { Menu, MenuItem, MenuSeparator } from "../ui/menu"
import { SelectField } from "../ui/select-field/SelectField"
import styles from "./CategoryPicker.module.css"

interface Category {
    name: string
    icon?: string
    isArchive?: boolean
    default?: boolean
}

export interface CategoryPickerProps {
    kind: "templates" | "overlays"
    extraOptions?: { value: string; label: string }[]
}

export function CategoryPicker({ kind, extraOptions = [] }: CategoryPickerProps) {
    const currentTemplateCategories = useStore(templateCategories)
    const currentOverlayCategories = useStore(overlayCategories)
    const currentDrawerTabsData = useStore(drawerTabsData)

    const categoryStore = (kind === "templates" ? templateCategories : overlayCategories) as Writable<Record<string, Category>>
    const categories = kind === "templates" ? currentTemplateCategories : currentOverlayCategories
    const selectionId = kind === "templates" ? "category_templates" : "category_overlays"
    const profile = getAccess(kind)
    const readOnly = profile.global === "read"

    const active = currentDrawerTabsData[kind]?.activeSubTab || "all"
    const isCategory = !!categories[active]
    const current = categories[active]

    const label = (name: string | undefined) => (name?.includes(".") ? translateText(name) : name || "")

    const options = useMemo(() => {
        const cats = keysToID(categories).filter((a: { id: string }) => profile[a.id] !== "none")
        return [
            { value: "all", label: translateText("category.all") },
            ...sortObject(
                cats.filter((a: { isArchive?: boolean }) => !a.isArchive),
                "name"
            ).map((a: { id: string; name?: string }) => ({ value: a.id, label: label(a.name) })),
            ...sortObject(
                cats.filter((a: { isArchive?: boolean }) => a.isArchive),
                "name"
            ).map((a: { id: string; name?: string }) => ({ value: a.id, label: label(a.name) })),
            ...extraOptions,
            { value: "unlabeled", label: translateText("category.unlabeled") }
        ]
    }, [categories, extraOptions, profile])

    function setCategory(id: string) {
        drawerTabsData.update((a) => {
            a[kind] = { ...(a[kind] || { enabled: true }), activeSubTab: id }
            return a
        })
    }

    function newCategory(name: string) {
        const id = uid()
        categoryStore.update((a) => ({ ...a, [id]: { name: name.trim() || translateText("main.unnamed") } }))
        setCategory(id)
    }

    const [menuOpen, setMenuOpen] = useState(false)
    const run = (action: () => void) => {
        setMenuOpen(false)
        action()
    }

    const [renaming, setRenaming] = useState(false)
    const [renameValue, setRenameValue] = useState("")

    function startRename() {
        setRenameValue(label(current?.name))
        setRenaming(true)
    }

    function commitRename() {
        if (!renaming) return
        setRenaming(false)
        const name = renameValue.trim()
        if (!name || name === label(current?.name)) return

        categoryStore.update((a) => {
            if (!a[active]) return a
            if (a[active].default) delete a[active].default
            a[active].name = name
            return a
        })
    }

    function renameKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") commitRename()
        else if (e.key === "Escape") setRenaming(false)
    }

    function changeIcon() {
        selected.set({ id: selectionId, data: [active] })
        activePopup.set("icon")
    }

    function toggleArchive() {
        categoryStore.update((a) => {
            if (a[active]) a[active].isArchive = !a[active].isArchive
            return a
        })
    }

    function remove() {
        const id = active
        setCategory("all")
        deleteAction({ id: selectionId, data: [id] })
    }

    function resetDefaults() {
        if (kind === "templates") setExampleTemplates()
        else if (active === "effects") setExampleEffects()
        else setExampleOverlays()
    }

    return (
        <div className={styles.root}>
            <div className={styles.field}>{renaming ? <Input value={renameValue} autofocus autoselect onInput={(e) => setRenameValue((e.target as HTMLInputElement).value)} onKeyDown={renameKeydown} onChange={() => commitRename()} /> : <SelectField label="guide_title.categories" value={active} options={options} addNew={readOnly ? null : "new.category"} onChange={(v) => setCategory(v || "all")} onNew={(v) => newCategory(v)} />}</div>

            <div className={styles.more}>
                <Button variant="ghost" size="icon" icon="more" title="create_show.more_options" onClick={() => setMenuOpen(!menuOpen)} />
                <Menu open={menuOpen} onClose={() => setMenuOpen(false)}>
                    {isCategory && !readOnly ? (
                        <>
                            <MenuItem onClick={() => run(startRename)}>{translateText("actions.rename")}</MenuItem>
                            <MenuItem onClick={() => run(changeIcon)}>{translateText("context.changeIcon")}</MenuItem>
                            <MenuItem onClick={() => run(toggleArchive)} checked={!!current?.isArchive}>
                                {translateText("actions.archive_title")}
                            </MenuItem>
                            <MenuItem onClick={() => run(remove)}>{translateText("actions.delete")}</MenuItem>
                            <MenuSeparator />
                        </>
                    ) : null}
                    <MenuItem onClick={() => run(resetDefaults)} disabled={readOnly}>
                        {translateText("actions.reset_defaults")}
                    </MenuItem>
                </Menu>
            </div>
        </div>
    )
}

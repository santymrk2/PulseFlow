<script lang="ts">
    // Selector de categoría de los editores de Theme (plantillas) y Overlay: el desplegable de categorías con "Nueva categoría"
    // adentro y un ⋯ para renombrar, cambiar el ícono, archivar, borrar y restablecer los ejemplos. Reemplaza a las pestañas
    // que vivían en el cajón inferior (con su clic derecho por categoría).
    import type { Writable } from "svelte/store"
    import { uid } from "uid"
    import Button from "../../lib/components/ui/button/button.svelte"
    import Input from "../../lib/components/ui/input/input.svelte"
    import Menu from "../../lib/components/ui/menu/menu.svelte"
    import MenuItem from "../../lib/components/ui/menu/menu-item.svelte"
    import MenuSeparator from "../../lib/components/ui/menu/menu-separator.svelte"
    import SelectField from "../../lib/components/ui/select-field/select-field.svelte"
    import { activePopup, drawerTabsData, overlayCategories, selected, templateCategories } from "../../stores"
    import { setExampleEffects, setExampleOverlays, setExampleTemplates } from "../../utils/createData"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { deleteAction } from "../helpers/clipboard"
    import { keysToID, sortObject } from "../helpers/array"

    interface Category {
        name: string
        icon?: string
        isArchive?: boolean
        default?: boolean
    }

    export let kind: "templates" | "overlays"
    // opciones extra al final de la lista (p. ej. "Efectos" en Overlay)
    export let extraOptions: { value: string; label: string }[] = []

    const categoryStore = (kind === "templates" ? templateCategories : overlayCategories) as Writable<Record<string, Category>>
    const selectionId = kind === "templates" ? "category_templates" : "category_overlays"
    const profile = getAccess(kind)
    $: readOnly = profile.global === "read"

    $: active = $drawerTabsData[kind]?.activeSubTab || "all"
    $: isCategory = !!$categoryStore[active]
    $: current = $categoryStore[active]

    const label = (name: string | undefined) => (name?.includes(".") ? translateText(name) : name || "")

    $: categories = keysToID($categoryStore).filter((a) => profile[a.id] !== "none")
    $: options = [
        { value: "all", label: translateText("category.all") },
        ...sortObject(
            categories.filter((a) => !a.isArchive),
            "name"
        ).map((a) => ({ value: a.id, label: label(a.name) })),
        ...sortObject(
            categories.filter((a) => a.isArchive),
            "name"
        ).map((a) => ({ value: a.id, label: label(a.name) })),
        ...extraOptions,
        { value: "unlabeled", label: translateText("category.unlabeled") }
    ]

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

    // MENÚ ⋯

    let menuOpen = false
    const run = (action: () => void) => {
        menuOpen = false
        action()
    }

    let renaming = false
    let renameValue = ""
    function startRename() {
        renameValue = label(current?.name)
        renaming = true
    }
    function commitRename() {
        if (!renaming) return
        renaming = false
        const name = renameValue.trim()
        if (!name || name === label(current?.name)) return

        categoryStore.update((a) => {
            if (!a[active]) return a
            if (a[active].default) delete a[active].default
            a[active].name = name
            return a
        })
    }
    function renameKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") commitRename()
        else if (e.key === "Escape") renaming = false
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
</script>

<div class="flex items-start gap-1 p-2">
    <div class="min-w-0 flex-1">
        {#if renaming}
            <Input value={renameValue} autofocus autoselect on:input={(e) => (renameValue = (e.target as HTMLInputElement).value)} on:keydown={renameKeydown} on:change={commitRename} />
        {:else}
            <SelectField label="guide_title.categories" value={active} {options} addNew={readOnly ? null : "new.category"} on:change={(e) => setCategory(e.detail)} on:new={(e) => newCategory(e.detail)} />
        {/if}
    </div>

    <div class="relative h-[38px] shrink-0">
        <Button variant="ghost" size="icon" icon="more" title="create_show.more_options" onclick={() => (menuOpen = !menuOpen)} />
        <Menu open={menuOpen} onclose={() => (menuOpen = false)}>
            {#if isCategory && !readOnly}
                <MenuItem onclick={() => run(startRename)}>{translateText("actions.rename")}</MenuItem>
                <MenuItem onclick={() => run(changeIcon)}>{translateText("context.changeIcon")}</MenuItem>
                <MenuItem onclick={() => run(toggleArchive)} checked={!!current?.isArchive}>{translateText("actions.archive_title")}</MenuItem>
                <MenuItem onclick={() => run(remove)}>{translateText("actions.delete")}</MenuItem>
                <MenuSeparator />
            {/if}
            <MenuItem onclick={() => run(resetDefaults)} disabled={readOnly}>{translateText("actions.reset_defaults")}</MenuItem>
        </Menu>
    </div>
</div>

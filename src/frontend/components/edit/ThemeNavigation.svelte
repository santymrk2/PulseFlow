<script lang="ts">
    // Theme editor (columna izquierda de Edit cuando se edita una plantilla): selector de categoría arriba y la lista de
    // plantillas debajo, como la lista de diapositivas de un show. Reemplaza a la pestaña Templates del cajón.
    import { uid } from "uid"
    import Button from "../../lib/components/ui/button/button.svelte"
    import SelectField from "../../lib/components/ui/select-field/select-field.svelte"
    import { drawerTabsData, templateCategories, templates } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import Templates from "../drawer/pages/Templates.svelte"
    import { keysToID, sortObject } from "../helpers/array"
    import { history } from "../helpers/history"
    import LeftPanel from "../show/left/LeftPanel.svelte"

    const profile = getAccess("templates")
    $: readOnly = profile.global === "read"

    $: active = $drawerTabsData.templates?.activeSubTab || "all"

    $: visibleTemplates = Object.values($templates).filter((a) => a && profile[a.category || ""] !== "none" && a?.settings?.mode !== "text")
    const label = (name: string | undefined) => (name?.includes(".") ? translateText(name) : name || "")

    $: categories = keysToID($templateCategories).filter((a) => profile[a.id] !== "none")
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
        { value: "unlabeled", label: translateText("category.unlabeled") }
    ]

    function setCategory(id: string) {
        drawerTabsData.update((a) => {
            a.templates = { ...(a.templates || { enabled: true }), activeSubTab: id }
            return a
        })
    }

    function newCategory(name: string) {
        const id = uid()
        templateCategories.update((a) => ({ ...a, [id]: { name: name.trim() || translateText("main.unnamed") } }))
        setCategory(id)
    }

    const newTemplate = () => history({ id: "UPDATE", location: { page: "drawer", id: "template" } })
</script>

<LeftPanel title={translateText("tabs.templates")} count={visibleTemplates.length}>
    {#snippet actions()}
        <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="new.template" disabled={readOnly} onclick={newTemplate} />
    {/snippet}

    <div class="p-2">
        <SelectField label="guide_title.categories" value={active} {options} addNew={readOnly ? null : "new.category"} on:change={(e) => setCategory(e.detail)} on:new={(e) => newCategory(e.detail)} />
    </div>

    <div class="h-[calc(100%-62px)]">
        <Templates {active} columns={1} editOnClick />
    </div>
</LeftPanel>

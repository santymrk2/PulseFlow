<script lang="ts">
    // Theme editor (columna izquierda de Edit cuando se edita una plantilla): selector de categoría arriba y la lista de
    // plantillas debajo, como la lista de diapositivas de un show. Reemplaza a la pestaña Templates del cajón.
    import Button from "../../lib/components/ui/button/button.svelte"
    import { drawerTabsData, templates } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import Templates from "../drawer/pages/Templates.svelte"
    import { history } from "../helpers/history"
    import LeftPanel from "../show/left/LeftPanel.svelte"
    import CategoryPicker from "./CategoryPicker.svelte"

    const profile = getAccess("templates")
    $: readOnly = profile.global === "read"

    $: active = $drawerTabsData.templates?.activeSubTab || "all"
    $: visibleTemplates = Object.values($templates).filter((a) => a && profile[a.category || ""] !== "none" && a?.settings?.mode !== "text")

    const newTemplate = () => history({ id: "UPDATE", location: { page: "drawer", id: "template" } })
</script>

<LeftPanel title={translateText("tabs.templates")} count={visibleTemplates.length}>
    {#snippet actions()}
        <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="new.template" disabled={readOnly} onclick={newTemplate} />
    {/snippet}

    <CategoryPicker kind="templates" />

    <div class="h-[calc(100%-62px)]">
        <Templates {active} columns={1} editOnClick />
    </div>
</LeftPanel>

<script lang="ts">
    // Overlay editor (columna izquierda de Edit cuando se edita un overlay o un efecto): selector de categoría arriba (con
    // "Efectos" como una opción más) y la lista debajo. Reemplaza a la pestaña Overlays del cajón; para sacar un overlay al
    // aire se usa la pestaña Overlays del panel derecho.
    import Button from "../../lib/components/ui/button/button.svelte"
    import { drawerTabsData, effects, overlays } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import Overlays from "../drawer/pages/Overlays.svelte"
    import { history } from "../helpers/history"
    import LeftPanel from "../show/left/LeftPanel.svelte"
    import CategoryPicker from "./CategoryPicker.svelte"

    const profile = getAccess("overlays")
    $: readOnly = profile.global === "read"

    $: active = $drawerTabsData.overlays?.activeSubTab || "all"
    $: isEffects = active === "effects"
    $: count = isEffects ? Object.keys($effects).length : Object.values($overlays).filter((a) => a && profile[a.category || ""] !== "none").length

    const add = () => history({ id: "UPDATE", location: { page: "drawer", id: isEffects ? "effect" : "overlay" } })
</script>

<LeftPanel title={translateText(isEffects ? "tabs.effects" : "tabs.overlays")} {count}>
    {#snippet actions()}
        <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title={isEffects ? "new.effect" : "new.overlay"} disabled={readOnly} onclick={add} />
    {/snippet}

    <CategoryPicker kind="overlays" extraOptions={[{ value: "effects", label: translateText("tabs.effects") }]} />

    <div class="h-[calc(100%-62px)]">
        <Overlays {active} columns={1} editOnClick />
    </div>
</LeftPanel>

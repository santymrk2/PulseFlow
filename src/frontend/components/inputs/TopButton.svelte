<script lang="ts">
    import type { TopViews } from "../../../types/Tabs"
    import { activeEdit, activePage, activeShow, dictionary, editHistory, labelsDisabled, shows, special } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"

    export let id: TopViews
    export let red = false
    export let disabled = false
    export let hideLabel: null | boolean = null
    $: label = hideLabel === null ? !$labelsDisabled : !hideLabel
    $: isActive = $activePage === id

    const keys = { show: 1, edit: 2, stage: 3, draw: 4, settings: 5 }

    function openPage() {
        activePage.set(id)

        if (id === "edit") openActiveShow()
    }

    function openActiveShow() {
        let showIsActive = $activeShow && ($activeShow.type || "show") === "show"
        let noEditSlide = $activeEdit.slide === null || $activeEdit.slide === undefined
        if (showIsActive && !$activeEdit.id) openEdit()
        else if (showIsActive && noEditSlide) updateEditItem()
        else if (showIsActive && $activeEdit.showId && $activeEdit.showId !== $activeShow?.id) openEdit()

        function updateEditItem() {
            return // more annoying than helpful
            // set to show if: media has been opened AND show has not been opened AND it's not locked
            if ($activeEdit.id && (!$editHistory.find((a) => $activeEdit.id === a.edit?.id) || $editHistory.find((a) => $activeShow?.id === a.show?.id))) return
            if ($shows[$activeShow?.id || ""]?.locked) return

            openEdit()
        }

        function openEdit() {
            activeEdit.set({ slide: $activeEdit.slide || 0, items: [], showId: $activeShow?.id })
        }
    }
</script>

<!-- F12.5b: mismo botón que el resto de la barra (kit). Activo = gris neutro, no azul -->
<Button variant={red ? "destructive" : isActive ? "secondary" : "ghost"} size="sm" data-title={translateText(`menu._title_${id}${$special.numberKeys ? "" : ` [${keys[id]}]`}`, $dictionary)} aria-current={isActive ? "page" : undefined} {disabled} onclick={openPage}>
    <Icon {id} size={1} white />
    {#if label}<span><T id="menu.{id}" /></span>{/if}
</Button>

<style>
    @media screen and (max-width: 750px) {
        span {
            display: none;
        }
    }
</style>

<script lang="ts">
    import { popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import ChoiceGrid from "../../../lib/components/ui/choice-grid/choice-grid.svelte"

    const styleTypes = [
        { id: "normal", name: translateText("settings.normal"), icon: "styles" },
        { id: "live", name: translateText("tabs.live"), icon: "camera" }
    ]

    function selectStyle(id) {
        popupData.set({ id: "choose_style", value: id })
    }
</script>

<ChoiceGrid options={styleTypes} on:click={(e) => selectStyle(e.detail)} />

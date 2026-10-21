<script lang="ts">
    import { popupData } from "../../../stores"
    import { chooseTeam } from "../../../utils/cloudSync"
    import ChoiceGrid from "../../../lib/components/ui/choice-grid/choice-grid.svelte"
    import Tip from "../Tip.svelte"

    const type = $popupData.type
    const teams = $popupData.teams || []

    let selected = false
    function teamChosen(e: any) {
        if (selected || !Array.isArray(teams)) return

        const selectedId = e.detail
        const team = teams.find((a) => a.id === selectedId)

        selected = true
        chooseTeam({ ...team, count: teams.length })
    }
</script>

{#if type === "choose_team"}
    <Tip type="info" value="Select a team where you want to sync the data." bottom={20} />

    <ChoiceGrid options={teams} on:click={teamChosen} highlightFirst={false} />
{/if}

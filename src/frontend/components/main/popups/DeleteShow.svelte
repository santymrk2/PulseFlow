<script lang="ts">
    import { activePopup, selected, shows } from "../../../stores"
    import { registerPopupSubmit } from "../../../utils/popup"
    import { history } from "../../helpers/history"
    import T from "../../helpers/T.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"

    registerPopupSubmit(deleteSelected)

    const showsToDelete = $selected.data.filter((a) => !$shows[a.id]?.locked)

    function deleteSelected() {
        history({ id: "SHOWS", oldData: { data: showsToDelete }, location: { page: "drawer" } })

        selected.set({ id: null, data: [] })
        activePopup.set(null)
    }
</script>

<p style="font-weight: bold;"><T id="popup.delete_show_confirmation" />:</p>

<ul style="list-style-position: inside;margin-bottom: 20px;">
    {#each showsToDelete as show}
        <li>{$shows[show.id]?.name}</li>
    {/each}
</ul>

<Button variant="default" icon="delete" info={showsToDelete.length.toString()} on:click={deleteSelected} white>
    <T id="actions.delete" />
</Button>

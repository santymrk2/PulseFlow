<script lang="ts">
    import { activeLook, activePopup, looks, popupData } from "../../../stores"
    import { applyLook } from "../../helpers/looks"
    import Icon from "../../helpers/Icon.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"

    let active: string = $popupData.active || $activeLook || ""

    function select(selectedId: string) {
        active = selectedId

        if ($popupData.trigger) {
            $popupData.trigger(selectedId)
        } else {
            applyLook(selectedId)
        }

        popupData.set({ id: "select_look", value: selectedId })

        setTimeout(() => {
            setTimeout(() => ($activePopup === null ? popupData.set({}) : null), 200) // reset after closing
            activePopup.set(null)
        })
    }
</script>

{#if Object.keys($looks).length}
    {#each Object.entries($looks) as [id, look]}
        <CombinedInput>
            <MaterialButton style={id === active ? "background-color: var(--secondary);" : ""} on:click={() => select(id)}>
                {look.name}

                {#if id === $activeLook}
                    <Icon id="check" size={1} white />
                {/if}
            </MaterialButton>
        </CombinedInput>
    {/each}
{:else}
    <Center size={1.2} faded style="height: 100px;padding-top: 20px;">
        <span>...</span>
    </Center>
{/if}

<script lang="ts">
    import { onMount } from "svelte"
    import { actions, activePopup, categories, popupData } from "../../../stores"
    import SelectField from "../../../lib/components/ui/select-field/select-field.svelte"
    import Tip from "../Tip.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import InputRow from "../../input/InputRow.svelte"

    let selectedCategory = $popupData?.id
    onMount(() => {
        popupData.set({})
    })

    let currentAction = $categories[selectedCategory]?.action || ""

    let actionOptions = Object.entries($actions)
        .map(([id, a]) => ({ id, name: a.name }))
        .sort((a, b) => a.name?.localeCompare(b.name))

    function updateValue(id: string) {
        categories.update((a) => {
            if (!a[selectedCategory]) return a

            a[selectedCategory].action = id
            return a
        })

        currentAction = id
    }

    function editAction() {
        popupData.set({ id: currentAction })
        activePopup.set("action")
    }
</script>

<Tip type="info" value="category.action_tip" bottom={20} />

<InputRow>
    <SelectField label="midi.start_action" options={actionOptions.map((a) => ({ label: a.name, value: a.id }))} value={currentAction} allowEmpty on:change={(e) => updateValue(e.detail)} />
    {#if currentAction && $actions[currentAction]}
        <Button title="titlebar.edit" icon="edit" on:click={editAction} />
    {/if}
</InputRow>

<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../utils/language"
    import T from "../helpers/T.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"
    import Center from "../system/Center.svelte"
    import InputRow from "./InputRow.svelte"

    type Item = {
        id: string
        [key: string]: any
    }

    export let items: Item[]
    export let allowOpen = true
    export let addDisabled = false
    export let nothingText = true

    let dispatch = createEventDispatcher()
    function openItem(id: string) {
        if (!allowOpen) return
        dispatch("open", id)
    }
    function deleteItem(id: string) {
        dispatch("delete", id)
    }
    function addItem() {
        dispatch("add")
    }
</script>

{#if items.length}
    {#each items as item}
        <InputRow>
            {#if allowOpen}
                <Button style="width: 100%;font-weight: normal;" title={translateText("titlebar.edit")} on:click={() => openItem(item.id)}>
                    <slot {item} />
                </Button>
            {:else}
                <slot {item} />
            {/if}

            <Button icon="delete" style="width: 40px;" title={translateText("actions.delete")} on:click={() => deleteItem(item.id)} white />
        </InputRow>
    {/each}
{:else if nothingText}
    <Center faded>
        <T id="empty.general" />
    </Center>

    <br />
{/if}

<Button variant="outline" style="width: 100%;" icon="add" disabled={addDisabled} on:click={addItem}>
    <T id="settings.add" />
</Button>

<script lang="ts">
    import { customMetadata } from "../../../stores"
    import { initializeMetadata } from "../../helpers/show"
    import T from "../../helpers/T.svelte"
    import HRule from "../../../lib/components/ui/h-rule/h-rule.svelte"
    import InputRow from "../../../lib/components/ui/input-row/input-row.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import CheckboxField from "../../../lib/components/ui/checkbox-field/checkbox-field.svelte"
    import TextField from "../../../lib/components/ui/text-field/text-field.svelte"

    $: defaultMetadata = Object.keys(initializeMetadata({}))

    let customMetadataValues: string[] = $customMetadata.custom
    let hidden: string[] = $customMetadata.disabled

    function toggleHidden(key: string) {
        if (hidden.includes(key)) hidden.splice(hidden.indexOf(key), 1)
        else hidden.push(key)

        hidden = hidden
        customMetadata.set({ ...$customMetadata, disabled: hidden })
    }

    function updateCustom(name: string, e: any) {
        let value = e.detail
        let index = customMetadataValues.findIndex((a) => a === name)
        if (index < 0) return

        customMetadataValues[index] = value
        customMetadata.set({ ...$customMetadata, custom: customMetadataValues })
    }

    function removeCustom(name: string) {
        let index = customMetadataValues.findIndex((a) => a === name)
        if (index < 0) return

        customMetadataValues.splice(index, 1)
        customMetadataValues = customMetadataValues
        customMetadata.set({ ...$customMetadata, custom: customMetadataValues })
    }

    function addCustom() {
        if (emptyEntry) return

        customMetadataValues.push("")
        customMetadataValues = customMetadataValues
        customMetadata.set({ ...$customMetadata, custom: customMetadataValues })
    }

    $: emptyEntry = customMetadataValues.find((a) => a === "") !== undefined
</script>

<!-- <p style="opacity: 0.6;font-size: 0.9em;text-align: center;padding-bottom: 10px;"><T id="tips.global_options" /></p> -->

<div>
    {#each defaultMetadata as key}
        <CheckboxField label="meta.{key}" checked={!hidden.includes(key)} on:change={() => toggleHidden(key)} />
    {/each}
</div>

<HRule title="sort.custom" />

{#each customMetadataValues as name}
    <InputRow>
        <TextField label="inputs.name" value={name} on:change={(e) => updateCustom(name, e)} autofocus={!name} />
        <Button icon="delete" on:click={() => removeCustom(name)} white />
    </InputRow>
{/each}

<Button icon="add" variant="outline" style="width: 100%;" disabled={emptyEntry} on:click={addCustom}>
    <T id="settings.add" />
</Button>

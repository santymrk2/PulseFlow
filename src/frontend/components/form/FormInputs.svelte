<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Input as TInput } from "../../../types/Input"
    import { clone } from "../helpers/array"
    import HRule from "../../lib/components/ui/h-rule/h-rule.svelte"
    import FormInput from "./FormInput.svelte"

    export let inputs: TInput[]
    export let title = ""

    let dispatch = createEventDispatcher()
    function changed(e: any, input: TInput) {
        let value = e.detail
        dispatch("change", clone({ ...input, value }))
    }
</script>

{#if title}
    <HRule {title} />
{/if}

{#each inputs as input}
    {#if input?.type}
        <FormInput {input} on:change={(e) => changed(e, input)} />
    {/if}
{/each}

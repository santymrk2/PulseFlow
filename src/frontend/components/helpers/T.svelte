<script lang="ts">
    import { dictionary, language } from "../../stores"

    interface Props {
        id: string
        index?: number
        lowercase?: boolean
        replace?: string[]
    }

    let {
        id,
        index = 0,
        lowercase = false,
        replace = []
    }: Props = $props()

    const hasPeriod = $derived(id?.includes("."))
    const periodIndex = $derived(id?.indexOf("."))
    const category = $derived(hasPeriod ? id.slice(0, periodIndex).replace("$:", "") : "")
    const key = $derived(hasPeriod ? id.slice(periodIndex + 1, id.length).replace(":$", "") : "")

    const keyString = $derived(replacePlaceholders($dictionary[category]?.[key] || "", replace))

    function replacePlaceholders(input: string, values: string[]) {
        if (!values.length) return input
        return input.replace(/\$(\d+)/g, (_, idx) => values[idx - 1] || "")
    }
</script>

{#key language}
    {#if keyString.includes("{}")}
        {keyString.split("{}")[index] || `[${id}]`}
    {:else if lowercase}
        {keyString.toLowerCase() || `[${id}]`}
    {:else}
        {keyString || `[${id}]`}
    {/if}
{/key}

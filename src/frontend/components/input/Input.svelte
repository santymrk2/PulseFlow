<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Input } from "../../../types/Input"
    import { activeEdit, activePage, activePopup, special } from "../../stores"
    import { translateText } from "../../utils/language"
    import { select } from "../helpers/select"
    import Button from "../../lib/components/ui/button/button.svelte"
    import MaterialCheckbox from "../inputs/MaterialCheckbox.svelte"
    import ColorField from "../../lib/components/ui/color-field/color-field.svelte"
    import SelectField from "../../lib/components/ui/select-field/select-field.svelte"
    import { commonInputs } from "./inputs"

    export let input: Input
    export let hasTimelineAction: boolean = false

    $: label = input.label ?? input.name ?? ""

    let dispatch = createEventDispatcher()
    function changed(e: any) {
        let value = e.detail
        dispatch("change", value)
    }

    $: enableKeyframe = $special.slideTimelineActive && $activePage === "edit" && ($activeEdit.type || "show") === "show"
</script>

{#if input.type === "dropdown"}
    <SelectField {label} {...input} options={input.options?.map((a) => ({ ...a, label: translateText(a.label) }))} on:change={changed} />

    <!-- custom edit -->
    {#if input.label === "items.timer" && input.value}
        <Button
            icon="edit"
            on:click={() => {
                select("timer", { id: input.value })
                activePopup.set("timer")
            }}
        />
    {/if}
{:else if input.type === "checkbox"}
    <MaterialCheckbox {label} checked={input.value} style="flex: 1;{input.style || ''}" on:change={changed} />
{:else if input.type === "color"}
    <ColorField {label} {...input} {...input.settings || {}} on:input={changed} />
{:else}
    <svelte:component this={commonInputs[input.type]} {label} {...input} {...input.settings || {}} {hasTimelineAction} on:change={changed} on:input={changed} on:keyframe {enableKeyframe} />
{/if}

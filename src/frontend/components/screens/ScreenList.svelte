<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { outputs, outputState } from "../../stores"
    import { translateText } from "../../utils/language"
    import Button from "../../lib/components/ui/button/button.svelte"
    import ListRow from "../../lib/components/ui/list-row/list-row.svelte"
    import SectionHeader from "../../lib/components/ui/section-header/section-header.svelte"
    import { keysToID, sortByName, sortObject } from "../helpers/array"
    import { toggleOutputs } from "../helpers/output"

    export let selectedOutputId: string | null = null

    const dispatch = createEventDispatcher()

    $: list = sortObject(sortByName(keysToID($outputs)), "stageOutput")
    $: audience = list.filter((o) => !o.stageOutput)
    $: stage = list.filter((o) => o.stageOutput)

    function select(id: string) {
        dispatch("select", id)
    }

    // en vivo = alguna salida del grupo está activa (mismo criterio que la barra superior)
    $: audienceLive = ($outputState || []).some((s: any) => s.active === true && audience.some((o) => o.id === s.id))
    $: stageLive = ($outputState || []).some((s: any) => s.active === true && stage.some((o) => o.id === s.id))

    function toggleGroup(group: "audience" | "stage") {
        const ids = (group === "stage" ? stage : audience).map((o) => o.id)
        toggleOutputs(ids)
    }
</script>

<!-- F12.3: columna de pantallas con el kit (section-header + list-row, 240 px) -->
<div class="group">
    <SectionHeader>
        {translateText("screen_config.audience")}
        {#snippet actions()}
            <Button variant="live" size="icon-sm" icon="outputs" iconSize={0.9} aria-pressed={audienceLive} title="screen_config.show_audience" onclick={() => toggleGroup("audience")} />
            <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="settings.new_output" onclick={() => dispatch("addAudience")} />
        {/snippet}
    </SectionHeader>
    {#each audience as out}
        <ListRow active={selectedOutputId === out.id} onclick={() => select(out.id)}>
            {out.name || out.id}
            {#snippet trailing()}
                <span class="res">{out.bounds?.width || 0}×{out.bounds?.height || 0}</span>
                {#if out.enabled && out.active}<span class="dot"></span>{/if}
            {/snippet}
        </ListRow>
    {/each}
</div>

<div class="group">
    <SectionHeader>
        {translateText("screen_config.stage")}
        {#snippet actions()}
            <Button variant="live" size="icon-sm" icon="stage" iconSize={0.9} aria-pressed={stageLive} title="screen_config.show_stage" onclick={() => toggleGroup("stage")} />
            <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="settings.new_output" onclick={() => dispatch("addStage")} />
        {/snippet}
    </SectionHeader>
    {#each stage as out}
        <ListRow active={selectedOutputId === out.id} onclick={() => select(out.id)}>
            {out.name || out.id}
            {#snippet trailing()}
                <span class="res">{out.bounds?.width || 0}×{out.bounds?.height || 0}</span>
                {#if out.enabled && out.active}<span class="dot"></span>{/if}
            {/snippet}
        </ListRow>
    {/each}
</div>

<style>
    .group {
        padding: 6px 0;
    }
    .res {
        font-size: 11px;
        opacity: 0.7;
    }
    .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--success);
    }
</style>

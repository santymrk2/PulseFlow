<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { outputs } from "../../stores"
    import { keysToID, sortByName, sortObject } from "../helpers/array"
    import { toggleOutputs } from "../helpers/output"
    import Icon from "../helpers/Icon.svelte"

    export let selectedOutputId: string | null = null

    const dispatch = createEventDispatcher()

    $: list = sortObject(sortByName(keysToID($outputs)), "stageOutput")
    $: audience = list.filter((o) => !o.stageOutput)
    $: stage = list.filter((o) => o.stageOutput)

    function select(id: string) {
        dispatch("select", id)
    }

    function toggleGroup(group: "audience" | "stage") {
        const ids = (group === "stage" ? stage : audience).map((o) => o.id)
        toggleOutputs(ids)
    }
</script>

<div class="group">
    <div class="group-header">
        <button class="group-toggle" on:click={() => toggleGroup("audience")} title="audience">●</button>
        <div class="group-title">Audiencia</div>
        <button class="add" on:click={() => dispatch("addAudience")} title="add">+</button>
    </div>
    {#each audience as out}
        <button class="item" class:selected={selectedOutputId === out.id} on:click={() => select(out.id)} on:contextmenu|preventDefault>
            <div class="item-main">
                <div class="item-name">{out.name || out.id}</div>
                <div class="item-sub">{out.bounds?.width || 0} × {out.bounds?.height || 0}</div>
            </div>
            {#if out.enabled && out.active}<span class="dot"></span>{/if}
        </button>
    {/each}
</div>

<div class="group">
    <div class="group-header">
        <button class="group-toggle" on:click={() => toggleGroup("stage")} title="stage">●</button>
        <div class="group-title">Stage</div>
        <button class="add" on:click={() => dispatch("addStage")} title="add">+</button>
    </div>
    {#each stage as out}
        <button class="item" class:selected={selectedOutputId === out.id} on:click={() => select(out.id)} on:contextmenu|preventDefault>
            <div class="item-main">
                <div class="item-name">{out.name || out.id}</div>
                <div class="item-sub">{out.bounds?.width || 0} × {out.bounds?.height || 0}</div>
            </div>
            {#if out.enabled && out.active}<span class="dot"></span>{/if}
        </button>
    {/each}
</div>

<style>
    .group {
        padding: 6px 0;
    }
    .group-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
    }
    .group-toggle {
        background: transparent;
        border: none;
        color: var(--text);
        cursor: pointer;
    }
    .group-title {
        flex: 1;
        font-size: 0.9em;
    }
    .add {
        background: transparent;
        border: none;
        color: var(--text);
        cursor: pointer;
        font-size: 1.1em;
    }
    .item {
        width: 100%;
        text-align: left;
        background: transparent;
        border: none;
        color: var(--text);
        display: flex;
        align-items: center;
        padding: 6px 12px 6px 22px;
        cursor: pointer;
        gap: 8px;
    }
    .item.selected {
        background-color: var(--primary-lighter);
    }
    .item:hover {
        background-color: var(--hover-bg, rgba(255, 255, 255, 0.04));
    }
    .item-main {
        flex: 1;
        min-width: 0;
    }
    .item-name {
        font-size: 0.9em;
    }
    .item-sub {
        font-size: 0.75em;
        opacity: 0.6;
    }
    .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: #2ecc71;
    }
</style>

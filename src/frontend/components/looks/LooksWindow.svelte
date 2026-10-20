<script lang="ts">
    import { onMount } from "svelte"
    import { activeLook, activePopup, looks, outputs } from "../../stores"
    import { applyLook, createLook } from "../helpers/looks"
    import { keysToID, sortByName } from "../helpers/array"
    import Modal from "../main/Modal.svelte"
    import LookGrid from "./LookGrid.svelte"
    import LookAdvanced from "./LookAdvanced.svelte"

    let list = []
    $: list = sortByName(keysToID($looks))
    let selected = $activeLook || list[0]?.id || "default"
    $: if ($activeLook && $activeLook !== selected) selected = $activeLook
    let showAdvanced = false

    function newLook() {
        const id = createLook("Nuevo look")
        selected = id
        activeLook.set(id)
    }

    function selectLook(id: string) {
        selected = id
        applyLook(id)
    }

    function rename(e: any, id: string) {
        looks.update((a) => {
            if (a[id]) a[id].name = e.target.value
            return a
        })
    }

    $: audienceOutputs = Object.entries($outputs)
        .filter(([_, o]) => !(o.stageOutput || o.kind === "stage"))
        .map(([id, o]) => ({ id, name: o.name || id }))

    onMount(() => {
        if (!Object.keys($looks).length) {
            createLook("Default")
            activeLook.set("default")
        }
    })
</script>

<Modal title="Looks" width={720} height={520} on:close={() => activePopup.set(null)}>
    <div class="container">
        <div class="left">
            <div class="live">En vivo: {$looks[$activeLook]?.name || $activeLook}</div>
            <div class="list-title">Presets</div>
            {#each list as look}
                <button class="item" class:selected={selected === look.id} on:click={() => selectLook(look.id)} on:contextmenu|preventDefault>
                    <input class="name" value={look.name} on:change={(e) => rename(e, look.id)} />
                </button>
            {/each}
            <button class="add" on:click={newLook}>+</button>
        </div>
        <div class="right">
            <div class="header">
                <div class="title">{$looks[selected]?.name || selected}</div>
                <div class="actions">
                    <button class="btn" on:click={() => applyLook(selected)}>Poner en vivo</button>
                    <button class="btn" on:click={() => (showAdvanced = !showAdvanced)}>Más opciones</button>
                </div>
            </div>
            <LookGrid lookId={selected} {audienceOutputs} />
            {#if showAdvanced}
                <LookAdvanced lookId={selected} />
            {/if}
            <div class="footer">
                <div class="trans">
                    <span>Transición</span>
                    <input
                        type="range"
                        min="0"
                        max="3000"
                        step="100"
                        value={$looks[selected]?.transitionMs || 1000}
                        on:change={(e) => {
                            const v = Number((e.target as HTMLInputElement).value)
                            looks.update((a) => {
                                if (a[selected]) a[selected].transitionMs = v
                                return a
                            })
                        }}
                    />
                    <span>{($looks[selected]?.transitionMs || 1000) / 1000}s</span>
                </div>
                <button class="btn primary" on:click={() => applyLook(selected)}>Guardar</button>
            </div>
        </div>
    </div>
</Modal>

<style>
    .container {
        display: flex;
        width: 100%;
        height: 100%;
        min-height: 0;
    }
    .left {
        width: 180px;
        background-color: var(--primary-darker);
        border-right: 1px solid var(--border-color, var(--primary-lighter));
        display: flex;
        flex-direction: column;
        padding: 8px;
        gap: 6px;
    }
    .live {
        font-size: 0.85em;
        opacity: 0.8;
    }
    .list-title {
        font-size: 0.75em;
        opacity: 0.6;
        margin-top: 6px;
    }
    .item {
        background: transparent;
        border: none;
        color: var(--text);
        padding: 4px 6px;
        border-radius: var(--radius, 4px);
        cursor: pointer;
    }
    .item.selected {
        background-color: var(--primary-lighter);
    }
    .name {
        background: transparent;
        border: none;
        color: var(--text);
        width: 100%;
    }
    .add {
        background: transparent;
        border: 1px solid var(--border-color, var(--primary-lighter));
        color: var(--text);
        padding: 4px;
        border-radius: var(--radius, 4px);
        cursor: pointer;
    }
    .right {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 10px;
        gap: 10px;
    }
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .title {
        font-size: 1.1em;
    }
    .actions {
        display: flex;
        gap: 6px;
    }
    .btn {
        background: transparent;
        border: 1px solid var(--border-color, var(--primary-lighter));
        color: var(--text);
        padding: 4px 8px;
        border-radius: var(--radius, 4px);
        cursor: pointer;
    }
    .btn.primary {
        background-color: var(--primary-lighter);
    }
    .footer {
        margin-top: auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .trans {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9em;
    }
</style>

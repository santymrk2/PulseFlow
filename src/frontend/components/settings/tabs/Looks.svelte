<script lang="ts">
    import { looks, activeLook } from "../../../stores"
    import { applyLook, createLook, deleteLook } from "../../helpers/looks"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    let newLookName = ""

    function handleCreate() {
        const name = newLookName.trim() || `Look ${Object.keys($looks).length + 1}`
        const id = createLook(name)
        newLookName = ""
        applyLook(id)
    }
</script>

<div class="looks">
    <div class="create">
        <MaterialTextInput bind:value={newLookName} label="Nombre" placeholder="Nombre del look" />
        <MaterialButton title="Crear look" on:click={handleCreate} />
    </div>

    <div class="list">
        {#each Object.entries($looks) as [id, look]}
            <div class="look" class:active={$activeLook === id}>
                <span class="name">{look.name}</span>
                <div class="actions">
                    <MaterialButton title="Aplicar" on:click={() => applyLook(id)} />
                    {#if id !== "default"}
                        <MaterialButton title="Eliminar" on:click={() => deleteLook(id)} />
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .looks {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
    }
    .create {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    .list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .look {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border: 1px solid var(--border-color, #333);
        border-radius: var(--radius, 8px);
    }
    .look.active {
        border-color: var(--secondary, #6cf);
    }
    .name {
        font-weight: 600;
    }
    .actions {
        display: flex;
        gap: 6px;
    }
</style>

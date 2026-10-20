<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import DisplayLayout from "./DisplayLayout.svelte"
    import { translateText } from "../../utils/language"

    export let displays: any[] = []

    const dispatch = createEventDispatcher()

    function refresh() {
        dispatch("refresh")
    }

    function identify() {
        dispatch("identify")
    }
</script>

<div class="wrap">
    {#if displays.length}
        <DisplayLayout {displays} width={220} height={130} selectable={false} fill />
    {:else}
        <div class="empty">{translateText("screen_config.no_monitors")}</div>
    {/if}
    <div class="row">
        <button class="btn" on:click={refresh}>{translateText("screen_config.refresh")}</button>
        <button class="btn" on:click={identify}>{translateText("screen_config.identify")}</button>
    </div>
</div>

<style>
    .wrap {
        padding: 6px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .empty {
        height: 90px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.6;
        font-size: 0.8em;
    }
    .row {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .btn {
        background: transparent;
        border: 1px solid var(--border-color, var(--primary-lighter));
        color: var(--text);
        padding: 4px 6px;
        border-radius: var(--radius, 4px);
        text-align: left;
        cursor: pointer;
        font-size: 0.8em;
    }
    .btn:hover {
        background-color: var(--hover-bg, var(--bg-hover));
    }
</style>

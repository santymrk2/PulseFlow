<script lang="ts">
    import { createEventDispatcher } from "svelte"
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
    {#if !displays.length}
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
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-subtle);
        font-size: var(--text-xs);
    }
    .row {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .btn {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text);
        padding: 0 8px;
        height: 28px;
        border-radius: var(--radius);
        text-align: left;
        cursor: pointer;
        font-size: var(--text-sm);
    }
    .btn:hover {
        background-color: var(--hover-bg, var(--bg-hover));
    }
</style>

<script lang="ts">
    import { activePopup, saved } from "../../../stores"
    import { closeApp, save, saveComplete } from "../../../utils/save"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import T from "../../helpers/T.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"

    // avisa al backend: sin esto, volver a cerrar entre 10 y 60 s después saldría sin guardar ni preguntar
    function cancel() {
        activePopup.set(null)
        sendMain(Main.CLOSE_CANCELLED)
    }

    const actions = {
        n: cancel,
        q: () => closeApp(),
        y: () => ($saved ? saveComplete({ closeWhenFinished: true }) : save(true))
    }

    function keydown(e: KeyboardEvent) {
        if (actions[e.key]) {
            e.preventDefault()
            actions[e.key]()
        }
    }

    // auto close after X seconds if $errorHasOccurred??
</script>

<svelte:window on:keydown={keydown} />

<div class="list">
    <Button variant="outline" style="width: 100%;" on:click={cancel}>
        <T id="popup.cancel" />
        <span>N</span>
    </Button>
    {#if $saved}
        <Button variant="default" style="margin-top: 8px;width: 100%;" on:click={() => saveComplete({ closeWhenFinished: true })}>
            <T id="main.quit" />
            <span>Y</span>
        </Button>
    {:else}
        <Button variant="outline" style="width: 100%;" on:click={closeApp}>
            <div style="opacity: 0.7;"><T id="popup.quit" /></div>
            <span>Q</span>
        </Button>
        <Button variant="default" style="margin-top: 8px;width: 100%;" on:click={() => save(true)}>
            <T id="popup.save_quit" />
            <span>Y</span>
        </Button>
    {/if}
</div>

<style>
    .list {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    span {
        display: flex;
        justify-content: end;
        align-items: center;

        position: absolute;
        inset-inline-end: 15px;

        color: var(--text);
        opacity: 0.6;
        font-size: 0.9em;
    }
</style>

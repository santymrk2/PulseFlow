<script lang="ts">
    import { onDestroy } from "svelte"
    import { activePopup, saved } from "../../../stores"
    import { closeApp, save, saveComplete } from "../../../utils/save"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import T from "../../helpers/T.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"

    // Cerrar el aviso sin salir (Cancelar, N, Esc, clic afuera, ✕) avisa al backend: sin esto, volver a cerrar
    // entre 10 y 60 s después saldría sin guardar ni preguntar. Las acciones de salir marcan `quitting`.
    let quitting = false
    onDestroy(() => {
        if (!quitting) sendMain(Main.CLOSE_CANCELLED)
    })

    function cancel() {
        activePopup.set(null)
    }
    function quit() {
        quitting = true
        closeApp()
    }
    function saveAndQuit() {
        quitting = true
        if ($saved) saveComplete({ closeWhenFinished: true })
        else save(true)
    }

    const actions = {
        n: cancel,
        q: quit,
        y: saveAndQuit
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
        <Button variant="default" style="margin-top: 8px;width: 100%;" on:click={saveAndQuit}>
            <T id="main.quit" />
            <span>Y</span>
        </Button>
    {:else}
        <Button variant="outline" style="width: 100%;" on:click={quit}>
            <div style="opacity: 0.7;"><T id="popup.quit" /></div>
            <span>Q</span>
        </Button>
        <Button variant="default" style="margin-top: 8px;width: 100%;" on:click={saveAndQuit}>
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

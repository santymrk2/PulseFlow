<script lang="ts">
    import { drawerTabsData } from "../../stores"
    import Audio from "./audio/Audio.svelte"
    import Scripture from "./bible/Scripture.svelte"
    import Calendar from "./calendar/Calendar.svelte"
    import Media from "./media/Media.svelte"
    import Actions from "./pages/Actions.svelte"
    import Interactions from "./pages/Interactions.svelte"
    import OBS from "./pages/OBS.svelte"
    import Scenes from "./pages/Scenes.svelte"
    import Shows from "./pages/Shows.svelte"
    import Variables from "./pages/Variables.svelte"
    import Timers from "./timers/Timers.svelte"

    export let id: string
    $: active = $drawerTabsData[id]?.activeSubTab || null

    let streams: MediaStream[] = []
    $: if (id !== "media" || active) stopStreams()

    function stopStreams() {
        streams.forEach((stream) => {
            stream.getTracks().forEach((track) => {
                track.enabled = false
                track.stop()
            })
        })
    }
</script>

<div class="main">
    {#if id === "shows"}
        <Shows {active} />
    {:else if id === "media"}
        <Media {active} bind:streams />
    {:else if id === "audio"}
        <Audio {active} />
    {:else if id === "scripture"}
        <Scripture {active} />
    {:else if id === "calendar"}
        <Calendar {active} />
    {:else if id === "functions"}
        {#if active === "actions"}
            <Actions />
        {:else if active === "timer"}
            <Timers />
        {:else if active === "variables"}
            <Variables />
        {:else if active === "scenes"}
            <Scenes />
        {:else if active === "interactions"}
            <Interactions />
        {:else if active === "obs"}
            <OBS />
        {/if}
    {/if}
</div>

<style>
    .main {
        position: relative;

        overflow-y: auto;

        display: flex;
        flex-direction: column;
        flex: 1;

        background-color: var(--primary-darker);
    }

    .warning {
        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darkest);
    }
</style>

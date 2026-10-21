<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import type { Output } from "../../../types/Output"
    import { activeShow, labelsDisabled, outputs, showsCache, slideTimers } from "../../stores"
    import { getActiveOutputs } from "../helpers/output"
    import { _show } from "../helpers/shows"
    import Tabs from "../main/Tabs.svelte"
    import Audio from "../output/tools/Audio.svelte"
    import Overlay from "../output/tools/Overlay.svelte"
    import TimerControls from "../output/tools/TimerControls.svelte"
    import NextTimer from "../output/tools/NextTimer.svelte"
    import Media from "./tools/Media.svelte"
    import Metadata from "./tools/Metadata.svelte"
    import SlideGroups from "./tools/SlideGroups.svelte"

    const tabs: TabsObj = {
        audio: { name: "tabs.audio", icon: "audio" },
        overlays: { name: "clear.overlays", icon: "overlays" },
        timers: { name: "tools.timers", icon: "clock" },
        groups: { name: "tools.groups", icon: "groups" },
        metadata: { name: "tools.metadata", icon: "info" },
        media: { name: "tools.media", icon: "media", remove: true }
    }
    let active: string = "audio"

    $: showId = $activeShow?.id
    $: currentShow = $showsCache[showId || ""]
    $: currentOutput = (() => {
        const id = getActiveOutputs($outputs, true, true, true)[0]
        return id ? $outputs[id] || {} : ({} as Output)
    })()

    // media
    $: if (currentShow) checkMedia()
    function checkMedia() {
        let refs = _show().layouts().ref()

        let disableMedia = true

        if (refs.some((ref) => ref.some((slide) => slide.data.background))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.overlays?.length))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.audio))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.mics))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.actions?.slideActions?.length))) disableMedia = false

        tabs.media.remove = disableMedia
    }

    $: reference = currentShow?.reference?.type

    let slideTimer: any = {}
    $: slideTimer = currentOutput?.id ? $slideTimers[currentOutput.id] || {} : {}
</script>

<div class="main border" class:labels={!$labelsDisabled}>
    {#if reference === "lessons"}
        <!-- nothing needed -->
    {:else}
        <Tabs {tabs} bind:active labels={false} />

        {#if currentShow}
            {#if active === "audio"}
                <div class="content"><Audio /></div>
            {:else if active === "overlays"}
                <div class="content"><Overlay {currentOutput} /></div>
            {:else if active === "timers"}
                <div class="content">
                    {#if slideTimer?.timer}
                        <NextTimer {currentOutput} timer={slideTimer?.timer ? slideTimer : { time: 0, paused: true, timer: {} }} />
                    {:else}
                        <TimerControls />
                    {/if}
                </div>
            {:else if active === "groups"}
                <SlideGroups />
            {:else if active === "media"}
                <div class="content"><Media /></div>
            {:else if active === "metadata"}
                <div class="content"><Metadata /></div>
            {/if}
        {/if}
    {/if}
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }
    .content {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>

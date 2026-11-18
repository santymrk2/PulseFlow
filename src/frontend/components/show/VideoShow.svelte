<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { MediaStyle } from "../../../types/Main"
    import { outputs, playingVideos } from "../../stores"
    import { getFirstActiveOutput } from "../helpers/output"
    import MediaControls from "../output/tools/MediaControls.svelte"
    import Player from "../system/Player.svelte"
    import VideoSlider from "../output/VideoSlider.svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { VideoShow } from "../../react/show/VideoShow"

    export let mediaPath: string
    export let show
    export let mediaStyle: MediaStyle = {}

    // Los tres componentes que usan bind: siguen montados acá; React los reubica en su layout.
    let videoData = { paused: false, muted: true, duration: 0, loop: false, softLoop: 0 }
    let videoTime = 0

    $: showId = show?.id
    $: type = show?.type
    $: outputId = $playingVideos.find((a) => a.path === mediaPath)?.linkedOutputIds?.[0] || getFirstActiveOutput()?.id || ""
    $: currentOutput = outputId ? $outputs[outputId] || null : null

    let playerHost: HTMLDivElement | undefined
    let sliderHost: HTMLDivElement | undefined
    let controlsHost: HTMLDivElement | undefined
</script>

<ReactIsland
    component={VideoShow}
    props={{
        mediaPath,
        show,
        mediaStyle,
        videoData,
        videoTime,
        onVideoDataChange: (data) => (videoData = data),
        onVideoTimeChange: (time) => (videoTime = time),
        playerHost,
        sliderHost,
        controlsHost
    }}
/>

<div bind:this={playerHost} style="display: contents">
    {#if type === "player"}
        <Player id={showId} {outputId} preview bind:videoData bind:videoTime />
    {/if}
</div>

<div bind:this={sliderHost} style="display: contents">
    <VideoSlider {outputId} path={mediaPath} bind:videoData bind:videoTime />
</div>

<div bind:this={controlsHost} style="display: contents">
    {#if currentOutput}
        <MediaControls {currentOutput} {outputId} big />
    {/if}
</div>

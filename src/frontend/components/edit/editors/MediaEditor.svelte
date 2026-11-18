<script lang="ts">
    // Migrado a React en F24.21b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { MediaEditor } from "../../../react/edit/MediaEditor"
    import type { MediaStyle } from "../../../../types/Main"
    import Media from "../../output/layers/Media.svelte"
    import VideoSlider from "../../output/VideoSlider.svelte"

    let videoData = { paused: false, muted: true, duration: 0, loop: true }
    let videoTime = 0

    let mediaPath = ""
    let mediaStyle: MediaStyle = {}
    let type = ""

    let mediaHost: HTMLDivElement | undefined
    let sliderHost: HTMLDivElement | undefined
</script>

<ReactIsland
    component={MediaEditor}
    props={{
        videoData,
        videoTime,
        onVideoDataChange: (data) => (videoData = data),
        onVideoTimeChange: (time) => (videoTime = time),
        onComputedChange: (detail) => {
            mediaPath = detail.mediaPath
            mediaStyle = detail.mediaStyle
            type = detail.type
        },
        mediaHost,
        sliderHost
    }}
/>

<div bind:this={mediaHost} style="display: contents">
    {#if mediaPath}
        <Media path={mediaPath} {mediaStyle} bind:videoData bind:videoTime mirror />
    {/if}
</div>

<div bind:this={sliderHost} style="display: contents">
    {#if type === "video"}
        <VideoSlider path={mediaPath} bind:videoData bind:videoTime big />
    {/if}
</div>

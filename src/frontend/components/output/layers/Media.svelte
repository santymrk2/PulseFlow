<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte (export let/bind/on:*) mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { MediaStyle } from "../../../../types/Main"
    import type { OutBackground } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import MediaReact from "../../../react/output/Media"

    export let outputId: string = ""
    export let path: string
    export let path2 = ""
    export let data: OutBackground = {}
    export let animationStyle = ""
    export let mediaStyle: MediaStyle = {}
    export let mirror = false
    export let fadingOut = false
    export let video: HTMLVideoElement | null = null
    export let videoData: { paused: boolean; muted: boolean; duration: number; loop?: boolean } = { paused: false, muted: true, duration: 0, loop: data.loop === true }
    export let videoTime = 0

    const dispatch = createEventDispatcher()
</script>

<ReactIsland
    component={MediaReact}
    props={{
        outputId,
        path,
        path2,
        data,
        animationStyle,
        mediaStyle,
        mirror,
        fadingOut,
        video,
        videoData,
        videoTime,
        onVideoChange: (value: HTMLVideoElement | null) => (video = value),
        onVideoDataChange: (value: typeof videoData) => (videoData = value),
        onVideoTimeChange: (value: number) => (videoTime = value),
        onPathChange: (value: string) => (path = value),
        onLoaded: (e: unknown) => dispatch("loaded", e),
        onEnded: (e: unknown) => dispatch("ended", e),
        onError: (e: unknown) => dispatch("error", e)
    }}
/>

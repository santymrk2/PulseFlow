<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Video } from "../../react/media/Video"

    export let outputId: string
    export let path: string
    export let syncPath = ""
    export let video: HTMLVideoElement | null = null
    export let videoData: unknown = { paused: false, loop: false, softLoop: 0 }
    export let videoTime = 0
    export let startAt = 0

    export let mediaStyle: MediaStyle = {}
    export let animationStyle = ""
    export let mirror = false
    export let fadingOut = false

    const dispatch = createEventDispatcher()
</script>

<ReactIsland
    component={Video}
    props={{
        outputId,
        path,
        syncPath,
        video,
        videoData,
        videoTime,
        startAt,
        mediaStyle,
        animationStyle,
        mirror,
        fadingOut,
        onVideoChange: (v: HTMLVideoElement | null) => (video = v),
        onVideoDataChange: (d: unknown) => (videoData = d),
        onVideoTimeChange: (t: number) => (videoTime = t),
        onLoaded: (value: boolean) => dispatch("loaded", value),
        onError: (event: Event) => dispatch("error", event),
        onEnded: (event: Event) => dispatch("ended", event)
    }}
/>

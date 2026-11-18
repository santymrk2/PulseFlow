<script lang="ts">
    // Migrado a React en F24.20c (rezagado F24.17h). Cascarón: conserva API Svelte (export let/bind/on:*).
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import VimeoReact from "../../../react/drawer/player/Vimeo"

    export let videoData = { paused: false, muted: true, loop: false, duration: 0 }
    export let videoTime = 0
    export let actualVideoTime = 0
    export let id
    export let preview

    const dispatch = createEventDispatcher()
</script>

<ReactIsland
    component={VimeoReact}
    props={{
        id,
        preview,
        videoData,
        videoTime,
        actualVideoTime,
        onVideoDataChange: (value: typeof videoData) => (videoData = value),
        onVideoTimeChange: (value: number) => (videoTime = value),
        onActualVideoTimeChange: (value: number) => (actualVideoTime = value),
        onLoaded: () => dispatch("loaded", true)
    }}
/>

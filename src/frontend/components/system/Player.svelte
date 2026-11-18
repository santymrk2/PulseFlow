<script lang="ts">
    // Migrado a React en F24.20c (rezagado F24.17h). Cascarón: conserva API Svelte (export let/bind/on:*).
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import PlayerReact from "../../react/system/Player"

    export let id: string
    export let outputId = ""
    export let preview = false
    export let videoData = { muted: true, paused: false, loop: false, duration: 0 }
    export let videoTime = 0

    const dispatch = createEventDispatcher()
</script>

<ReactIsland
    component={PlayerReact}
    props={{
        id,
        outputId,
        preview,
        videoData,
        videoTime,
        onVideoDataChange: (value: typeof videoData) => (videoData = value),
        onVideoTimeChange: (value: number) => (videoTime = value),
        onLoaded: () => dispatch("loaded"),
        onEnded: () => dispatch("ended")
    }}
/>

<script lang="ts">
    // Migrado a React en F24.20c (rezagado F24.17h). Cascarón: conserva API Svelte (export let/on:*).
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import YouTubePlayerReact from "../../../react/drawer/player/YouTubePlayer"

    export let videoId: string
    export let options: Record<string, unknown> = {}

    const dispatch = createEventDispatcher()
</script>

<ReactIsland
    component={YouTubePlayerReact}
    props={{
        videoId,
        options,
        className: $$props.class || "",
        onReady: (e: unknown) => dispatch("ready", e),
        onError: (e: unknown) => dispatch("error", e),
        onStateChange: (e: unknown) => dispatch("stateChange", e),
        onEnd: (e: unknown) => dispatch("end", e),
        onPlay: (e: unknown) => dispatch("play", e),
        onPause: (e: unknown) => dispatch("pause", e)
    }}
/>

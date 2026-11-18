<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte (export let/bind/on:*) mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import CameraReact from "../../react/output/Camera"

    export let id: string
    export let groupId: string
    export let preview = false
    export let videoElem: HTMLVideoElement | undefined = undefined

    const dispatch = createEventDispatcher()
</script>

<ReactIsland
    component={CameraReact}
    props={{
        id,
        groupId,
        preview,
        videoElem,
        onVideoElemChange: (elem) => (videoElem = elem ?? undefined),
        className: $$props.class || "",
        style: $$props.style || "",
        onLoaded: () => dispatch("loaded", true)
    }}
/>

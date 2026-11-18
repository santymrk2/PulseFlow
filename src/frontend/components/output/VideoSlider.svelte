<script lang="ts">
    // Migrado a React en F24.20b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { VideoSlider } from "../../react/output/VideoSlider"

    export let outputId: string | undefined = undefined
    export let path: string | undefined

    export let videoData: any
    export let videoTime: any
    export let big = false
    export let disabled = false
    export let changeValue = 0
</script>

<ReactIsland
    component={VideoSlider}
    props={{
        outputId,
        path,
        videoData,
        videoTime,
        big,
        disabled,
        changeValue,
        onVideoDataChange: (data) => (videoData = data),
        onVideoTimeChange: (time) => (videoTime = time),
        onChangeValueChange: (value) => (changeValue = value)
    }}
/>

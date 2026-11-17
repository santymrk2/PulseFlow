<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Website as WebsiteReact } from "../../../react/slide/views/Website"

    export let src: string
    export let zoom: number | undefined = undefined
    export let disablePreview = false
    export let outputId = ""
</script>

<ReactIsland component={WebsiteReact} props={{ src, zoom, disablePreview, outputId }} />

<script lang="ts">
    // Migrado a React en F24.22. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Image } from "../../react/media/Image"

    export let path: string
    export let mediaStyle: MediaStyle = {}

    const dispatch = createEventDispatcher<{ loaded: boolean; error: Event }>()
</script>

<ReactIsland
    component={Image}
    props={{
        path,
        mediaStyle,
        onLoaded: (value: boolean) => dispatch("loaded", value),
        onError: (event: Event) => dispatch("error", event)
    }}
/>

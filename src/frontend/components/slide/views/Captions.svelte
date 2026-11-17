<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Captions as CaptionsReact } from "../../../react/slide/views/Captions"

    export let item: unknown = undefined
</script>

<ReactIsland component={CaptionsReact} props={{ item }} />

<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Weather as WeatherData } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { Weather as WeatherReact } from "../../../react/slide/views/Weather"

    export let data: WeatherData
</script>

<ReactIsland component={WeatherReact} props={{ data }} />

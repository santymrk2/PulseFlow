<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Clock } from "../../react/system/Clock"

    export let item: any = {}
    export let style = true
    export let fontStyle = ""
    export let type: "digital" | "analog" | "custom" = "digital"
    export let dateFormat = "none"
    export let customFormat = "hh:mm a"
    export let offsetDays = 0
    export let showTime = true
    export let seconds = true
</script>

<ReactIsland component={Clock} props={{ item, style, fontStyle, type, dateFormat, customFormat, offsetDays, showTime, seconds }} />

<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { DynamicEvents as DynamicEventsReact } from "../../../react/slide/views/DynamicEvents"

    export let edit = false
    export let textSize = 80
    export let maxEvents = 5
    export let startDaysFromToday = 0
    export let justOneDay = false
    export let enableStartDate = false
    export let startDate = ""
    export let startTime = "00:00"
    export let fromTime = "00:00"
    export let toTime = "00:00"
</script>

<ReactIsland
    component={DynamicEventsReact}
    props={{ edit, textSize, maxEvents, startDaysFromToday, justOneDay, enableStartDate, startDate, startTime, fromTime, toTime }}
/>

<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { AnalogClock } from "../../react/system/AnalogClock"

    export let date: Date
    export let h: number
    export let m: number
    export let s: number
    export let seconds = true
</script>

<ReactIsland component={AnalogClock} props={{ date, h, m, s, seconds }} />

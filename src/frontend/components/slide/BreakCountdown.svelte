<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { BreakCountdown } from "../../react/slide/BreakCountdown"

    export let activeKey: string = ""
    export let breakDuration: number = 0
    export let ratio: number = 1
</script>

<ReactIsland component={BreakCountdown} props={{ activeKey, breakDuration, ratio }} />

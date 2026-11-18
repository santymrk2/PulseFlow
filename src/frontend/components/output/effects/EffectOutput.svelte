<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Transition } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import EffectOutputReact from "../../../react/output/EffectOutput"

    export let ids: string[]
    export let transition: Transition
    export let mirror = false
</script>

<ReactIsland component={EffectOutputReact} props={{ ids, transition, mirror }} />

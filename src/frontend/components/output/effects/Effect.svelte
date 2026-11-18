<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Effect } from "../../../../types/Effects"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import EffectReact from "../../../react/output/Effect"

    export let effect: (Effect & { id?: string }) | undefined
    export let preview = false
    export let edit = false
</script>

<ReactIsland component={EffectReact} props={{ effect, preview, edit }} />

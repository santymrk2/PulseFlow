<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Show } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { EffectPreview } from "../../../react/show/effect/EffectPreview"

    export let show: Show
</script>

<ReactIsland component={EffectPreview} props={{ show }} />

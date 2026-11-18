<script lang="ts">
    // Migrado a React en F24.21a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { CategoryPicker } from "../../react/edit/CategoryPicker"

    export let kind: "templates" | "overlays"
    export let extraOptions: { value: string; label: string }[] = []
</script>

<ReactIsland component={CategoryPicker} props={{ kind, extraOptions }} />

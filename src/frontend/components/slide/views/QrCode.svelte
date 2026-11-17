<script lang="ts">
    // Migrado a React en F24.18a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { QrCode as QrCodeReact } from "../../../react/slide/views/QrCode"

    export let item: Item
    export let edit = false
</script>

<ReactIsland component={QrCodeReact} props={{ item, edit }} />

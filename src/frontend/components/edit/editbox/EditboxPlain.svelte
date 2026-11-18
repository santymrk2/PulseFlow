<script lang="ts">
    // Migrado a React en F24.21c. Cascarón temporal: conserva la API Svelte.
    import type { Item } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { EditboxPlain as ReactEditboxPlain } from "../../../react/edit/editbox/EditboxPlain"

    export let item: Item | null
    export let index: number
    export let ratio: number
    export let hideMovebox = false
</script>

<ReactIsland component={ReactEditboxPlain} props={{ item, index, ratio, hideMovebox }} />

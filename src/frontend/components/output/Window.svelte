<script lang="ts">
    // Migrado a React en F24.20b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Window } from "../../react/output/Window"

    export let id: string

    const dispatch = createEventDispatcher<{ loaded: boolean }>()
</script>

<ReactIsland component={Window} props={{ id, class: $$props.class, style: $$props.style, onLoaded: (detail: boolean) => dispatch("loaded", detail) }} />

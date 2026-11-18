<script lang="ts">
    // Migrado a React en F24.20c. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import SceneMediaReact from "../../../react/output/SceneMedia"

    export let media: unknown = null
    export let preview = false
</script>

<ReactIsland component={SceneMediaReact} props={{ media, preview, className: $$props.class || "", style: $$props.style || "" }} />

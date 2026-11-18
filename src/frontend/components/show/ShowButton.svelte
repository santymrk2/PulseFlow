<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ShowButton } from "../../react/show/ShowButton"

    export let id: string
    export let show: any // ShowList | ShowRef
    export let data: null | string = null
    export let index: null | number = null
    export let isProject = false
    export let icon = false
</script>

<ReactIsland component={ShowButton} props={{ id, show, data, index, isProject, icon, className: $$props.class || "", style: $$props.style || undefined }} />

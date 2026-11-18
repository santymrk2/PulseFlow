<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { Tree } from "../../../types/Projects"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ProjectContentList } from "../../react/show/ProjectContentList"

    export let tree: Tree[]
    export let recentlyUsedList: any[] = []
    export let isTemplate: boolean = false

    const dispatch = createEventDispatcher()
</script>

<ReactIsland component={ProjectContentList} props={{ tree, recentlyUsedList, isTemplate, onScrollElem: (elem: HTMLElement) => dispatch("scrollElem", elem) }} />

<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { MediaPicker } from "../../react/show/MediaPicker"

    export let id: string
    export let filter: any
    export let title = ""
    export let multiple = false
    export let clearOnClick = false
    export let center = true

    const dispatch = createEventDispatcher<{ picked: string | string[] }>()
    let slotHost: HTMLDivElement | undefined
</script>

<ReactIsland component={MediaPicker} props={{ id, filter, title, multiple, clearOnClick, center, style: $$props.style || null, slotHost, onPicked: (files) => dispatch("picked", files) }} />

<!-- El contenido del slot se monta aquí y React lo reubica dentro del botón. -->
<div bind:this={slotHost} style="display: contents">
    <slot />
</div>

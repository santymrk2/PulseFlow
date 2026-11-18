<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Cropping, Resolution } from "../../../types/Settings"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Zoomed } from "../../react/slide/Zoomed"

    export let id = ""
    export let background: string = "#000000"
    export let backgroundDuration = 800
    export let center = false
    export let zoom = true
    export let mirror = false
    export let disableStyle = false
    export let isStage = false
    export let checkered = false
    export let border = false
    export let align = ""
    export let outline = ""
    export let disabled = false
    export let relative = false
    export let aspectRatio = true
    export let hideOverflow = true
    export let customZoom = 1
    export let cropping: Cropping | undefined = { top: 0, right: 0, bottom: 0, left: 0 }
    export let styleIdOverride = ""
    export let resolution: Resolution | undefined = undefined
    export let ratio = 1
    export let style = ""

    let slotHost: HTMLDivElement | undefined
</script>

<ReactIsland
    component={Zoomed}
    props={{
        id,
        background,
        backgroundDuration,
        center,
        zoom,
        mirror,
        disableStyle,
        isStage,
        checkered,
        border,
        align,
        outline,
        disabled,
        relative,
        aspectRatio,
        hideOverflow,
        customZoom,
        cropping,
        styleIdOverride,
        resolution,
        style,
        slotHost,
        onRatioChange: (value: number) => (ratio = value)
    }}
/>

<!-- El contenido del slot se monta aquí y React lo reubica dentro del `.slide`. -->
<div bind:this={slotHost} style="display: contents">
    <slot {ratio} />
</div>

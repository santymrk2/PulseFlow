<script lang="ts">
    // Migrado a React en F24.21b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { onDestroy } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { OverlayEditor } from "../../../react/edit/OverlayEditor"
    import { activeEdit, outputs, overlays, previewOutputId, styles } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getResolution } from "../../helpers/output"
    import { getStyles } from "../../helpers/style"
    import { send } from "../../../utils/request"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Zoomed from "../../slide/Zoomed.svelte"
    import DropArea from "../../system/DropArea.svelte"
    import Snaplines from "../../system/Snaplines.svelte"
    import Editbox from "../editbox/Editbox.svelte"

    $: currentId = $activeEdit.id!
    let Slide = clone($overlays[currentId])
    $: if (currentId) Slide = clone($overlays[currentId])
    const unsubscribe = overlays.subscribe((a) => (Slide = clone(a[currentId])))
    onDestroy(unsubscribe)

    let lines: [string, number][] = []
    let mouse: any = null
    let newStyles: { [key: string]: string | number } = {}
    $: active = $activeEdit.items || []

    let lastActiveIds = ""
    $: if (active.join(",") !== lastActiveIds) {
        newStyles = {}
        lastActiveIds = active.join(",")
    }

    let width = 0
    let height = 0
    let ratio = 1
    let zoom = 1

    $: resolution = getResolution(null, { $outputs, $styles, $previewOutputId })
    $: widthOrHeight = getStyleResolution(resolution, width, height, "fit", { zoom })

    $: {
        if (active.length) updateStyles()
    }

    function updateStyles() {
        if (!Object.keys(newStyles).length || !Slide?.items) return

        let items = Slide.items
        let values: string[] = []
        active.forEach((id) => {
            let item = items[id]
            if (!item) return
            let styles = getStyles(item.style)
            let textStyles = ""

            const itemNewStyles = (newStyles as any).__multiPositions ? (newStyles as any).__multiPositions[id] || {} : newStyles

            Object.entries(itemNewStyles).forEach(([key, value]) => (styles[key] = String(value)))
            Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

            values.push(textStyles)
        })

        if (!values.length) return
        let override = "overlay_items#" + $activeEdit.id + "indexes#" + active.join(",")
        history({ id: "UPDATE", newData: { key: "items", indexes: active, subkey: "style", data: values }, oldData: { id: $activeEdit.id }, location: { page: "edit", id: "overlay_items", override } })
        send(OUTPUT, ["OVERLAY"], $overlays)
    }

    let canvasHost: HTMLDivElement | undefined
</script>

<ReactIsland
    component={OverlayEditor}
    props={{
        newStyles,
        onZoomChange: (value) => (zoom = value),
        onSizeChange: (size) => {
            width = size.width
            height = size.height
        },
        canvasHost
    }}
/>

<div bind:this={canvasHost} style="display: contents">
    {#if Slide}
        <DropArea id="edit" file>
            <Zoomed background="transparent" checkered border {resolution} style={widthOrHeight} bind:ratio hideOverflow={false} center>
                <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
                {#each Slide.items || [] as item, index}
                    <Editbox ref={{ type: "overlay", id: currentId }} {item} {index} {ratio} bind:mouse />
                {/each}
            </Zoomed>
        </DropArea>
    {/if}
</div>

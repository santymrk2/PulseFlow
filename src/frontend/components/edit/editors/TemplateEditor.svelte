<script lang="ts">
    // Migrado a React en F24.21b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { onDestroy } from "svelte"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { TemplateEditor } from "../../../react/edit/TemplateEditor"
    import { activeEdit, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getStyles } from "../../helpers/style"
    import TemplateSlide from "../../drawer/pages/TemplateSlide.svelte"

    let currentId = $activeEdit.id || ""
    $: currentId = $activeEdit.id || ""

    let newStyles: { [key: string]: string | number } = {}
    $: active = $activeEdit.items || []

    let lastActiveIds = ""
    $: if (active.join(",") !== lastActiveIds) {
        newStyles = {}
        lastActiveIds = active.join(",")
    }

    let width = 0
    let height = 0
    let zoom = 1
    let ratio = 1

    let templateSlideHost: HTMLDivElement | undefined

    $: slide = clone($templates[currentId])

    $: {
        if (active.length) updateStyles()
        else {
            // no-op
        }
    }

    function updateStyles() {
        if (!Object.keys(newStyles).length || !slide?.items) return

        let items = slide.items
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
        let override = "template_items#" + $activeEdit.id + "indexes#" + active.join(",")
        history({ id: "UPDATE", newData: { key: "items", indexes: active, subkey: "style", data: values }, oldData: { id: $activeEdit.id }, location: { page: "edit", id: "template_items", override } })
    }

    onDestroy(() => {})
</script>

<ReactIsland
    component={TemplateEditor}
    props={{
        newStyles,
        onZoomChange: (value) => (zoom = value),
        onSizeChange: (size) => {
            width = size.width
            height = size.height
        },
        templateSlideHost
    }}
/>

<div bind:this={templateSlideHost} style="display: contents">
    {#if $templates[currentId]}
        <TemplateSlide bind:newStyles templateId={currentId} template={$templates[currentId]} edit {width} {height} {zoom} bind:ratio />
    {/if}
</div>

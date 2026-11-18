<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { Item } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { SlideItems } from "../../react/slide/SlideItems"

    export let item: Item
    export let edit = false
    export let itemElem: HTMLElement | undefined = undefined
    export let slideIndex = 0
    export let preview = false
    export let miniPreview = false
    export let isStage = false
    export let cropPreviewMode = false
    export let isTemplatePreview = false
    export let smallFontSize = false
    export let fontSize = 0
    export let outputId = ""
    export let ratio = 1
    export let index = -1
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        layoutId?: string
        id: string
    }
</script>

<ReactIsland component={SlideItems} props={{ item, edit, itemElem, slideIndex, preview, miniPreview, isStage, cropPreviewMode, isTemplatePreview, smallFontSize, fontSize, outputId, ratio, index, ref }} />

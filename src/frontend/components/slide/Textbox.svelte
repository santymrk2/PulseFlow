<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { Styles } from "../../../types/Settings"
    import type { Item, Transition } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Textbox } from "../../react/slide/Textbox"

    export let item: Item
    export let itemIndex = -1
    export let slideIndex = 0
    export let preview = false
    export let miniPreview = false
    export let isTemplatePreview = false
    export let mirror = true
    export let isOutputted = false
    export let ratio = 1
    export let outputId = ""
    export let filter = ""
    export let backdropFilter = ""
    export let key = false
    export let transition: Transition | null = null
    export let smallFontSize = false
    export let animationStyle: any = {}
    export let dynamicValues = true
    export let isStage = false
    export let originalStyle = false
    export let useOriginalTextColor = false
    export let customFontSize: number | null = null
    export let outputStyle: Styles | null = null
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        layoutId?: string
        origin?: string
        id: string
    }
    export let style = true
    export let customStyle = ""
    export let stageItem: any = {}
    export let chords = false
    export let linesStart: null | number = null
    export let linesEnd: null | number = null
    export let clickRevealed = false
    export let stageAutoSize = false
    export let fontSize = 0
    export let maxLines = 0
    export let maxLinesInvert = false
    export let centerPreview = false
    export let revealed = -1
    export let styleIdOverride = ""
    export let autoSizeKey = ""
    export let updateDynamicValues = true

    const dispatch = createEventDispatcher<{ autosizeReady: { key: string; fontSize: number } }>()
</script>

<ReactIsland
    component={Textbox}
    props={{
        item,
        itemIndex,
        slideIndex,
        preview,
        miniPreview,
        isTemplatePreview,
        mirror,
        isOutputted,
        ratio,
        outputId,
        filter,
        backdropFilter,
        alphaKey: key,
        transition,
        smallFontSize,
        animationStyle,
        dynamicValues,
        isStage,
        originalStyle,
        useOriginalTextColor,
        customFontSize,
        outputStyle,
        ref,
        style,
        customStyle,
        stageItem,
        chords,
        linesStart,
        linesEnd,
        clickRevealed,
        stageAutoSize,
        fontSize,
        maxLines,
        maxLinesInvert,
        centerPreview,
        revealed,
        styleIdOverride,
        autoSizeKey,
        updateDynamicValues,
        onAutosizeReady: (detail) => dispatch("autosizeReady", detail)
    }}
/>

<script lang="ts">
    // Migrado a React en F24.18b. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import { createEventDispatcher } from "svelte"
    import type { Styles } from "../../../types/Settings"
    import type { Item, TemplateStyleOverride } from "../../../types/Show"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { TextboxLines } from "../../react/slide/TextboxLines"

    export let item: Item
    export let slideIndex = 0
    export let key = false
    export let smallFontSize = false
    export let animationStyle: any = {}
    export let dynamicValues = true
    export let isStage = false
    export let customFontSize: number | null = null
    export let outputStyle: Styles | null = null
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        layoutId?: string
        id: string
    }
    export let style = true
    export let customStyle = ""
    export let stageItem: any = {}
    export let useOriginalTextColor = false
    export let chords = false
    export let linesStart: null | number = null
    export let linesEnd: null | number = null
    export let fontSize = 0
    export let customTypeRatio = 1
    export let maxLines = 0
    export let maxLinesInvert = false
    export let centerPreview = false
    export let revealed = -1
    export let styleOverrides: TemplateStyleOverride[] = []
    export let hideContent = false
    export let highlighedLines: { from: number; to: number; color: string }[] = []
    export let normalWrap = false
    export let updateDynamicValues = true

    const dispatch = createEventDispatcher()
</script>

<ReactIsland
    component={TextboxLines}
    props={{
        item,
        slideIndex,
        alphaKey: key,
        smallFontSize,
        animationStyle,
        dynamicValues,
        isStage,
        customFontSize,
        outputStyle,
        ref,
        style,
        customStyle,
        stageItem,
        useOriginalTextColor,
        chords,
        linesStart,
        linesEnd,
        fontSize,
        customTypeRatio,
        maxLines,
        maxLinesInvert,
        centerPreview,
        revealed,
        styleOverrides,
        hideContent,
        highlighedLines,
        normalWrap,
        updateDynamicValues,
        onUpdateAutoSize: () => dispatch("updateAutoSize")
    }}
/>

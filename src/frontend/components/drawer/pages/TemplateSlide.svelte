<script lang="ts">
    // Migrado a React en F24.21c. Cascarón temporal: conserva la API Svelte.
    import type { Template } from "../../../../types/Show"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { TemplateSlide as ReactTemplateSlide } from "../../../react/drawer/pages/TemplateSlide"

    export let templateId: string
    export let template: Template

    export let width = 0
    export let height = 0
    export let zoom = 1
    export let ratio = 1
    export let preview = false

    export let edit = false
    export let newStyles: { [key: string]: string | number } = {}
</script>

<ReactIsland
    component={ReactTemplateSlide}
    props={{
        templateId,
        template,
        width,
        height,
        zoom,
        ratio,
        preview,
        edit,
        newStyles,
        onRatioChange: (value: number) => {
            ratio = value
        },
        onNewStylesChange: (value: { [key: string]: string | number }) => {
            newStyles = value
        }
    }}
/>

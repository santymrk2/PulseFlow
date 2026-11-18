<script lang="ts">
    // Migrado a React en F24.19a. Cascarón temporal: conserva los binds de los editores Svelte.
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { Snaplines as ReactSnaplines } from "../../react/system/Snaplines"

    export let lines: [string, number][]
    export let mouse: any
    export let newStyles: { [key: string]: string | number }
    export let ratio: number
    export let active: (number | string)[]
    export let isStage = false
</script>

<ReactIsland
    component={ReactSnaplines}
    props={{
        lines,
        mouse,
        newStyles,
        ratio,
        active,
        isStage,
        onLinesChange: (value: [string, number][]) => {
            lines = value
        },
        onMouseChange: (value: any) => {
            mouse = value
        },
        onNewStylesChange: (value: { [key: string]: string | number }) => {
            newStyles = value
        }
    }}
/>

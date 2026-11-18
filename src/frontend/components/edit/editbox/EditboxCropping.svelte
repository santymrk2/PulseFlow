<script lang="ts">
    // Migrado a React en F24.21c. Cascarón temporal: conserva la API Svelte (binds y métodos).
    import type { Item } from "../../../../types/Show"
    import type { CropValues } from "../../helpers/cropping"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
    import { EditboxCropping as ReactEditboxCropping } from "../../../react/edit/editbox/EditboxCropping"

    type CropSide = "top" | "right" | "bottom" | "left" | "topLeft" | "topRight" | "bottomRight" | "bottomLeft"

    export let item: Item | null
    export let index: number
    export let ref: {
        type?: "show" | "overlay" | "template"
        id: string
    }
    export let itemElem: HTMLElement | undefined
    export let plain = false
    export let isLocked = false
    export let selected = false

    export let cropActive = false
    export let cropPreview: CropValues = { top: 0, right: 0, bottom: 0, left: 0 }

    const handleRef = { current: null as { handleDblclick: (e: MouseEvent) => boolean; handleKeydown: (e: KeyboardEvent) => boolean } | null }

    export function handleDblclick(e: MouseEvent) {
        return handleRef.current?.handleDblclick(e) ?? false
    }

    export function handleKeydown(e: KeyboardEvent) {
        return handleRef.current?.handleKeydown(e) ?? false
    }
</script>

<ReactIsland
    component={ReactEditboxCropping}
    props={{
        item,
        index,
        ref,
        itemElem,
        plain,
        isLocked,
        selected,
        handleRef,
        onCropActiveChange: (value: boolean) => {
            cropActive = value
        },
        onCropPreviewChange: (value: CropValues) => {
            cropPreview = value
        }
    }}
/>

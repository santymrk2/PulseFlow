<script lang="ts">
    import { addCanvaPresentationAsShow } from "../../../converters/canvaPresentation"
    import { activeCanvaPresentation } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"

    $: selectedPresentation = $activeCanvaPresentation
    $: presentationInfo = [
        { label: "export.slides", value: selectedPresentation?.slideCount },
        { label: "ID", value: selectedPresentation?.designId },
        { label: "inputs.url", value: selectedPresentation ? `https://canva.com/design/${selectedPresentation.designId}/view` : "", type: "url" }
    ]

    function convertPresentation() {
        if (!selectedPresentation) return
        addCanvaPresentationAsShow(selectedPresentation)
    }
</script>

<div class="scroll">
    {#if selectedPresentation}
        {#if selectedPresentation.thumbnail}
            <img class="thumbnail" src={selectedPresentation.thumbnail} alt={selectedPresentation.presentationName} draggable="false" />
        {/if}

        <div style="padding: 5px;padding-top: 0;">
            <InfoMetadata title={selectedPresentation.presentationName} info={presentationInfo} />

            <div class="actions">
                <Button variant="outline" icon="slide" title="new.show_convert" on:click={convertPresentation}>
                    <T id="new.show_convert" />
                </Button>
            </div>
        </div>
    {:else}
        <!-- nothing -->
    {/if}
</div>

<style>
    .scroll {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .thumbnail {
        width: 100%;
        object-fit: cover;
    }

    .actions {
        display: flex;
        flex-direction: column;
        margin: 0 5px;
    }
</style>

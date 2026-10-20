<script lang="ts">
    import Icon from "../../helpers/Icon.svelte"
    import { attachPersistentWebview } from "./websiteDomPool"

    export let src: string
    export let zoom: number | undefined = undefined
    export let disablePreview = false
    export let outputId = ""

    let parsedSrc = ""

    $: if (src) checkURL()

    function checkURL() {
        let valid = false
        src = src.replaceAll("&amp;", "&").replaceAll("{", "%7B").replaceAll("}", "%7D")
        if (!src.includes("://")) src = "http://" + src

        try {
            new URL(src)
            valid = true
        } catch (err) {
            console.error(err)
        }

        parsedSrc = valid ? src : ""
    }
</script>

{#if disablePreview}
    <div class="iconPreview">
        <Icon id="web" size={3} white />
    </div>
{:else if parsedSrc}
    <div class="website">
        <div
            class="webview-container"
            use:attachPersistentWebview={{
                src: parsedSrc,
                zoom,
                outputId
            }}
        />
    </div>
{/if}

<style>
    .website,
    .webview-container {
        position: absolute;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .iconPreview {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 100%;

        border: 2px solid white;
        background-color: rgb(0 50 100 / 0.3);

        zoom: 8;
    }
</style>

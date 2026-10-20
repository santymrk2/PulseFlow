<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import { registerPopupSubmit } from "../../../utils/popup"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import TextField from "../../../lib/components/ui/text-field/text-field.svelte"

    registerPopupSubmit(confirm)

    const prompt = $popupData.prompt || ""
    const inputType = $popupData.inputType || ""
    const message = $popupData.message || ""

    function close() {
        popupData.set({})
        activePopup.set(null)
    }

    let textValue = ""
    function confirm() {
        if ($popupData.trigger) {
            $popupData.trigger(textValue)
            activePopup.set(null)
        } else {
            popupData.set({ ...$popupData, id: "confirm", value: inputType ? textValue : true })
        }
    }
</script>

{#if inputType}
    {#if message}
        <p class="message">{@html message}</p>
    {/if}

    <TextField label={prompt} type={inputType} value="" on:input={(e) => (textValue = e.detail)} autofocus />

    <Button variant="default" style="margin-top: 20px;" on:click={confirm}>
        <T id="remote.submit" />
    </Button>
{:else}
    {#if prompt}
        <p style="margin-bottom: 20px;">{@html prompt}</p>
    {/if}

    <InputRow style="display: flex;justify-content: center;gap: 5px;">
        <Button style="min-width: 150px;" on:click={close}>
            <Icon id="close" style="fill: #ff5454;" size={1.1} white />
            <T id="main.no" />
        </Button>
        <Button style="min-width: 150px;" on:click={confirm}>
            <Icon id="check" style="fill: #b7ffac;" size={1.1} white />
            <T id="main.yes" />
        </Button>
    </InputRow>
{/if}

<style>
    p {
        white-space: initial;
    }

    .message {
        font-size: 0.8em;
        opacity: 0.9;
        margin-bottom: 20px;
    }
</style>

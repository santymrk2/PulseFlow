<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import T from "../../helpers/T.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import ChoiceGrid from "../../../lib/components/ui/choice-grid/choice-grid.svelte"
    import TextField from "../../../lib/components/ui/text-field/text-field.svelte"
    import { fetchAndImportIcs } from "../../drawer/calendar/calendars"
    import { newToast } from "../../../utils/common"

    let importType = ""
    const importTypes = [
        { id: "url", name: translateText("inputs.url"), icon: "web" },
        { id: "local", name: translateText("cloud.local"), icon: "folder" }
    ]

    let url = ""
    let isSubmitting = false

    async function handleUrlImport() {
        if (!url.trim() || isSubmitting) return
        isSubmitting = true

        const success = await fetchAndImportIcs(url)
        isSubmitting = false

        if (success !== true) {
            let msg = "error.import"
            if (typeof success === "string") msg += ": " + success
            newToast(msg)
            return
        }

        alertMessage.set("actions.imported")
        activePopup.set("alert")
    }

    function handleLocalImport() {
        sendMain(Main.IMPORT, { channel: "calendar", format: { name: "Calendar", extensions: ["ics"] } })
        activePopup.set(null)
    }
</script>

{#if importType}
    <Button class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (importType = "")} />
{/if}

{#if importType === "url"}
    <div class="url-import">
        <TextField label="inputs.url (.ics)" value={url} on:input={(e) => (url = e.detail)} autofocus />
        <Button variant="default" icon="import" style="margin-top: 20px;width: 100%;" disabled={!url.trim() || isSubmitting} on:click={handleUrlImport}>
            <T id="actions.import" />
        </Button>
    </div>
{:else if importType === "local"}
    <p style="font-size: 1.1em;"><T id="scripture.supported_formats" /></p>
    <ul style="list-style: inside;margin-top: 10px;">
        <li>
            <span style="font-size: 0.9em;font-weight: bold;">iCalendar</span>
            <span style="font-size: 0.8em;opacity: 0.8;margin-left: 10px;">.ics</span>
        </li>
    </ul>

    <Button variant="outline" icon="import" on:click={handleLocalImport} style="margin-top: 25px;width: 100%;">
        <T id="actions.import" />
    </Button>
{:else}
    <ChoiceGrid options={importTypes} on:click={(e) => (importType = e.detail)} />
{/if}

<style>
    .url-import {
        display: flex;
        flex-direction: column;
    }
</style>

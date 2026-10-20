<script lang="ts">
    import { Main } from "../../../types/IPC/Main"
    import type { Popups } from "../../../types/Main"
    import { sendMain } from "../../IPC/main"
    import { activePopup, ai, dataPath, popupData, settingsTab } from "../../stores"
    import T from "../helpers/T.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"

    $: openedTab = $settingsTab

    // OPEN

    function open(id: Popups) {
        popupData.set({})
        activePopup.set(id)
    }

    function openLog() {
        sendMain(Main.OPEN_LOG)
    }
    function openAppData() {
        sendMain(Main.OPEN_APPDATA)
    }
    function openUserData() {
        sendMain(Main.OPEN_FOLDER_PATH, $dataPath)
    }
</script>

{#if openedTab === "general"}
    <div class="bottom">
        <Button variant="outline" icon="info" on:click={() => open("manage_metadata")} size="xs">
            <T id="popup.manage_metadata" />
        </Button>
        <Button variant="outline" icon="dynamic" on:click={() => open("manage_dynamic_values")} size="xs">
            <T id="popup.manage_dynamic_values" />
        </Button>
        <Button variant="outline" icon="emitter" on:click={() => open("manage_emitters")} size="xs">
            <T id="popup.manage_emitters" />
        </Button>
        <Button variant="outline" icon="text" on:click={() => open("manage_fonts")} size="xs">
            <T id="popup.manage_fonts" />
        </Button>
        <Button variant="outline" icon="star" on:click={() => open("manage_icons")} size="xs">
            <T id="popup.manage_icons" />
        </Button>
        <Button variant="outline" icon="color" on:click={() => open("manage_colors")} size="xs">
            <T id="popup.manage_colors" />
        </Button>
    </div>
{:else if openedTab === "other"}
    <div class="bottom">
        <Button variant="outline" icon="document" on:click={openLog} size="xs">
            <T id="actions.open_error_log" />
        </Button>
        <Button variant="outline" icon="folder" on:click={openAppData} size="xs">
            <T id="actions.open_app_data_folder" />
        </Button>
        <!-- in settings>Files we can press "Open in system" on the user data folder, so we don't need this! - but it makes sense to have it next to "Open app data folder" -->
        <Button variant="outline" icon="folder" on:click={openUserData} size="xs">
            <T id="actions.open_user_data_folder" />
        </Button>
    </div>
{/if}

<style>
    .bottom {
        display: flex;
        flex-direction: column;
        gap: 2px;

        padding: 5px;
        padding-bottom: 7px;

        overflow-y: auto;
    }

    .bottom :global(button) {
        justify-content: left;
        /* border-width: 0; */
        box-shadow: none;
    }
</style>

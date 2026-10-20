<script lang="ts">
    import { activePopup, settingsOpen } from "../../stores"
    import Modal from "../main/Modal.svelte"
    import Settings from "./Settings.svelte"
    import SettingsTabs from "./SettingsTabs.svelte"
    import SettingsTools from "./SettingsTools.svelte"
</script>

<!-- Modal propio (no `activePopup`): los popups que se abren desde las pestañas quedan encima. Esc cierra primero ese popup. -->
{#if $settingsOpen}
    <Modal title="menu.settings" width={960} height={620} managesPopup={false} blockEscape={!!$activePopup} on:close={() => settingsOpen.set(false)}>
        <aside>
            <SettingsTabs />
            <SettingsTools />
        </aside>

        <section>
            <Settings />
        </section>
    </Modal>
{/if}

<style>
    aside {
        flex: 0 0 220px;
        display: flex;
        flex-direction: column;
        min-height: 0;

        border-inline-end: 1px solid var(--border);
    }

    section {
        flex: 1;
        min-width: 0;
        min-height: 0;
    }
</style>

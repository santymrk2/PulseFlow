<script lang="ts">
    import { activePopup, settingsOpen } from "../../stores"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { SettingsModal as SettingsModalBody } from "../../react/settings/SettingsModal"
    import Modal from "../main/Modal.svelte"
</script>

<!-- Modal propio (no `activePopup`): los popups que se abren desde las pestañas quedan encima. Esc cierra primero ese popup. -->
<!-- El marco sigue siendo Svelte (Modal necesita un <slot>); el cuerpo —pestañas, herramientas y panel— es React (F24.12). -->
{#if $settingsOpen}
    <Modal title="menu.settings" width={960} height={620} managesPopup={false} blockEscape={!!$activePopup} on:close={() => settingsOpen.set(false)}>
        <ReactIsland component={SettingsModalBody} />
    </Modal>
{/if}

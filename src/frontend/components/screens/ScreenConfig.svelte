<script lang="ts">
    import { activePopup } from "../../stores"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ScreenConfig as ScreenConfigBody } from "../../react/screens/ScreenConfig"
    import Modal from "../main/Modal.svelte"
</script>

<!-- El marco sigue siendo Svelte (Modal necesita un <slot>); el cuerpo —lista, sistema y detalle— es React (F24.14). -->
<Modal title="screen_config.title" width={960} height={620} on:close={() => activePopup.set(null)}>
    <ReactIsland component={ScreenConfigBody} />
</Modal>

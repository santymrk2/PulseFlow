<script lang="ts">
    import { activePopup, looks } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    // F10.6: los Looks ahora viven en un modal (components/looks/LooksWindow.svelte).
    // Esta pestaña de Settings sólo queda como acceso hasta que F10.8 mueva todo a
    // los menús.
</script>

<div class="looks-tab">
    <InputRow>
        <MaterialButton variant="contained" icon="eye" on:click={() => activePopup.set("looks")}>
            <T id="looks.open_window" />
        </MaterialButton>
    </InputRow>

    <p class="hint">{translateText("looks.open_window_hint")} ({Object.keys($looks).length})</p>
</div>

<style>
    .looks-tab {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
    }

    .hint {
        padding: 0 10px;
        font-size: 0.8em;
        opacity: 0.5;
    }
</style>

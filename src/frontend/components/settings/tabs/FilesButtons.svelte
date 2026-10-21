<script lang="ts">
    import { activePopup } from "../../../stores"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../../lib/components/ui/input-row/input-row.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"

    function backup() {
        save(false, { backup: true })
    }
</script>

<InputRow>
    <Button style="flex: 1;font-size: 1.1em;padding: 20px !important;" title="settings.backup_info" on:click={backup}>
        <Icon id="export" size={1.3} />
        <p><T id="settings.backup_all" /></p>
    </Button>
    <Button style="flex: 1;font-size: 1.1em;padding: 20px !important;" on:click={() => activePopup.set("restore")}>
        <Icon id="import" size={1.3} />
        <p><T id="settings.restore" /></p>
    </Button>
</InputRow>

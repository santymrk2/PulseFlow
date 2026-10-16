<script lang="ts">
    import { autoOutput, os, special } from "../../../stores"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import Tip from "../../main/Tip.svelte"

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }

    const renderEngineOptions = [
        { id: "web", name: "Web (Legacy HTML/CSS Webview)" },
        { id: "native", name: "Nativo GPU (Pro Engine WGPU 60fps)" }
    ]
</script>

<Tip type="info" value="tips.global_options" bottom={20} />

<MaterialDropdown
    label="Motor de Render"
    value={$special.renderEngine || "web"}
    defaultValue="web"
    options={renderEngineOptions}
    on:change={(e) => updateSpecial(e.detail, "renderEngine")}
/>

<div style="height: 12px;"></div>

<MaterialToggleSwitch label="settings.auto_output" checked={$autoOutput} defaultValue={false} on:change={(e) => autoOutput.set(e.detail)} />
<!-- apparently doesn't work on some versions of macOS -->
{#if $os.platform !== "darwin" || $special.hideCursor}
    <MaterialToggleSwitch label="settings.hide_cursor_in_output" checked={$special.hideCursor} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "hideCursor")} />
{/if}

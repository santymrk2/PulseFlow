<script lang="ts">
    import type { ClickEvent } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { dictionary, ndiData, outputs, outputState } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"

    export let output: Output & { id: string }
    export let outs: Output[] = []

    function toggleOutput(e: ClickEvent, id: string) {
        if (outs.length <= 1) return

        outputs.update((a) => {
            if (e.detail.ctrl) {
                let newState = false
                let getAllActive = Object.values(a).filter((a) => !a.stageOutput && a.active)
                if ((getAllActive.length === 1 && a[id].active) || a[id].stageOutput) newState = true

                Object.keys(a).forEach((id) => {
                    a[id].active = a[id].stageOutput ? true : newState
                })
                a[id].active = true
            } else {
                a[id].active = a[id].stageOutput ? true : !a[id].active

                let activeList = Object.values(a).filter((a) => !a.stageOutput && a.enabled && a.active === true)
                if (!activeList.length) {
                    a[id].active = true
                    newToast("toast.one_output")
                }
            }

            return a
        })
    }

    function getOutputStateTitle(output: Output, _updater: any) {
        if (!output.active) return "output.state_locked"
        if ($outputState.find((a) => a.id === output.id)?.active) return "settings.enabled"
        if ($ndiData[output?.id || ""]?.connections > 0) return "NDI"
        if (output.invisible) return "settings.network_output"
        return "output.state_inactive"
    }
</script>

<Button id={output.id} variant="ghost" align="start" title={output.stageOutput ? "" : "actions.toggle_output_lock"} style="flex: 1;min-width: 0;border-radius: 0;font-weight: normal;border-bottom: 2px solid {output.active ? output.color : 'transparent'};" class="output_button context #output_active_button" on:click={(e) => toggleOutput(e, output.id)}>
    <div class="indicator" class:locked={!output.active} class:invisible={output.invisible} class:ndi={$ndiData[output?.id || ""]?.connections > 0} class:active={$outputState.find((a) => a.id === output.id)?.active === true} data-title={translateText(getOutputStateTitle(output, { $outputState, $ndiData }), $dictionary)}></div>
    {#if output.stageOutput}<Icon id="stage" size={0.8} white />{/if}

    <p style={output.active ? "" : "text-decoration: line-through;"}>{output.name}</p>
</Button>

<style>
    /* estado de la salida: color semántico (apagada · en vivo · bloqueada · red · NDI) */
    .indicator {
        padding: 0;
        width: 8px;
        height: 8px;
        flex: none;
        border-radius: 50%;

        transition: 0.3s background-color ease;
        background-color: var(--danger);
    }
    .indicator.invisible {
        background-color: var(--text-subtle);
    }
    .indicator.ndi {
        background-color: var(--text);
    }
    .indicator.active {
        background-color: var(--success);
    }
    .indicator.locked {
        background-color: var(--warning);
    }
    .indicator.locked.active,
    .indicator.locked.ndi {
        background-color: var(--warning);
    }
</style>

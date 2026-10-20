<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { activePopup, currentOutputSettings, outputs } from "../../stores"
    import { requestMain } from "../../IPC/main"
    import { send } from "../../utils/request"
    import { OUTPUT } from "../../../types/Channels"
    import { keysToID, sortByName, sortObject } from "../helpers/array"
    import Modal from "../main/Modal.svelte"
    import ScreenList from "./ScreenList.svelte"
    import ScreenDetail from "./ScreenDetail.svelte"
    import SystemDisplays from "./SystemDisplays.svelte"
    import { addOutput, enableStageOutput } from "../helpers/output"

    let displays: any[] = []
    let selectedOutputId: string | null = null

    $: if ($currentOutputSettings && $outputs[$currentOutputSettings]) {
        selectedOutputId = $currentOutputSettings
    } else if (!selectedOutputId) {
        const list = sortObject(sortByName(keysToID($outputs)), "stageOutput")
        selectedOutputId = list[0]?.id || null
        if (selectedOutputId) currentOutputSettings.set(selectedOutputId)
    }

    async function loadDisplays() {
        const res = (await requestMain(Main.GET_DISPLAYS)) || []
        displays = res
    }

    onMount(() => {
        loadDisplays()
    })

    function addAudience() {
        const id = addOutput(false)
        if (id) {
            selectedOutputId = id
            currentOutputSettings.set(id)
        }
    }

    function addStage() {
        const id = enableStageOutput({})
        if (id) {
            selectedOutputId = id
            currentOutputSettings.set(id)
        }
    }

    function identify() {
        send(OUTPUT, ["IDENTIFY_SCREENS"], displays)
    }

    function newNdi() {
        const id = addOutput(false)
        if (!id) return
        outputs.update((a) => {
            if (a[id]) {
                a[id].ndi = true
                a[id].name = a[id].name || "NDI"
            }
            return a
        })
        selectedOutputId = id
        currentOutputSettings.set(id)
    }
</script>

<Modal title="Configuración de pantallas" width={960} height={620} on:close={() => activePopup.set(null)}>
    <div class="container">
        <div class="left">
            <ScreenList
                {selectedOutputId}
                on:select={(e) => {
                    selectedOutputId = e.detail
                    currentOutputSettings.set(selectedOutputId)
                }}
                on:addAudience={addAudience}
                on:addStage={addStage}
            />
            <div class="system">
                <div class="system-header">SISTEMA</div>
                <SystemDisplays {displays} on:refresh={loadDisplays} on:identify={identify} />
                <div class="ndi-section">
                    <div class="ndi-title">NDI</div>
                    <button class="ndi-btn" on:click={newNdi}>Nueva salida NDI ›</button>
                </div>
            </div>
        </div>
        <div class="right">
            {#if selectedOutputId && $outputs[selectedOutputId]}
                <ScreenDetail outputId={selectedOutputId} {displays} on:refreshDisplays={loadDisplays} />
            {:else}
                <div class="empty">Sin salidas</div>
            {/if}
        </div>
    </div>
</Modal>

<style>
    .container {
        display: flex;
        width: 100%;
        height: 100%;
        min-height: 0;
    }
    .left {
        width: 240px;
        min-width: 240px;
        background-color: var(--primary-darker);
        border-right: 1px solid var(--border-color, var(--primary-lighter));
        display: flex;
        flex-direction: column;
    }
    .right {
        flex: 1;
        min-width: 0;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .system {
        margin-top: auto;
        border-top: 1px solid var(--border-color, var(--primary-lighter));
    }
    .system-header {
        padding: 6px 10px;
        font-size: 0.7em;
        opacity: 0.6;
    }
    .ndi-section {
        padding: 8px 10px;
    }
    .ndi-title {
        font-size: 0.75em;
        opacity: 0.7;
        margin-bottom: 4px;
    }
    .ndi-btn {
        background: transparent;
        border: none;
        color: var(--text);
        cursor: pointer;
        font-size: 0.9em;
        opacity: 0.85;
    }
    .ndi-btn:hover {
        opacity: 1;
    }
    .empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        opacity: 0.6;
    }
</style>

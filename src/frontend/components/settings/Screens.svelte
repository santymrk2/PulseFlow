<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { Main } from "../../../types/IPC/Main"
    import { requestMain } from "../../IPC/main"
    import { activePopup, alertMessage, currentOutputSettings, outputs, styles } from "../../stores"
    import { send } from "../../utils/request"
    import { clone, keysToID, sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { toggleOutputs } from "../helpers/output"
    import T from "../helpers/T.svelte"
    import InputRow from "../input/InputRow.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import MaterialRadialPicker from "../inputs/MaterialRadialPicker.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"
    import Tip from "../main/Tip.svelte"
    import DisplayLayout from "../screens/DisplayLayout.svelte"

    export let activateOutput = false

    let options: any[] = []
    $: options = sortByName(keysToID($outputs))
    $: if (options.length && (!$currentOutputSettings || !$outputs[$currentOutputSettings])) currentOutputSettings.set(options[0].id)

    let screens: any[] = []

    let screenId: string | null = null
    $: screenId = $currentOutputSettings
    let currentScreen: any = {}
    $: currentScreen = screenId ? $outputs[screenId] || {} : {}

    // find matching screen
    $: if (!currentScreen.screen && screens.length) {
        let match = screens.find((screen) => JSON.stringify(screen.bounds) === JSON.stringify(currentScreen.bounds))
        if (match?.id) {
            outputs.update((a: any) => {
                a[screenId!].screen = match.id.toString()
                return a
            })
        }
    }

    $: if (!screens.length) {
        loadDisplays()
    }

    async function loadDisplays() {
        const displays = (await requestMain(Main.GET_DISPLAYS)) || []
        let sortedScreens = displays.sort(sortScreensByPosition)
        screens = sortedScreens.sort(internalFirst)
    }

    // const fakeScreen0 = {
    //     bounds: { x: -864 - 1536, y: -452, width: 1536, height: 1536 },
    //     id: 2528732444,
    //     internal: false,
    // }
    // const fakeScreen = {
    //     bounds: { x: -864, y: -452, width: 864, height: 1536 },
    //     id: 2528732444,
    //     internal: false,
    // }
    // const fakeScreen2 = {
    //     bounds: { x: 1920 + 1536, y: 0, width: 1536, height: 1536 },
    //     id: 2528732444,
    //     internal: false,
    // }
    // const fakeScreen3 = {
    //     bounds: { x: 1920 + 1536 + 1536, y: 0, width: 1536, height: 1536 },
    //     id: 2528732444,
    //     internal: false,
    // }

    function internalFirst(a, b) {
        return b.internal - a.internal
    }
    function sortScreensByPosition(a, b) {
        let aX = a.bounds.x
        let bX = b.bounds.x

        return aX - bX
    }

    function changeOutputScreen(e: any) {
        if (!currentScreen || !screenId) return

        let alreadySelected = $outputs[screenId]?.screen === e.detail.id.toString()

        let bounds = e.detail.bounds
        outputs.update((a) => {
            if (!a[screenId]) return a

            a[screenId].bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
            a[screenId].screen = e.detail.id.toString()
            // a[screenId].kiosk = true

            return a
        })

        setTimeout(() => {
            toggleOutputs([screenId], { state: true })
            // send(OUTPUT, ["TOGGLE_KIOSK"], { id: screenId, enabled: true })
            // setTimeout(() => {
            send(OUTPUT, ["UPDATE_BOUNDS"], { id: screenId, ...currentScreen })
            // }, 100)
        }, 100)

        if (activateOutput || alreadySelected) {
            activePopup.set(null)
            alertMessage.set("")
        }
    }

    function lockScreen() {
        if (!screenId) return

        outputs.update((a) => {
            if (!a[screenId]) return a

            a[screenId].boundsLocked = !a[screenId].boundsLocked
            return a
        })
    }

    function identifyScreens() {
        send(OUTPUT, ["IDENTIFY_SCREENS"], screens)
    }

    let editCropping = false
    const previewSize = 0.08
    // get any style cropping if not set on window
    $: cropping = clone((currentScreen.cropping === undefined && currentScreen.style ? $styles[currentScreen.style]?.cropping : currentScreen.cropping) || {})
    function updateCropping(value: string | number, side: string) {
        if (!screenId) return

        outputs.update((a) => {
            if (!a[screenId].cropping) {
                if (currentScreen.style && $styles[currentScreen.style]?.cropping) a[screenId].cropping = clone($styles[currentScreen.style].cropping)
                else a[screenId].cropping = { top: 0, right: 0, bottom: 0, left: 0 }
            }

            a[screenId].cropping![side] = Number(value)
            return a
        })
    }
    function getCroppedStyle(cropping) {
        let style = ""
        Object.keys(cropping).forEach((key) => {
            if (cropping[key]) style += `padding-${key}: ${cropping[key] * previewSize}px;`
        })
        return style
    }

    let editEdgeBlending = false
    $: blending = currentScreen.blending || {}
    function updateBlending(value: string | number, side: string) {
        if (!screenId) return

        outputs.update((a) => {
            if (!a[screenId].blending) a[screenId].blending = { left: 0, right: 0, rotate: 90, opacity: 50, centered: false, offset: 0 }
            a[screenId].blending![side] = Number(value)
            return a
        })
    }
    function getBlendingStyle(blending) {
        if (!blending.left && !blending.right) return ""

        const opacity = (blending.opacity ?? 50) / 100
        const center = 50 + Number(blending.offset || 0)
        if (blending.centered) return `-webkit-mask-image: linear-gradient(${blending.rotate ?? 90}deg, rgb(0, 0, 0) ${center - blending.left}%, rgba(0, 0, 0, ${opacity}) ${center}%, rgb(0, 0, 0) ${center + Number(blending.right)}%);`
        return `-webkit-mask-image: linear-gradient(${blending.rotate ?? 90}deg, rgba(0, 0, 0, ${opacity}) 0%, rgb(0, 0, 0) ${blending.left}%, rgb(0, 0, 0) ${100 - blending.right}%, rgba(0, 0, 0, ${opacity}) 100%);`
    }

    $: isCropped = (cropping.left || 0) + (cropping.right || 0) + (cropping.top || 0) + (cropping.bottom || 0) > 0
    $: isEdgeBlending = blending.left || blending.right

    let showMore = false
    $: showMore = isCropped || isEdgeBlending
</script>

{#if editCropping}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (editCropping = false)} />

    <Tip value="screen.cropping_tip" bottom={20} />

    <MaterialNumberInput label="screen.top" value={cropping.top || 0} defaultValue={0} max={currentScreen.bounds?.height * 0.9 - (cropping.bottom || 0)} on:change={(e) => updateCropping(e.detail, "top")} showSlider />
    <MaterialNumberInput label="screen.right" value={cropping.right || 0} defaultValue={0} max={currentScreen.bounds?.width * 0.9 - (cropping.left || 0)} on:change={(e) => updateCropping(e.detail, "right")} showSlider />
    <MaterialNumberInput label="screen.bottom" value={cropping.bottom || 0} defaultValue={0} max={currentScreen.bounds?.height * 0.9 - (cropping.top || 0)} on:change={(e) => updateCropping(e.detail, "bottom")} showSlider />
    <MaterialNumberInput label="screen.left" value={cropping.left || 0} defaultValue={0} max={currentScreen.bounds?.width * 0.9 - (cropping.right || 0)} on:change={(e) => updateCropping(e.detail, "left")} showSlider />

    <!-- preview -->
    <div class="preview" style="margin-top: 20px;">
        <div class="border" style="width: {currentScreen.bounds?.width * previewSize}px;height: {currentScreen.bounds?.height * previewSize}px;">
            <div class="cropped" style={getCroppedStyle(cropping)}>
                <div class="previewWindow" style="aspect-ratio: {currentScreen.bounds?.width} / {currentScreen.bounds?.height};max-height: {(currentScreen.bounds?.height - (cropping.top || 0) - (cropping.bottom || 0)) * previewSize}px;max-width: {(currentScreen.bounds?.width - (cropping.left || 0) - (cropping.right || 0)) * previewSize}px;"></div>
            </div>
        </div>
    </div>
{:else if editEdgeBlending}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (editEdgeBlending = false)} />

    <Tip value="screen.edge_blending_tip" bottom={20} />

    <MaterialNumberInput label="screen.left" value={blending.left || 0} defaultValue={0} max={500} on:change={(e) => updateBlending(e.detail, "left")} showSlider sliderValues={{ max: 50 }} />
    <MaterialNumberInput label="screen.right" value={blending.right || 0} defaultValue={0} max={100} on:change={(e) => updateBlending(e.detail, "right")} showSlider sliderValues={{ max: 50 }} />
    <MaterialRadialPicker label="edit.rotation" disabled={!blending.left && !blending.right} value={blending.rotate ?? 90} on:change={(e) => updateBlending(e.detail, "rotate")} />
    <MaterialNumberInput label="edit.opacity" disabled={!blending.left && !blending.right} value={blending.opacity ?? 50} defaultValue={50} max={100} step={5} on:change={(e) => updateBlending(e.detail, "opacity")} showSlider />

    <MaterialToggleSwitch label="screen.centered" disabled={!blending.left && !blending.right} checked={blending.centered} defaultValue={false} on:change={(e) => updateBlending(e.detail, "centered")} />
    {#if (blending.left || blending.right) && blending.centered}
        <MaterialNumberInput label="edit.offset" value={blending.offset || 0} defaultValue={0} min={-50} max={50} on:change={(e) => updateBlending(e.detail, "offset")} showSlider />
    {/if}

    <!-- preview -->
    <div class="preview" style="margin-top: 20px;">
        <div class="border" style="background-color: white;width: {currentScreen.bounds?.width * previewSize}px;height: {currentScreen.bounds?.height * previewSize}px;">
            <div class="cropped" style={getBlendingStyle(blending)}>
                <div class="previewWindow" style="aspect-ratio: {currentScreen.bounds?.width} / {currentScreen.bounds?.height};"></div>
            </div>
        </div>
    </div>
{:else}
    {#if !activateOutput}
        <MaterialButton class="popup-options {showMore ? 'active' : ''}" icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} on:click={() => (showMore = !showMore)} white />
    {/if}

    {#key currentScreen.boundsLocked}
        <Tip value="settings.{currentScreen.boundsLocked ? 'output_locked' : 'select_display'}" bottom={20} />
    {/key}

    <MaterialButton variant="outlined" style="width: 100%;" icon="edit" disabled={currentScreen.boundsLocked} on:click={() => activePopup.set("change_output_values")} title={activateOutput ? "popup.change_output_values" : "settings.manual_input_hint"}>
        <p><T id={activateOutput ? "settings.manual_input_hint" : "popup.change_output_values"} /></p>
    </MaterialButton>

    {#if !activateOutput && showMore}
        <InputRow>
            <MaterialButton variant="outlined" style="flex: 1;" icon="resize" on:click={() => (editCropping = true)}>
                <p><T id="settings.cropping" /></p>
            </MaterialButton>
            <MaterialButton variant="outlined" style="flex: 1;" icon="gradient" on:click={() => (editEdgeBlending = true)}>
                <p><T id="settings.edge_blending" /></p>
            </MaterialButton>
        </InputRow>
    {/if}

    <br />

    <div class="content">
        {#if screens.length}
            <DisplayLayout
                displays={screens}
                width={580}
                height={340}
                assignedId={currentScreen.screen || null}
                selectable={!currentScreen.boundsLocked && !currentScreen.forcedResolution}
                on:select={(e) => {
                    if (currentScreen.boundsLocked || currentScreen.forcedResolution) return
                    changeOutputScreen({ detail: { id: e.detail.id, bounds: e.detail.bounds } })
                }}
            />
            {#if !activateOutput}
                <div class="currentOverlay">
                    {#if currentScreen.screen}
                        <span>{screens.findIndex((a) => a.id.toString() === currentScreen.screen) + 1 || ""}</span>
                    {/if}
                    <div class="screen noClick" style="width: {currentScreen.bounds?.width * 0.08}px;height: {currentScreen.bounds?.height * 0.08}px;{currentScreen.screen && screens.find((a) => a.id.toString() === currentScreen.screen) ? 'opacity: 1;' : ''}"></div>
                    <MaterialButton class="lock" on:click={lockScreen} title="preview.{currentScreen.boundsLocked ? '_unlock' : '_lock'}" red={currentScreen.boundsLocked}>
                        <Icon id={currentScreen.boundsLocked ? "locked" : "unlocked"} size={1.1} white={currentScreen.boundsLocked} />
                    </MaterialButton>
                </div>
            {/if}
        {:else}
            <T id="remote.loading" />
        {/if}
    </div>

    {#if !currentScreen.boundsLocked}
        <div class="bottom">
            <MaterialButton variant="outlined" on:click={identifyScreens} title="settings.identify_screens" style="padding: 12px;">
                <Icon id="search" size={1.4} white />
            </MaterialButton>
        </div>
    {/if}
{/if}

<style>
    .content {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    .currentOverlay {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 580px;
    }
    .currentOverlay :global(.lock) {
        position: absolute;
        top: 4px;
        inset-inline-end: 4px;
        padding: 5px !important;
    }
    .bottom {
        position: absolute;
        bottom: 20px;
        inset-inline-start: 20px;
    }

    .screen {
        position: absolute;
        /* transform: translateX(-50%); */

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: var(--primary);
        outline: 40px solid var(--primary-lighter);
        transition: background-color 0.1s;
    }

    .screen:hover:not(.disabled):not(.noClick) {
        background-color: var(--primary-lighter);
        cursor: pointer;
    }

    .screen.noClick {
        opacity: 0.5;
        pointer-events: none;
    }

    /* .screen.active, */
    .screen.noClick {
        outline: 40px solid var(--secondary);
        background-color: var(--primary-darker);
        z-index: 1;
    }

    .preview {
        display: flex;
        justify-content: center;
    }

    .border {
        background-color: black;

        outline: 2px solid var(--primary-lighter);
        outline-offset: 0;
        position: relative;

        display: flex;
        align-items: center;
        text-align: -webkit-center;
    }

    .cropped {
        position: absolute;
        width: 100%;
    }

    .previewWindow {
        background-color: var(--primary-darker);
        /* background-color: #ececec; */

        outline: 2px solid var(--secondary);
        outline-offset: 0;
    }
</style>

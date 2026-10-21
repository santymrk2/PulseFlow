<script lang="ts">
    import { actions, activePage, activePopup, activeShow, activeTimers, contextActive, groups, guideActive, openToolsTab, outLocked, outputs, overlayTimers, playingAudio, playingMetronome, slideTimers, special } from "../../../stores"
    import { formatSearch } from "../../../utils/search"
    import { getNormalizedKey, previewCtrlShortcuts, previewShortcuts } from "../../../utils/shortcuts"
    import { runAction } from "../../actions/actions"
    import AudioMeter from "../../drawer/audio/AudioMeter.svelte"
    import { getSlideText } from "../../edit/scripts/textStyle"
    import { getActiveOutputs, getFirstOutputIdWithBackground, isOutCleared, outputSlideHasContent, setOutput } from "../../helpers/output"
    import { getLayoutRef } from "../../helpers/show"
    import { getFewestOutputLines, getItemWithMostLines, playNextGroup, playPreviousGroup, updateOut } from "../../helpers/showActions"
    import { _show } from "../../helpers/shows"
    import { newSlideTimer } from "../../helpers/tick"
    import ShowActions from "../ShowActions.svelte"
    import MediaControls from "../tools/MediaControls.svelte"
    import Show from "../tools/Show.svelte"
    import ClearButtons from "./ClearButtons.svelte"
    import MultiOutputs from "./MultiOutputs.svelte"
    import SpotifyController from "./SpotifyController.svelte"

    $: allActiveOutputs = getActiveOutputs($outputs, true, true, true)
    $: outputId = allActiveOutputs[0]
    let currentOutput: any = {}
    $: currentOutput = outputId ? $outputs[outputId] || {} : {}

    $: allOutputsWithBackground = allActiveOutputs.filter((id) => $outputs[id]?.out?.background)
    $: backgroundOutputId = getFirstOutputIdWithBackground(allOutputsWithBackground) || allOutputsWithBackground[0] || outputId
    $: currentBgOutput = backgroundOutputId ? $outputs[backgroundOutputId] || null : null

    let numberKeyTimeout: NodeJS.Timeout | null = null
    let previousNumberKey = ""
    function keydown(e: KeyboardEvent) {
        if ($contextActive) return
        if ($guideActive || $activePopup === "assign_shortcut") return

        const ctrlShortcut = e.ctrlKey || e.metaKey ? previewCtrlShortcuts[getNormalizedKey(e)] : null
        if (ctrlShortcut) {
            e.preventDefault()
            ctrlShortcut()
        }

        const functionKey = /^F(?:[1-9]|1[0-9]|2[0-4])$/
        if ((e.target?.closest?.("input") || e.target?.closest?.(".edit")) && !functionKey.test(e.key)) return

        // start action with custom shortcut key
        // /^[A-Z]{1}$/i.test(e.key) &&
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && actionKeyActivate(e.key.toUpperCase())) {
            e.preventDefault()
            return
        }

        // group shortcuts
        if ((outSlide?.id || $activeShow) && !e.ctrlKey && !e.metaKey && !$outLocked) {
            // play slide with custom shortcut key
            let layoutRef = getLayoutRef(outSlide?.id || "active")
            let slideShortcutMatch = layoutRef.findIndex((ref) => ref.data?.actions?.slide_shortcut?.key === e.key)
            if (slideShortcutMatch > -1 && !e.altKey && !e.shiftKey) {
                playSlideAtIndex(slideShortcutMatch)
                e.preventDefault()
                return
            }

            // play group with custom shortcut keys
            // /^[A-Z]{1}$/i.test(e.key) &&
            if (checkGroupShortcuts(e)) {
                e.preventDefault()
                return
            }

            // play slide with number keys
            if ($special.numberKeys && e.key !== " " && !isNaN(e.key as any)) {
                previousNumberKey += e.key

                if (numberKeyTimeout) clearTimeout(numberKeyTimeout)
                numberKeyTimeout = setTimeout(() => {
                    let slideIndex = Number(previousNumberKey) - 1
                    playSlideAtIndex(slideIndex)

                    numberKeyTimeout = null
                    previousNumberKey = ""
                }, 300)

                return
            }

            // play slide based on first text letter
            if ($special.autoLetterShortcut) {
                const isSpecial = [".", ",", "-", "+", "/", "*", "<", ">", "|", "\\", "¨", "'"].includes(e.key)
                if (e.key.trim().length === 1 && isNaN(e.key as any) && !isSpecial) {
                    const firstLetterMatch = layoutRef.findIndex((ref) => {
                        const slide = _show().get("slides")?.[ref.id]
                        const slideText = formatSearch(getSlideText(slide)).replace(/\d+/g, "").trim()
                        return slideText[0]?.toLowerCase() === e.key.toLowerCase()
                    })

                    if (firstLetterMatch > -1 && !e.altKey && !e.shiftKey) {
                        playSlideAtIndex(firstLetterMatch)
                        e.preventDefault()
                        return
                    }
                }
            }
        }

        if (previewShortcuts[e.key]) {
            if (previewShortcuts[e.key](e)) e.preventDefault()
            return
        }
    }

    function actionKeyActivate(key: string) {
        let actionTriggered = false

        Object.values($actions).forEach((action) => {
            // can become [object Object] in some rare cases
            if (typeof action.keypressActivate !== "string") return
            if (action.keypressActivate.toUpperCase() === key) {
                runAction(action, { source: "keypress" })
                actionTriggered = true
            }
        })

        return actionTriggered
    }

    function checkGroupShortcuts(e: any) {
        let currentShowId = outSlide?.id || ($activeShow !== null ? ($activeShow.type === undefined || $activeShow.type === "show" ? $activeShow.id : null) : null)
        if (!currentShowId) return

        let showRef = getLayoutRef(currentShowId)
        let groupIds = showRef.map((a) => a.id)
        let showGroups = groupIds.length ? _show(currentShowId).slides(groupIds).get() : []
        if (!showGroups.length) return

        // Get both the actual key and normalized key to support all keyboard layouts
        const actualKey = e.key
        const normalizedKey = getNormalizedKey(e)

        let globalGroupIds: string[] = []
        Object.entries($groups).forEach(([groupId, group]) => {
            if (typeof group.shortcut !== "string") return

            // Check both actual key (for native shortcuts) and normalized key (for Latin shortcuts on non-Latin keyboards)
            const shortcutLower = group.shortcut.toLowerCase()
            if (shortcutLower !== actualKey.toLowerCase() && shortcutLower !== normalizedKey.toLowerCase()) return

            showGroups.forEach((slide) => {
                if (slide.globalGroup === groupId) globalGroupIds.push(slide.id)
            })
        })

        if (e.shiftKey) return playPreviousGroup(globalGroupIds, { showRef, outSlide, currentShowId }, !e.altKey)
        return playNextGroup(globalGroupIds, { showRef, outSlide, currentShowId }, !e.altKey)
    }

    function playSlideAtIndex(index: number) {
        let slideRef = getLayoutRef()
        if (index === -1) index = slideRef.length - 1
        if (!slideRef[index]) return

        updateOut("active", index, slideRef)
        setOutput("slide", { id: $activeShow?.id, layout: _show().get("settings.activeLayout"), index, line: 0 })
    }

    // active menu
    let activeClear: string | null = null
    let autoChange = true
    $: if (outputId) autoChange = true
    $: if (autoChange && ($outputs || $overlayTimers || $activeTimers || $playingMetronome)) {
        let active = getActiveClear(!isOutCleared("transition"), Object.keys($playingAudio).length || $playingMetronome, !isOutCleared("overlays") || !isOutCleared("effects"), !isOutCleared("slide") && (outputSlideHasContent(currentOutput) || isOutCleared("background")), !isOutCleared("background"))
        if (active !== activeClear) activeClear = active
    }
    // enable autochange again if active has no value
    $: if (!autoChange && ($outputs || $playingAudio || $playingMetronome || $overlayTimers || $activeTimers)) checkStillActive()
    function checkStillActive() {
        if (activeClear === "nextTimer" && isOutCleared("transition")) autoChange = true
        else if (activeClear === "audio" && !Object.keys($playingAudio).length && !$playingMetronome) autoChange = true
        else if (activeClear === "overlays" && isOutCleared("overlays") && isOutCleared("effects")) autoChange = true
        else if (activeClear === "slide" && !(!isOutCleared("slide") && (outputSlideHasContent(currentOutput) || isOutCleared("background")))) autoChange = true
        else if (activeClear === "background" && isOutCleared("background")) autoChange = true
    }

    // don't update instantly in case it changes back quickly like slide timers
    let updatedActiveClear: string | null = null
    let updateActiveClearTimeout: NodeJS.Timeout | null = null
    $: if (activeClear !== undefined) updateActiveClear()
    function updateActiveClear() {
        if (updateActiveClearTimeout) clearTimeout(updateActiveClearTimeout)
        updateActiveClearTimeout = setTimeout(() => {
            updatedActiveClear = activeClear
        })
    }

    function getActiveClear(slideTimer: any, audio: any, overlays: any, slide: any, background: any) {
        if (slideTimer) return "nextTimer"
        if (audio) return "audio"
        if (overlays) return "overlays"
        if (slide) return "slide"
        if (background) return "background"
        return null
    }

    $: Object.entries($outputs).forEach(([id, output]) => {
        if ((Object.keys($outputs)?.length > 1 && !output.enabled) || output.stageOutput) return
        if (!output.out?.transition || $slideTimers[id]?.timer) return

        const data = output.out.transition
        newSlideTimer(id, data.duration, data.folderPath || "")
    })

    // $: currentStyle = $styles[currentOutput?.style] || {}

    // LINES

    $: outSlide = currentOutput.out?.slide
    $: ref = outSlide ? (outSlide?.id === "temp" ? [{ temp: true, items: outSlide.tempItems, id: "" }] : _show(outSlide.id).layouts([outSlide.layout]).ref()[0] || []) : []
    let linesIndex: null | number = null
    let maxLines: null | number = null
    $: amountOfLinesToShow = getFewestOutputLines($outputs)
    $: showSlide = outSlide?.index !== undefined && ref ? _show(outSlide.id).slides([ref[outSlide.index]?.id]).get()?.[0] : null
    $: slideLines = showSlide ? getItemWithMostLines(showSlide) : null
    $: maxLines = slideLines && amountOfLinesToShow && amountOfLinesToShow < slideLines ? Math.ceil(slideLines / amountOfLinesToShow) : null
    $: outputLine = amountOfLinesToShow && outSlide ? outSlide.line || 0 : null
    $: linesPercentage = slideLines && outputLine !== null ? outputLine / slideLines : 0
    $: linesIndex = maxLines !== null ? Math.floor(maxLines * linesPercentage) : 0

    $: bgOut = currentBgOutput?.out?.background
    $: videoPlaying = !!bgOut && (bgOut.type === "video" || bgOut.type === "player")
</script>

<svelte:window on:keydown={keydown} />

<div id="previewArea" class="main">
    <div class="top">
        <MultiOutputs />
        <div class="preview-meter">
            <AudioMeter channelId="main" preview />
        </div>
    </div>

    <div class="section" style="margin-bottom: 2px;">
        <ShowActions {currentOutput} {ref} {linesIndex} {maxLines} />
    </div>

    {#if videoPlaying}
        <div class="section transport">
            <MediaControls currentOutput={currentBgOutput} outputId={backgroundOutputId} transport />
        </div>
    {/if}

    {#if $activePage === "show"}
        <div class="section flat">
            <ClearButtons
                bind:autoChange
                activeClear={updatedActiveClear}
                on:update={(e) => {
                    activeClear = e.detail
                    if (e.detail === "audio") openToolsTab.set("audio")
                    else if (e.detail === "overlays") openToolsTab.set("overlays")
                    else if (e.detail === "nextTimer") openToolsTab.set("timers")
                }}
            />

            {#if updatedActiveClear === "slide"}
                <Show {currentOutput} {ref} {linesIndex} {maxLines} />
            {/if}
        </div>

        <SpotifyController />
    {/if}
</div>

<style>
    .main {
        /* max-height: 50%; */
        flex: 1;
        min-width: 50%;
    }

    .top {
        display: flex;
        position: relative;
    }
    /* button {
    background-color: inherit;
    color: inherit;
    border: none;
  } */

    .section {
        display: flex;
        flex-direction: column;

        position: relative;

        background-color: var(--primary-darker);
        border: 1px solid var(--border-color, var(--primary-lighter));
        margin: 5px;
        border-radius: var(--radius, 10px);

        overflow: hidden;

        transition: transform 0.2s ease;
    }

    /* limpiar: franja plana, sin esquinas redondeadas ni borde exterior */
    .section.flat {
        margin: 5px 0 0;
        border: 0;
        border-top: 1px solid var(--border);
        border-radius: 0;
        background-color: transparent;
    }

    .preview-meter {
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        width: 4px;
        z-index: 5;
    }
</style>

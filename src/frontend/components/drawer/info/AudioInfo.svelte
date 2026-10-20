<script lang="ts">
    import { fadeinAllPlayingAudio, fadeoutAllPlayingAudio, isAllAudioFading } from "../../../audio/audioFading"
    import { activeAudioEffects, activePopup, dataPath, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import FloatingBar from "../../../lib/components/ui/floating-bar/floating-bar.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import FolderField from "../../../lib/components/ui/folder-field/folder-field.svelte"
    import NumberField from "../../../lib/components/ui/number-field/number-field.svelte"
    import ToggleField from "../../../lib/components/ui/toggle-field/toggle-field.svelte"
    import { VideoPlayer } from "../../media/video/videoPlayer"
    import AudioEffects from "../audio/AudioEffects.svelte"
    import AudioMixers from "../audio/AudioMixers.svelte"

    // export let optionsOpen: boolean
    let settingsOpened = false

    $: sep = $dataPath?.includes("\\") ? "\\" : "/"
    $: defaultRecordingsPath = $dataPath ? `${$dataPath.replace(/[/\\]$/, "")}${sep}Recordings` : ""
    $: recordingsPath = $special?.audioRecordingsPath || defaultRecordingsPath

    function updateRecordingsPath(path: string) {
        special.update((a) => {
            if (!path || path === defaultRecordingsPath) delete a.audioRecordingsPath
            else a.audioRecordingsPath = path
            return a
        })
    }

    function updateSpecial(value, key) {
        special.update((a) => {
            a[key] = value
            return a
        })

        // if (!value && key === "allowGaining") AudioPlayer.updateVolume()

        if (key === "muteAudioWhenVideoPlays") {
            if (value && VideoPlayer.hasAudibleVideo()) {
                fadeoutAllPlayingAudio()
            } else if (!value && isAllAudioFading) {
                fadeinAllPlayingAudio()
            }
        }
    }
</script>

{#if settingsOpened}
    <main style="flex: 1;overflow-x: hidden;padding: 10px;">
        <NumberField label="settings.audio_fade_duration (s)" value={$special.audio_fade_duration ?? 1.5} max={30} step={0.5} on:change={(e) => updateSpecial(e.detail, "audio_fade_duration")} />

        <!-- defaultValue={false}  -->
        <ToggleField label="audio.mute_when_video_plays" checked={$special.muteAudioWhenVideoPlays || false} on:change={(e) => updateSpecial(e.detail, "muteAudioWhenVideoPlays")} />
        <!-- <ToggleField label="audio.allow_gaining" checked={$special.allowGaining || false} on:change={(e) => updateSpecial(e.detail, "allowGaining")} /> -->
        <!-- ReplayGain enabled always as it uses audio metadata info -->
        <!-- <ToggleField label="ReplayGain" checked={$special.replayGain || false} on:change={(e) => updateSpecial(e.detail, "replayGain")} /> -->

        <FolderField label="settings.recordings_path" value={recordingsPath} allowEmpty={!!$special?.audioRecordingsPath} on:change={(e) => updateRecordingsPath(e.detail)} />

        <Button variant="outline" style="width: 100%;margin-top: 10px;" on:click={() => activePopup.set("now_playing")}>
            <Icon id="document" />
            <T id="popup.now_playing" />
        </Button>
    </main>
{:else if $activeAudioEffects}
    <AudioEffects />
{:else}
    <AudioMixers />
{/if}

{#if !$activeAudioEffects}
    <FloatingBar round>
        <Button isActive={settingsOpened} title="audio.settings" on:click={() => (settingsOpened = !settingsOpened)}>
            <Icon size={1.1} id="options" white={!settingsOpened} />
        </Button>
    </FloatingBar>
{/if}

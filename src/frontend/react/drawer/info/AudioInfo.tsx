import { useState } from "react"
import { fadeinAllPlayingAudio, fadeoutAllPlayingAudio, isAllAudioFading } from "../../../audio/audioFading"
import { activeAudioEffects, activePopup, dataPath, special } from "../../../stores"
import { VideoPlayer } from "../../../components/media/video/videoPlayer"
import AudioMixers from "../../../components/drawer/audio/AudioMixers.svelte"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { FolderField } from "../../ui/folder-field/FolderField"
import { Icon } from "../../helpers/Icon"
import { NumberField } from "../../ui/number-field/NumberField"
import { ToggleField } from "../../ui/toggle-field/ToggleField"
import { AudioEffects } from "../audio/effects/AudioEffects"

// Port de components/drawer/info/AudioInfo.svelte. AudioMixers sigue en Svelte (F24.17c no lo migró).
export function AudioInfo() {
    const currentEffects = useStore(activeAudioEffects)
    const path = useStore(dataPath)
    const specialValue = useStore(special)
    const [settingsOpened, setSettingsOpened] = useState(false)

    const sep = path?.includes("\\") ? "\\" : "/"
    const defaultRecordingsPath = path ? `${path.replace(/[/\\]$/, "")}${sep}Recordings` : ""
    const recordingsPath = specialValue.audioRecordingsPath || defaultRecordingsPath

    function updateRecordingsPath(value: string) {
        special.update((a) => {
            if (!value || value === defaultRecordingsPath) delete a.audioRecordingsPath
            else a.audioRecordingsPath = value
            return a
        })
    }

    function updateSpecial(value: unknown, key: string) {
        special.update((a) => {
            a[key] = value
            return a
        })

        if (key === "muteAudioWhenVideoPlays") {
            if (value && VideoPlayer.hasAudibleVideo()) fadeoutAllPlayingAudio()
            else if (!value && isAllAudioFading) fadeinAllPlayingAudio()
        }
    }

    return (
        <>
            {settingsOpened ? (
                <main style={{ flex: 1, overflowX: "hidden", padding: "10px" }}>
                    <NumberField label="settings.audio_fade_duration (s)" value={specialValue.audio_fade_duration ?? 1.5} max={30} step={0.5} onChange={(value) => updateSpecial(value, "audio_fade_duration")} />
                    <ToggleField label="audio.mute_when_video_plays" checked={specialValue.muteAudioWhenVideoPlays || false} onChange={(value) => updateSpecial(value, "muteAudioWhenVideoPlays")} />
                    <FolderField label="settings.recordings_path" value={recordingsPath} allowEmpty={!!specialValue.audioRecordingsPath} onChange={updateRecordingsPath} />
                    <Button variant="outline" style={{ width: "100%", marginTop: "10px" }} onClick={() => activePopup.set("now_playing")}>
                        <Icon id="document" />
                        <T id="popup.now_playing" />
                    </Button>
                </main>
            ) : currentEffects ? (
                <AudioEffects />
            ) : (
                <SvelteIsland component={AudioMixers} />
            )}

            {!currentEffects ? (
                <FloatingBar round>
                    <Button isActive={settingsOpened} title="audio.settings" onClick={() => setSettingsOpened(!settingsOpened)}>
                        <Icon size={1.1} id="options" white={!settingsOpened} />
                    </Button>
                </FloatingBar>
            ) : null}
        </>
    )
}

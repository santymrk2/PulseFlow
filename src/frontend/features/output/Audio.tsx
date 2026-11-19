import { useEffect, useRef, useState } from "react"
import { AudioPlayer } from "../../shared/audio/audioPlayer"
import { AudioPlaylist } from "../../shared/audio/audioPlaylist"
import { activeFocus, activePlaylist, activeShow, audioPlaylists, focusMode, metronome, outLocked, playingAudio, playingMetronome } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getFileName, removeExtension } from "../../shared/utils/helpers/media"
import { joinTime, secondsToTime } from "../../shared/utils/helpers/time"
import { Icon } from "../../shared/ui/helpers/Icon"
import { triggerClickOnEnterSpace } from "../../shared/ui/helpers/triggerClickOnEnterSpace"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { Slider } from "../../shared/ui/kit/slider/Slider"
import styles from "./Audio.module.css"

function getName(id: string) {
    return removeExtension(getFileName(AudioPlayer.getPath(id))) || id
}

// Port de components/output/tools/Audio.svelte (F24.20c).
export function Audio() {
    const currentFocusMode = useStore(focusMode)
    const currentOutLocked = useStore(outLocked)
    const currentPlayingAudio = useStore(playingAudio)
    const currentPlayingMetronome = useStore(playingMetronome)
    const currentMetronome = useStore(metronome)
    const currentActivePlaylist = useStore(activePlaylist)
    const currentAudioPlaylists = useStore(audioPlaylists)
    const currentActiveShow = useStore(activeShow)

    const keys = Object.keys(currentPlayingAudio)
    const key = keys[0] || ""
    const path = AudioPlayer.getPath(key)
    const playing = (key ? currentPlayingAudio[key] : {}) as { audio?: HTMLAudioElement; isMic?: boolean; name?: string; index?: number; playlistId?: string; paused?: boolean }
    const paused = playing.paused !== false
    const justOneAudio = keys.length === 1

    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [sliderValue, setSliderValue] = useState<number | null>(null)
    const [fullLength, setFullLength] = useState(false)
    const updaterInterval = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (!justOneAudio || !key) {
            setCurrentTime(0)
            setDuration(0)
            return
        }
        let cancelled = false
        setCurrentTime(0)
        setDuration(0)
        void (async () => {
            const nextDuration = playing.isMic ? 0 : await AudioPlayer.getDuration(key || path)
            if (cancelled) return
            setDuration(nextDuration)
            setCurrentTime(playing.audio?.currentTime || 0)
        })()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [justOneAudio, key, path, playing.isMic])

    useEffect(() => {
        if (paused || !playing.audio) return
        if (updaterInterval.current) return
        updaterInterval.current = setInterval(() => {
            if (paused) {
                if (updaterInterval.current) clearInterval(updaterInterval.current)
                updaterInterval.current = null
                return
            }
            if (sliderValue === null) setCurrentTime(playing.audio?.currentTime || 0)
        }, 100)
        return () => {
            if (updaterInterval.current) {
                clearInterval(updaterInterval.current)
                updaterInterval.current = null
            }
        }
    }, [paused, playing.audio, sliderValue])

    useEffect(() => {
        return () => {
            if (updaterInterval.current) clearInterval(updaterInterval.current)
        }
    }, [])

    function setTime(event: { currentTarget: { value: string } }, id: string) {
        setSliderValue(null)
        playingAudio.update((all) => {
            const audio = all[id]?.audio as HTMLAudioElement | undefined
            if (!audio) return all
            audio.currentTime = Number(event.currentTarget.value) || 0
            if (paused) setTimeout(() => audio.pause(), 20)
            return all
        })
    }

    function openAudio(id: string, audio: { isMic?: boolean }) {
        if (currentFocusMode) activeFocus.set({ id, type: "audio" })
        else activeShow.set({ id, type: "audio", data: { isMic: audio.isMic } })
    }

    if (keys.length > 1) {
        return (
            <span className={styles.name} style={{ justifyContent: "space-between" }}>
                {Object.entries(currentPlayingAudio).map(([id, audio]) => {
                    const name = (audio as { name?: string }).name || getName(id)
                    return (
                        <Button key={id} title={name} onClick={() => openAudio(id, audio as { isMic?: boolean })} isActive={currentActiveShow?.id === id} style={{ zIndex: 2 }} bold={false}>
                            {(audio as { isMic?: boolean }).isMic ? <Icon id="microphone" size={1.2} right /> : null}
                            <p>{name}</p>
                        </Button>
                    )
                })}
            </span>
        )
    }

    if (key) {
        const name = playing.name || getName(key)
        const inPlaylist = currentActivePlaylist?.activeKey === key || currentActivePlaylist?.active === path
        return (
            <>
                <Button title={name} onClick={() => openAudio(key, playing)} isActive={currentActiveShow?.id === key || currentActiveShow?.id === path} style={{ padding: "5px 10px", opacity: 0.8, width: "100%", zIndex: 2 }} bold={false}>
                    {playing.isMic ? <Icon id="microphone" size={1.2} right /> : null}
                    <p style={{ fontSize: "0.9em" }}>
                        {inPlaylist ? `${currentAudioPlaylists[currentActivePlaylist.id]?.name}: ` : ""}
                        {name}
                    </p>
                </Button>
                {!playing.isMic ? (
                    <div className={styles.controls}>
                        <Button
                            style={{ flex: 0 }}
                            disabled={currentOutLocked}
                            title={translateText(paused ? "media.play" : "media.pause")}
                            onClick={() => {
                                if (currentOutLocked) return
                                AudioPlayer.start(path, { name }, { pauseIfPlaying: true, startAt: currentTime, playlistIndex: playing.index, playlistId: playing.playlistId })
                            }}
                        >
                            <Icon id={paused ? "play" : "pause"} white={paused} size={1.2} />
                        </Button>
                        {sliderValue !== null ? <span>{joinTime(secondsToTime(sliderValue))}</span> : <span style={{ color: "var(--secondary)" }}>{joinTime(secondsToTime(Math.floor(currentTime)))}</span>}
                        <Slider value={currentTime} max={duration} onInput={(event) => setSliderValue(Number((event.target as HTMLInputElement).value))} onChange={(event) => setTime(event as unknown as { currentTarget: { value: string } }, key)} />
                        <span style={fullLength ? {} : { color: "var(--secondary)" }} role="button" tabIndex={0} onClick={() => setFullLength((value) => !value)} onKeyDown={triggerClickOnEnterSpace}>
                            {fullLength ? joinTime(secondsToTime(duration)) : joinTime(secondsToTime(duration - Math.floor(currentTime)))}
                        </span>
                        {inPlaylist ? (
                            <Button style={{ flex: 0 }} disabled={currentOutLocked} title={translateText("media.next")} onClick={() => AudioPlaylist.next()}>
                                <Icon id="audio_forward" size={1.2} />
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </>
        )
    }

    if (currentPlayingMetronome) {
        return <p style={{ textAlign: "center", opacity: 0.9, padding: 4 }}>{`${currentMetronome.tempo || 120} | ${currentMetronome.beats || 4}`}</p>
    }
    return null
}

export default Audio

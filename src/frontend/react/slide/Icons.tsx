import { useEffect, useState, type CSSProperties } from "react"
import type { Media, Slide, SlideData } from "../../../types/Show"
import { AudioPlayer } from "../../audio/audioPlayer"
import { activeShow, activeTimers, outputs, shows } from "../../stores"
import { newToast } from "../../utils/common"
import { translateText } from "../../utils/language"
import { getAccess } from "../../utils/profile"
import { videoExtensions } from "../../values/extensions"
import { clone } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { getExtension, getFileName, removeExtension } from "../../components/helpers/media"
import { _show } from "../../components/helpers/shows"
import { joinTime, secondsToTime } from "../../components/helpers/time"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import styles from "./Icons.module.css"

export interface IconsProps {
    slide: Slide
    timer: number[]
    layoutSlide: SlideData
    background: Media | null
    backgroundCount?: number
    duration: number
    columns: number
    index: number
    style: string
}

// (F24.18b).
export function Icons({ slide, timer, layoutSlide, background, backgroundCount = 0, duration, columns, index, style }: IconsProps) {
    const currentShows = useStore(shows)
    const currentActiveShow = useStore(activeShow)
    const currentOutputs = useStore(outputs)
    const [audioDuration, setAudioDuration] = useState(0)

    const currentShow = currentShows[currentActiveShow?.id || ""] || {}
    const videoDuration = duration ? joinTime(secondsToTime(duration)) : null
    const isVideo = background?.path ? videoExtensions.includes(getExtension(background.path)) : false
    const muted = background?.muted !== false
    const looping = background?.loop !== false
    const nextTimer = (layoutSlide.nextTimer || 0) > 0 ? (layoutSlide.nextTimer! > 59 ? joinTime(secondsToTime(layoutSlide.nextTimer!)) : `${layoutSlide.nextTimer}s`) : null
    const transition = layoutSlide.transition || layoutSlide.mediaTransition
    const audio = layoutSlide.audio?.length ? _show().get()?.media?.[layoutSlide.audio[0]] || {} : {}
    const audioPath = audio.path
    const zoom = 4 / columns

    useEffect(() => {
        if (!audioPath) return
        let cancelled = false
        void AudioPlayer.getDuration(audioPath).then((value) => {
            if (!cancelled) setAudioDuration(value)
        })
        return () => {
            cancelled = true
        }
    }, [audioPath])

    function hasAccess() {
        if (currentShow.locked) {
            newToast("show.locked")
            return false
        }
        if (slide?.locked) {
            newToast("output.state_locked")
            return false
        }
        const profile = getAccess("shows")
        const readOnly = profile.global === "read" || profile[currentShow.category || ""] === "read"
        if (readOnly) {
            newToast("profile.locked")
            return false
        }
        return true
    }

    function removeLayout(key: string) {
        if (!hasAccess()) return
        history({ id: "SHOW_LAYOUT", newData: { key, indexes: [index] } })
    }

    function mute() {
        if (!hasAccess()) return
        _show()
            .media([layoutSlide.background || ""])
            .set({ key: "muted", value: false })
    }

    function removeLoop() {
        if (!hasAccess()) return
        _show()
            .media([layoutSlide.background || ""])
            .set({ key: "loop", value: false })
    }

    function resetTimer() {
        if (!hasAccess()) return
        activeTimers.update((a) => a.filter((_a, i) => !timer.includes(i)))
    }

    function removeSlideSetting(key: string) {
        if (!slide || currentShow.locked) return
        const settings = clone(slide.settings || {})
        delete (settings as Record<string, unknown>)[key]
        history({ id: "slideStyle", oldData: { style: slide.settings || {} }, newData: { style: settings }, location: { page: "show", show: currentActiveShow || undefined, slide: layoutSlide.id } })
    }

    function iconButton(id: string, title: string, onClick: () => void, extraStyle?: CSSProperties) {
        return (
            <div>
                <div className={styles.button}>
                    <Button align="start" style={{ padding: "3px", ...extraStyle }} redHover title={translateText(title)} onClick={onClick}>
                        <Icon id={id} size={0.9} white />
                    </Button>
                </div>
            </div>
        )
    }

    function countSpan(count: number) {
        return (
            <span>
                <p>{count}</p>
            </span>
        )
    }

    const audioTitles = layoutSlide.audio?.reduce((acc, audioId) => acc + removeExtension(getFileName(_show().get()?.media?.[audioId]?.path || "")) + ", ", "") || ""

    return (
        <div className={styles.icons} style={{ zoom, ...cssTextToStyle(style) }}>
            {layoutSlide.disabled ? iconButton("disable", "actions.enable", () => removeLayout("disabled")) : null}

            {timer.length ? (
                <div>
                    {iconButton("timer", "remove.timer", () => resetTimer())}
                    {timer.length > 1 ? countSpan(timer.length) : null}
                </div>
            ) : null}

            {nextTimer ? (
                <div>
                    {iconButton("clock", "remove.nextTimer", () => removeLayout("nextTimer"))}
                    <span>
                        <p>{nextTimer}</p>
                    </span>
                </div>
            ) : null}

            {layoutSlide.end ? iconButton("restart", "remove.to_start", () => removeLayout("end")) : null}

            {transition ? (
                <div>
                    {iconButton("transition", "remove.transition", () => {
                        removeLayout("transition")
                        removeLayout("mediaTransition")
                    })}
                </div>
            ) : null}

            {layoutSlide.bindings?.length ? (
                <div>
                    {iconButton("bind", "actions.remove_binding", () => removeLayout("bindings"))}
                    {layoutSlide.bindings.length > 1 ? (
                        countSpan(layoutSlide.bindings.length)
                    ) : (
                        <span>
                            <p>{currentOutputs[layoutSlide.bindings[0]]?.name || ""}</p>
                        </span>
                    )}
                </div>
            ) : null}

            {background ? (
                <div>
                    {iconButton(["camera", "screen", "ndi"].includes(background.type || "") ? background.type || "" : background.path?.startsWith("http") ? "web" : "image", "remove.background", () => removeLayout("background"))}
                    {videoDuration ? (
                        <span>
                            <p>{videoDuration}</p>
                        </span>
                    ) : null}
                </div>
            ) : null}

            {background && muted && isVideo ? iconButton("muted", "actions.unmute", () => mute()) : null}

            {background && looping && isVideo && backgroundCount > 1 ? iconButton("loop", "media._loop", () => removeLoop(), layoutSlide.actions?.nextAfterMedia ? { opacity: 0.5 } : undefined) : null}

            {layoutSlide.mics?.length ? (
                <div>
                    {iconButton("microphone", "actions.remove", () => removeLayout("mics"))}
                    {layoutSlide.mics.length > 1 ? countSpan(layoutSlide.mics.length) : null}
                </div>
            ) : null}

            {layoutSlide.audio?.length ? (
                <div style={{ maxWidth: "200px", overflow: "hidden" }}>
                    {iconButton("audio", "remove.audio", () => removeLayout("audio"))}
                    <span style={{ whiteSpace: "nowrap", textOverflow: "ellipsis" }} data-title={audioTitles.slice(0, -2)}>
                        {layoutSlide.audio.length === 1 ? (
                            <>
                                <p>{joinTime(secondsToTime(audioDuration))}</p>
                                &nbsp;|&nbsp;{removeExtension(getFileName(audioPath || ""))}
                            </>
                        ) : (
                            <p>{layoutSlide.audio.length}</p>
                        )}
                    </span>
                </div>
            ) : null}

            {layoutSlide.effects?.length ? (
                <div>
                    {iconButton("effects", "remove.effects", () => removeLayout("effects"))}
                    {layoutSlide.effects.length > 1 ? countSpan(layoutSlide.effects.length) : null}
                </div>
            ) : null}

            {layoutSlide.overlays?.length ? (
                <div>
                    {iconButton("overlays", "remove.overlays", () => removeLayout("overlays"))}
                    {layoutSlide.overlays.length > 1 ? countSpan(layoutSlide.overlays.length) : null}
                </div>
            ) : null}

            {slide?.settings?.template ? iconButton("templates", "actions.remove", () => removeSlideSetting("template")) : null}
        </div>
    )
}

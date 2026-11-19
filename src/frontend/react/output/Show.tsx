import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import type { Output } from "../../../types/Output"
import type { LayoutRef } from "../../../types/Show"
import { activeFocus, activeShow, focusMode, outLocked, outputs, playingVideoState, presentationData, showsCache } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { getFileName, removeExtension } from "../../components/helpers/media"
import { formatUrl, getOutputtedWebsites, sendWebsiteKey, toggleWebsiteMute, triggerWebsiteAction } from "../../components/helpers/websiteControls"
import { VideoPlayer } from "../../components/media/video/videoPlayer"
import { Icon } from "../helpers/Icon"
import { triggerClickOnEnterSpace } from "../helpers/triggerClickOnEnterSpace"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { VideoSlider } from "./VideoSlider"
import styles from "./Show.module.css"

interface TempRef {
    temp: boolean
    items: unknown[]
    id: string
}

export interface ShowProps {
    currentOutput: Output
    ref: (LayoutRef | TempRef)[] | undefined
    linesIndex: null | number
    maxLines: null | number
}

// Port de components/output/tools/ShowImpl.svelte (F24.24b).
export function Show({ currentOutput, ref, linesIndex, maxLines }: ShowProps) {
    const currentFocusMode = useStore(focusMode)
    const currentOutLocked = useStore(outLocked)
    const currentOutputs = useStore(outputs)
    const currentPlayingVideoState = useStore(playingVideoState)
    const currentPresentationData = useStore(presentationData)
    const currentShowsCache = useStore(showsCache)

    const [mutedWebsites, setMutedWebsites] = useState<Record<string, boolean>>({})

    const slide = currentOutput?.out?.slide
    const name = slide?.name || (slide?.id ? currentShowsCache[slide.id]?.name : "") || "—"
    const length = ref?.length || 0

    function openShow() {
        if (!slide || slide.id === "temp") return

        if (slide.layout && currentShowsCache[slide.id]) {
            showsCache.update((cache) => {
                const show = cache[slide.id]
                if (!show.settings) show.settings = { activeLayout: "", template: null }
                show.settings.activeLayout = slide.layout!
                return cache
            })
        }

        const showRef = { id: slide.id, type: slide.type || "show" }
        if (currentFocusMode) activeFocus.set(showRef)
        else activeShow.set(showRef)
    }

    const currentIndex = slide?.type === "ppt" ? currentPresentationData.stat?.position : (slide?.page || slide?.index || 0) + 1
    const totalLength = slide?.type === "ppt" ? currentPresentationData.stat?.slides : slide?.pages || length

    const itemVideos = Object.entries(currentPlayingVideoState).filter(([, data]) => data.type === "item")

    function playPause(path: string, outputId: string, isPaused: boolean) {
        if (isPaused) VideoPlayer.play(path, outputId)
        else VideoPlayer.pause(path, outputId)
    }

    function toggleLoop(path: string, outputId: string) {
        VideoPlayer.toggleLoop(path, outputId)
    }

    function toggleMute(src: string) {
        const isMuted = !mutedWebsites[src]
        setMutedWebsites((previous) => ({ ...previous, [src]: isMuted }))
        toggleWebsiteMute(src, isMuted)
    }

    const websites = getOutputtedWebsites(currentOutputs)

    function handleWebsiteKeydown(event: ReactKeyboardEvent<HTMLDivElement>, websiteSrc: string) {
        if (event.key === "ArrowLeft") {
            event.preventDefault()
            event.stopPropagation()
            sendWebsiteKey(websiteSrc, "Left")
        } else if (event.key === "ArrowRight") {
            event.preventDefault()
            event.stopPropagation()
            sendWebsiteKey(websiteSrc, "Right")
        }
    }

    return (
        <>
            {slide ? (
                <>
                    <span className={styles.name} style={{ justifyContent: "space-between" }} role="button" tabIndex={0} onClick={openShow} onKeyDown={triggerClickOnEnterSpace}>
                        <p style={{ fontSize: "0.9em" }}>{name.length ? name : <T id="main.unnamed" />}</p>
                        {totalLength ? (
                            <span style={{ opacity: 0.6, whiteSpace: "nowrap", fontSize: "0.9em" }}>
                                {currentIndex}/{totalLength}
                                {linesIndex !== null && maxLines !== null ? (
                                    <span style={{ opacity: 0.8, fontSize: "0.8em" }}>
                                        ({linesIndex + 1}/{maxLines})
                                    </span>
                                ) : null}
                            </span>
                        ) : null}
                    </span>

                    {itemVideos.length
                        ? itemVideos.map(([key, data]) => {
                              const sepIndex = key.lastIndexOf("_")
                              const path = sepIndex !== -1 ? key.slice(0, sepIndex) : key
                              const outputId = sepIndex !== -1 ? key.slice(sepIndex + 1) : ""
                              return (
                                  <div key={key} className={styles.videoValues}>
                                      <p>{removeExtension(getFileName(path))}</p>
                                      <span className={styles.group}>
                                          <Button title={translateText(data.paused ? "media.play" : "media.pause")} disabled={currentOutLocked} onClick={() => playPause(path, outputId, data.paused)}>
                                              <Icon id={data.paused ? "play" : "pause"} white={data.paused} />
                                          </Button>
                                          <VideoSlider outputId={outputId} path={path} disabled={currentOutLocked} videoData={{ duration: data.duration, paused: data.paused, loop: data.loop, muted: data.muted }} videoTime={data.currentTime} />
                                          <Button title={translateText("media._loop" + (data.loop ? ": settings.enabled" : ""))} onClick={() => toggleLoop(path, outputId)}>
                                              <Icon id="loop" white={!data.loop} />
                                          </Button>
                                          <Button title={translateText(data.muted === false ? "actions.mute" : "actions.unmute")} disabled={currentOutLocked} onClick={() => VideoPlayer.toggleMute(path, outputId)}>
                                              <Icon id={data.muted === false ? "volume" : "muted"} white={data.muted !== false} />
                                          </Button>
                                      </span>
                                  </div>
                              )
                          })
                        : null}
                </>
            ) : null}

            {websites.map((website) => (
                <div key={website.src} className={`${styles.videoValues} ${styles.websiteValues}`} tabIndex={0} role="button" onKeyDown={(event) => handleWebsiteKeydown(event, website.src)}>
                    <p title={website.src}>{formatUrl(website.src)}</p>
                    <span className={styles.group}>
                        <Button title={translateText("media.previous")} disabled={currentOutLocked} onClick={() => sendWebsiteKey(website.src, "Left")}>
                            <Icon id="previous" white />
                        </Button>
                        <Button title={translateText("media.next")} disabled={currentOutLocked} onClick={() => sendWebsiteKey(website.src, "Right")}>
                            <Icon id="next" white />
                        </Button>
                        <Button title={translateText("preview.reload")} disabled={currentOutLocked} onClick={() => triggerWebsiteAction({ src: website.src, type: "reload" })}>
                            <Icon id="refresh" white />
                        </Button>
                        <Button title={translateText(mutedWebsites[website.src] ? "actions.unmute" : "actions.mute")} disabled={currentOutLocked} onClick={() => toggleMute(website.src)}>
                            <Icon id={mutedWebsites[website.src] ? "muted" : "volume"} white={mutedWebsites[website.src]} />
                        </Button>
                    </span>
                </div>
            ))}
        </>
    )
}

export default Show

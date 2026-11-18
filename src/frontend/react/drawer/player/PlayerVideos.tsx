import { useRef, useState } from "react"
import type { Category } from "../../../../types/Tabs"
import { clone, sortByName } from "../../../components/helpers/array"
import { findMatchingOut, setOutput } from "../../../components/helpers/output"
import { clearBackground, clearSlide } from "../../../components/output/clear"
import { activeFocus, activePlayerTagFilter, activeShow, focusMode, outLocked, outputs, playerTags, playerVideos } from "../../../stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import { Card } from "../Card"
import styles from "./PlayerVideos.module.css"

// Port de components/drawer/player/PlayerVideos.svelte.
export interface PlayerVideosProps {
    active: string
}

type PlayerVideo = Category & { rid: string }

export function PlayerVideos({ active }: PlayerVideosProps) {
    const videosValue = useStore(playerVideos)
    const tagFilter = useStore(activePlayerTagFilter)
    const tags = useStore(playerTags)
    const activeShowValue = useStore(activeShow)
    const outputsValue = useStore(outputs)
    const focusModeValue = useStore(focusMode)
    const outLockedValue = useStore(outLocked)
    const [loaded, setLoaded] = useState<Record<string, boolean>>({})
    const iconClicked = useRef<ReturnType<typeof setTimeout> | null>(null)

    const videos = sortByName(
        Object.entries(videosValue)
            .map(([id, video]) => ({ rid: id, ...video }))
            .filter((a) => a.type === active)
    ) as PlayerVideo[]

    let filteredVideos: PlayerVideo[] = clone(videos)
    if (tagFilter.length) {
        filteredVideos = filteredVideos.filter((a) => a.tags?.length && !tagFilter.find((tagId) => !a.tags!.includes(tagId)))
    }

    function getThumbnail(videoId: string) {
        if (!videoId) return ""
        if (active === "youtube") return `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
        if (active === "vimeo") return `https://vumbnail.com/${videoId}_medium.jpg`
        return ""
    }

    function removeStyle(key: string, id: string | undefined) {
        if (!id) return
        iconClicked.current = setTimeout(() => (iconClicked.current = null), 50)
        playerVideos.update((a) => {
            if (!a[id]) return a
            if (key === "tags") a[id].tags = []
            return a
        })
    }

    function isIconClicked() {
        return iconClicked.current !== null
    }

    return (
        <>
            {filteredVideos.length ? (
                filteredVideos.map((video) => {
                    const videoTags = video.tags || []
                    const matchingOut = findMatchingOut(video.rid, outputsValue)
                    return (
                        <Card
                            key={video.rid}
                            loaded={loaded[video.rid]}
                            className="context #player_button"
                            preview={activeShowValue?.id === video.rid}
                            active={matchingOut !== null}
                            outlineColor={matchingOut}
                            label={video.name || ""}
                            renameId={`player_${video.rid}`}
                            title={video.id || ""}
                            showPlayOnHover
                            onClick={(e) => {
                                if (outLockedValue || e.ctrlKey || e.metaKey || isIconClicked()) return
                                if ((e.target as Element | null)?.closest?.(".edit")) return
                                if (findMatchingOut(video.rid, outputsValue)) {
                                    clearBackground()
                                    return
                                }
                                clearSlide()
                                setOutput("background", { id: video.rid, type: "player", muted: false, loop: false, startAt: 0, ignoreLayer: true })
                            }}
                            onDblClick={() => {
                                if (isIconClicked()) return
                                if (focusModeValue) activeFocus.set({ id: video.rid, type: "player" })
                                else activeShow.set({ id: video.rid, type: "player" })
                            }}
                        >
                            <div className={styles.icons}>
                                {videoTags.length ? (
                                    <div style={{ maxWidth: "100%" }}>
                                        <div className={styles.button}>
                                            <Button align="start" style={{ padding: "3px" }} redHover title={translateText("actions.remove")} onClick={() => removeStyle("tags", video.rid)}>
                                                <Icon id="tag" size={0.9} white />
                                            </Button>
                                        </div>
                                        <span style={{ maxWidth: "100%" }}>
                                            <p>{videoTags.length === 1 ? tags[videoTags[0]]?.name || "—" : videoTags.length}</p>
                                        </span>
                                    </div>
                                ) : null}
                            </div>

                            <SelectElem id="player" data={video.rid} style={{ width: "100%" }} draggable>
                                <img src={getThumbnail(video.id || "")} alt={`Video thumbnail for ${video.name || "video"}`} style={{ width: "100%", height: "100%", aspectRatio: "19/9", objectFit: "cover" }} onLoad={() => setLoaded((current) => ({ ...current, [video.rid]: true }))} />
                            </SelectElem>
                        </Card>
                    )
                })
            ) : (
                <Center size={1.2} faded>
                    {videos.length ? <T id="empty.search" /> : <T id="empty.player" />}
                </Center>
            )}
        </>
    )
}

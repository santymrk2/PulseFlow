import { useEffect, useState } from "react"
import { Main } from "../../../../types/IPC/Main"
import type { ShowType } from "../../../../types/Show"
import { clearAudio } from "../../../audio/audioFading"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { requestMain, sendMain } from "../../../shared/core/ipc/main"
import { activePopup, activeProject, focusMode, media, outLocked, outputs, popupData, projects, styles } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { audioExtensions, imageExtensions, videoExtensions } from "../../../shared/core/values/extensions"
import { Card } from "../../drawer/Card"
import { MediaLoader } from "../../drawer/media/MediaLoader"
import { keysToID, sortByName } from "../../../components/helpers/array"
import { getExtension, getMediaLayerType, getMediaStyle, getMediaType, getVideoDuration } from "../../../components/helpers/media"
import { findMatchingOut, getFirstActiveOutput, setOutput, startFolderTimer } from "../../../components/helpers/output"
import { joinTime, secondsToTime } from "../../../components/helpers/time"
import { clearBackground, clearSlide } from "../../../components/output/clear"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import stylesCss from "./FolderShow.module.css"

type TFile = { path: string; name: string; type: ShowType; thumbnail?: string }

export interface FolderShowProps {
    path: string
    index: number
}

// (F24.20a).
export function FolderShow({ path, index }: FolderShowProps) {
    const currentProjects = useStore(projects)
    const currentActiveProject = useStore(activeProject)
    const currentFocusMode = useStore(focusMode)
    const currentMedia = useStore(media)
    const currentOutLocked = useStore(outLocked)
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(styles)

    const data = currentProjects[currentActiveProject || ""]?.shows?.[index]?.data as { timer?: number } | undefined
    const timer = data?.timer ?? 10

    const [folderFiles, setFolderFiles] = useState<TFile[]>([])
    const [totalTime, setTotalTime] = useState(0)

    const currentOutput = getFirstActiveOutput(currentOutputs)
    const currentStyle = currentStyles[currentOutput?.style || ""] || {}

    useEffect(() => {
        let cancelled = false
        const mediaExtensions = [...videoExtensions, ...imageExtensions, ...audioExtensions]
        void (async () => {
            const files = keysToID((await requestMain(Main.READ_FOLDER, { path, generateThumbnails: true })) || {})
            const loaded = sortByName(files.filter((a) => mediaExtensions.includes(getExtension(a.name))).map((a) => ({ path: a.path, name: a.name, type: getMediaType(getExtension(a.name)), thumbnail: (a as { thumbnailPath?: string }).thumbnailPath })))
            if (cancelled) return
            setFolderFiles(loaded)

            let total = 0
            for (const file of loaded) {
                if (file.type === "image") total += timer
                else if (file.type === "video") total += await getVideoDuration(file.path)
            }
            if (!cancelled) setTotalTime(Math.ceil(total))
        })()
        return () => {
            cancelled = true
        }
    }, [path, timer])

    function playMedia(file: TFile) {
        if (currentOutLocked) return

        if (file.type === "audio") {
            if (AudioPlayer.getPlaying(file.path)) clearAudio(file.path)
            else AudioPlayer.start(file.path, { name: file.name })
            return
        }

        if (findMatchingOut(file.path, currentOutputs)) {
            clearBackground()
            return
        }

        const mediaStyle = getMediaStyle(currentMedia[file.path], currentStyle)
        const videoType = getMediaLayerType(file.path, mediaStyle)
        const loop = videoType === "foreground" ? false : true
        const muted = videoType === "background" ? true : false
        if (videoType === "foreground") clearSlide()
        setOutput("background", { path: file.path, type: file.type, loop, muted, startAt: 0, ...mediaStyle, ignoreLayer: videoType === "foreground" })
        startFolderTimer(path, file)
    }

    return (
        <>
            <div className={stylesCss.grid}>
                {folderFiles.length ? (
                    folderFiles.map((file) => {
                        const outputted = file.type === "audio" ? AudioPlayer.getPlaying(file.path) : findMatchingOut(file.path, currentOutputs)
                        return (
                            <Card key={file.path} resolution={{ width: 16, height: 9 }} width={25} outlineColor={typeof outputted === "string" ? outputted : null} active={file.type === "audio" ? !!outputted : outputted !== null} label={file.name} title={file.path} icon={file.type === "audio" ? "music" : file.type} white={file.type !== "video"} showPlayOnHover checkered={file.type !== "audio"} onClick={() => playMedia(file)}>
                                <div className={stylesCss.icons}>
                                    {file.type === "image" && timer ? (
                                        <div>
                                            <div className={stylesCss.button}>
                                                <div style={{ padding: 3 }} data-title={translateText("preview.nextTimer")}>
                                                    <Icon id="clock" size={0.9} white />
                                                </div>
                                            </div>
                                            <span>
                                                <p>{timer}</p>
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                                <div className={`${stylesCss.icons} ${stylesCss.right}`}>
                                    {file.type === "video" ? (
                                        <div>
                                            <div className={stylesCss.button}>
                                                <div style={{ padding: 3 }} data-title={translateText("actions.next_after_media")}>
                                                    <Icon id="forward" size={0.9} white />
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                {file.type === "audio" ? <Icon id="music" size={4} style={{ alignSelf: "center" }} /> : <MediaLoader name={file.name} path={file.path} type={file.type} thumbnailPath={file.thumbnail || ""} mediaStyle={getMediaStyle(currentMedia[file.path], currentStyle)} />}
                            </Card>
                        )
                    })
                ) : (
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                )}
            </div>

            {!currentFocusMode ? (
                <>
                    <FloatingBar side="left" onlyOne>
                        <Button icon="folder" onClick={() => sendMain(Main.OPEN_FOLDER_PATH, path)}>
                            <T id="main.open" />
                        </Button>
                    </FloatingBar>

                    <FloatingBar onlyOne>
                        <Button
                            disabled={!folderFiles.length}
                            onClick={() => {
                                popupData.set({ type: "folder", value: timer, totalTime, count: folderFiles.filter((a) => a.type === "image").length })
                                activePopup.set("next_timer")
                            }}
                            title={`popup.next_timer${totalTime !== 0 ? `: ${totalTime}s` : ""}`}
                        >
                            <Icon size={1.1} id="clock" white={totalTime === 0} />
                            {joinTime(secondsToTime(totalTime))}
                        </Button>
                    </FloatingBar>
                </>
            ) : null}
        </>
    )
}

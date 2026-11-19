import { useEffect, useState } from "react"
import { Main } from "../../../../types/IPC/Main"
import { requestMain, sendMain } from "../../../shared/core/ipc/main"
import { activeRecording, activeShow, cloudSyncData, drawerTabsData, special } from "../../../shared/core/stores"
import { videoExtensions } from "../../../shared/core/values/extensions"
import { formatBytes } from "../../../shared/utils/helpers/bytes"
import { getExtension, getFileName, getMediaInfo, removeExtension } from "../../../shared/utils/helpers/media"
import { LiveInfo } from "../live/LiveInfo"
import { useStore } from "../../hooks/useStore"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { Center } from "../../system/Center"
import { Clock } from "../../system/Clock"
import { Date } from "../../system/Date"
import { InputRow } from "../../ui/input-row/InputRow"
import { ToggleField } from "../../ui/toggle-field/ToggleField"
import { InfoMetadata, type InfoMetadataEntry } from "./InfoMetadata"
import { PlayerInfo } from "./PlayerInfo"
import styles from "./MediaInfo.module.css"

// Port de components/drawer/info/MediaInfo.svelte. LiveInfo, Clock y Date son ports React.
export interface MediaInfoProps {
    optionsOpen: boolean
}

interface MediaData {
    size?: number
    birthtimeMs?: number
    mtimeMs?: number
    ctimeMs?: number
    extension?: string
}

interface CodecInfo {
    codecs?: string[]
    mimeType?: string
    mimeCodec?: string
}

export function MediaInfo({ optionsOpen }: MediaInfoProps) {
    const recording = useStore(activeRecording)
    const show = useStore(activeShow)
    const cloud = useStore(cloudSyncData)
    const tabsData = useStore(drawerTabsData)
    const specialValue = useStore(special)
    const subTab = tabsData.media?.activeSubTab

    const [mediaData, setMediaData] = useState<MediaData>({})
    const [codecInfo, setCodecInfo] = useState<CodecInfo>({})
    const [name, setName] = useState(show?.name || "")

    const showId = show?.id
    useEffect(() => {
        setName(show?.name || "")
        setMediaData({})
        setCodecInfo({})
        if (!showId || !["media", "image", "video"].includes(show.type || "") || showId.startsWith("http") || showId.startsWith("data:")) return

        requestMain(Main.FILE_INFO, showId, (data) => {
            if (!data) return
            setMediaData({ ...data.stat, extension: data.extension })
            if (!name) setName(removeExtension(getFileName(data.path)))
        })

        async function getCodecInfo() {
            if (!videoExtensions.includes(getExtension(showId || ""))) return
            const data = await getMediaInfo(showId || "")
            if (data) setCodecInfo(data)
        }
        void getCodecInfo()
        // `name` se lee del render en el callback de FILE_INFO, igual que en Svelte.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showId, show?.type])

    const info: InfoMetadataEntry[] = [{ label: "info.extension", value: mediaData.extension?.toUpperCase() || "-" }, { label: "info.size", value: formatBytes(mediaData.size || 0) }, { label: "info.created", value: mediaData.birthtimeMs, type: "date" }, { label: "info.modified", value: mediaData.mtimeMs, type: "date" }, { label: "info.changed", value: mediaData.ctimeMs, type: "date" }, ...(codecInfo.codecs ? [{ label: "info.codecs", value: codecInfo.codecs.join(", ") }] : [])]

    function updateSpecial(value: unknown, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value
            return a
        })
    }

    function bundleMediaFiles() {
        sendMain(Main.BUNDLE_MEDIA_FILES, { openFolder: true })
    }

    if (subTab === "inputs" || recording) return <LiveInfo optionsOpen={optionsOpen} />
    if (subTab === "online") return <PlayerInfo optionsOpen={optionsOpen} />

    return (
        <div className={styles.scroll}>
            {optionsOpen ? (
                <main style={{ overflowX: "hidden", padding: "10px" }}>
                    <ToggleField label="settings.clear_media_when_finished" checked={specialValue.clearMediaOnFinish ?? true} defaultValue={true} onChange={(value) => updateSpecial(value, "clearMediaOnFinish", true)} />
                    <ToggleField label="settings.auto_locate_missing_media_files" checked={specialValue.autoLocateMedia ?? true} defaultValue={true} onChange={(value) => updateSpecial(value, "autoLocateMedia", true)} />
                    {!cloud.enabled && !specialValue.cloudSyncMediaFolder ? (
                        <InputRow>
                            <Button title="media.bundle_media_files_tip" style={{ width: "100%", marginTop: "10px" }} icon="image" onClick={bundleMediaFiles}>
                                <T id="media.bundle_media_files" />
                            </Button>
                        </InputRow>
                    ) : null}
                    <InputRow>
                        <Button icon="launch" style={{ width: "100%", marginTop: "10px" }} onClick={() => sendMain(Main.OPEN_CACHE)} white>
                            <T id="actions.open_cache_folder" />
                        </Button>
                    </InputRow>
                </main>
            ) : show?.type === "video" || show?.type === "image" ? (
                <InfoMetadata title={name} info={info} />
            ) : (
                <Center>
                    <Clock />
                    <Date />
                </Center>
            )}
        </div>
    )
}

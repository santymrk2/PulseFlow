import { useState } from "react"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { audioStreams, playingAudio } from "../../../shared/core/stores"
import { keysToID, sortByName } from "../../../components/helpers/array"
import { Loader } from "../../main/Loader"
import { T } from "../../helpers/T"
import { Center } from "../../system/Center"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import { useStore } from "../../hooks/useStore"
import styles from "./AudioStreams.module.css"

// Port de components/drawer/live/AudioStreams.svelte.
export function AudioStreams() {
    const streams = useStore(audioStreams)
    const playing = useStore(playingAudio)
    const streamsList = sortByName(keysToID(streams))
    const [loadingStreams, setLoadingStreams] = useState<Set<string>>(new Set())

    async function loadStream(streamId: string) {
        if (loadingStreams.has(streamId)) return
        setLoadingStreams((current) => new Set(current).add(streamId))
        const streamData = streams[streamId]
        await AudioPlayer.start(streamData.value, { name: streamData.name })
        setLoadingStreams((current) => {
            const next = new Set(current)
            next.delete(streamId)
            return next
        })
    }

    if (!streamsList.length) {
        return (
            <Center faded>
                <T id="empty.general" />
            </Center>
        )
    }

    return (
        <div className={styles.streams}>
            {streamsList.map((stream) => (
                <SelectElem key={stream.id} id="audio_stream" data={{ id: stream.id, type: "audio_stream" }} draggable>
                    <Button className="context #audio_stream" style={{ flex: 1 }} showOutline={Object.keys(playing).includes(stream.value)} onClick={() => loadStream(stream.id)} bold={false} align="start">
                        <div className={styles.stream}>
                            <div className={styles.loader} style={{ overflow: "hidden" }}>
                                {loadingStreams.has(stream.id) ? <Loader size={0.3} /> : null}
                            </div>
                            <span style={{ paddingInlineStart: 5 }}>
                                <p>{stream.name}</p>
                            </span>
                            <span style={{ paddingInlineStart: 10, fontWeight: "normal", opacity: 0.5 }}>{stream.value}</span>
                        </div>
                    </Button>
                </SelectElem>
            ))}
        </div>
    )
}

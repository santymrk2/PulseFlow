import type { MediaStyle } from "../../../types/Main"
import { getMediaStyle } from "../../shared/utils/helpers/media"
import { activeEdit, media } from "../../shared/core/stores"
import { Cam } from "../drawer/live/Cam"
import { useStore } from "../hooks/useStore"

// Port de components/edit/editors/CameraEditor.svelte.
export function CameraEditor() {
    const currentActiveEdit = useStore(activeEdit)
    const currentMedia = useStore(media)

    const mediaId = currentActiveEdit.id
    const data = currentActiveEdit.data

    let mediaStyle: MediaStyle = {}
    if (mediaId) mediaStyle = getMediaStyle(currentMedia[mediaId], undefined)

    const cameraStyleString = `object-fit: ${mediaStyle.fit || "contain"};filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    return (
        <div className="parent" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div className="media" style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                {data ? <Cam cam={data} item style={cameraStyleString} /> : null}
            </div>
        </div>
    )
}

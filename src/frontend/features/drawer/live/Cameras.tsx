import { useEffect, useState } from "react"
import { media } from "../../../shared/core/stores"
import { cameraManager, type CameraData } from "../../media/logic/cameraManager"
import { sortByName } from "../../../shared/utils/helpers/array"
import { getMediaStyle } from "../../../shared/utils/helpers/media"
import { T } from "../../../shared/ui/helpers/T"
import { Center } from "../../../shared/ui/system/Center"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Cam } from "./Cam"
import type { InputSelectDetail } from "./types"

export interface CamerasProps {
    showPlayOnHover?: boolean
    onClick?: (detail: InputSelectDetail) => void
}

// Port de components/drawer/live/Cameras.svelte.
export function Cameras({ showPlayOnHover = true, onClick }: CamerasProps) {
    const [cams, setCams] = useState<CameraData[]>([])
    const mediaData = useStore(media)

    useEffect(() => {
        let alive = true
        cameraManager.getCamerasList().then((cameras) => {
            if (alive) setCams(sortByName(cameras))
        })
        return () => {
            alive = false
        }
    }, [])

    function getStyle(id: string) {
        const mediaStyle = getMediaStyle(mediaData[id], undefined)
        return `object-fit: ${mediaStyle.fit || "contain"};filter: ${mediaStyle.filter};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
    }

    if (!cams.length) {
        return (
            <Center faded>
                <T id="empty.general" />
            </Center>
        )
    }

    return (
        <>
            {cams.map((cam) => (
                <Cam
                    key={cam.id}
                    cam={cam}
                    style={getStyle(cam.id)}
                    showPlayOnHover={showPlayOnHover}
                    onClick={(event) => {
                        cameraManager.clearBadCamera(cam.id)
                        onClick?.({ event, cam })
                    }}
                />
            ))}
        </>
    )
}

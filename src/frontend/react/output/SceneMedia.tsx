import type { CSSProperties } from "react"
import Window from "../../components/output/Window.svelte"
import { BMDStream } from "../drawer/live/BMDStream"
import { NDIStream } from "../drawer/live/NDIStream"
import { OMTStream } from "../drawer/live/OMTStream"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { Camera } from "./Camera"
import styles from "./SceneMedia.module.css"

interface SceneMediaData {
    type?: string
    id?: string
    name?: string
    group?: string
}

export interface SceneMediaProps {
    media?: SceneMediaData | null
    preview?: boolean
    className?: string
    style?: string
}

// Port de components/output/layers/SceneMedia.svelte (F24.20c).
export function SceneMedia({ media, preview = false, className = "", style = "" }: SceneMediaProps) {
    if (!media) return null

    return (
        <div className={`${styles.layer} ${styles.mediaLayer} ${className}`} style={cssTextToStyle(style) as CSSProperties}>
            {media.type === "camera" ? <Camera id={media.id || ""} groupId={media.group || ""} className={styles.media} style="width: 100%;height: 100%;object-fit: cover;" preview={preview} /> : null}
            {media.type === "screen" ? <SvelteIsland component={Window} props={{ id: media.id || "", class: styles.media, style: "width: 100%;height: 100%;" }} /> : null}
            {media.type === "ndi" ? <NDIStream screen={{ id: media.id || "", name: media.name || "" }} background mirror={preview} /> : null}
            {media.type === "omt" ? <OMTStream screen={{ id: media.id || "", name: media.name || "" }} background mirror={preview} /> : null}
            {media.type === "blackmagic" ? <BMDStream screen={{ id: media.id || "", name: media.name || "" }} background mirror={preview} /> : null}
        </div>
    )
}

export default SceneMedia

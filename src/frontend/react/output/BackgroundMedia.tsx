import type { CSSProperties } from "react"
import type { MediaStyle } from "../../../types/Main"
import type { Styles } from "../../../types/Settings"
import type { OutBackground, Transition } from "../../../types/Show"
import { media, playerVideos, special } from "../../stores"
import { getMediaStyle } from "../../components/helpers/media"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { useStore } from "../hooks/useStore"
import { BMDStream } from "../drawer/live/BMDStream"
import { NDIStream } from "../drawer/live/NDIStream"
import { OMTStream } from "../drawer/live/OMTStream"
import Window from "../../components/output/Window.svelte"
import { Camera } from "./Camera"
import { OutputTransition } from "./OutputTransition"
import styles from "./BackgroundMedia.module.css"

export interface BackgroundMediaProps {
    outputId?: string
    data: OutBackground
    transition: Transition
    fadingOut?: boolean
    currentStyle?: Styles | null
    animationStyle?: string
    mirror?: boolean
    /** Nodo del cascarón Svelte con `<Media>`/`<Player>` y sus `bind:` originales. */
    slotHost?: HTMLElement | null
    onOutroStart?: () => void
    onLoaded?: () => void
}

// Port de components/output/layers/BackgroundMedia.svelte (F24.20c).
export function BackgroundMedia({ outputId = "", data, transition, fadingOut = false, currentStyle = null, animationStyle = "", mirror = false, slotHost, onOutroStart, onLoaded }: BackgroundMediaProps) {
    const currentMedia = useStore(media)
    const currentPlayers = useStore(playerVideos)
    const currentSpecial = useStore(special)
    const id = data.path || data.id || ""
    let type: string = data.type || "media"
    if (type === "video" || type === "image") type = "media"

    let mediaStyle: MediaStyle = {}
    if (data && currentStyle) mediaStyle = getMediaStyle({ ...currentMedia[id], ...data }, currentStyle)
    void outputId
    void animationStyle
    void fadingOut
    void onLoaded
    void mediaStyle

    return (
        <OutputTransition transition={transition} inTransition={transition.in} outTransition={transition.out} onOutroStart={onOutroStart}>
            {type === "media" ? (
                <div
                    data-slot-host
                    style={{ display: "contents" } as CSSProperties}
                    ref={(elem) => {
                        if (elem && slotHost && slotHost.parentNode !== elem) elem.appendChild(slotHost)
                    }}
                />
            ) : null}
            {type === "screen" ? <SvelteIsland component={Window} props={{ id, class: "media", style: "width: 100%;height: 100%;", "on:loaded": onLoaded }} /> : null}
            {type === "ndi" ? <NDIStream key={id} screen={{ id, name: "" }} background mirror={mirror} outputId={outputId} /> : null}
            {type === "omt" ? <OMTStream key={id} screen={{ id, name: "" }} background mirror={mirror} outputId={outputId} /> : null}
            {type === "blackmagic" ? <BMDStream screen={{ id, name: "" }} background mirror={mirror} outputId={outputId} /> : null}
            {type === "camera" ? <Camera id={id} groupId={data.cameraGroup || ""} className="media" style="width: 100%;height: 100%;" onLoaded={onLoaded} /> : null}
            {type === "player" ? (
                <>
                    {currentSpecial.hideCursor || currentPlayers[id]?.type !== "youtube" ? <div className={styles.overlay} /> : null}
                    <div
                        data-slot-host
                        style={{ display: "contents" } as CSSProperties}
                        ref={(elem) => {
                            if (elem && slotHost && slotHost.parentNode !== elem) elem.appendChild(slotHost)
                        }}
                    />
                </>
            ) : null}
        </OutputTransition>
    )
}

export default BackgroundMedia

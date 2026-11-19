import { useEffect, useRef, type ReactNode } from "react"
import { Scripture } from "./bible/Scripture"
import { Calendar } from "./calendar/Calendar"
import { drawerTabsData } from "../../shared/core/stores"
import { useStore } from "../hooks/useStore"
import { Actions } from "./pages/Actions"
import { Interactions } from "./pages/Interactions"
import { OBS } from "./pages/OBS"
import { Scenes } from "./pages/Scenes"
import { Shows } from "./pages/Shows"
import { Variables } from "./pages/Variables"
import { Timers } from "./timers/Timers"
import { Audio } from "./audio/Audio"
import { Media } from "./media/Media"
import styles from "./Content.module.css"

// Port de components/drawer/Content.svelte. Todas las páginas del cajón ya son React.
// `bind:streams` de Media se conserva pasando el mismo array (los hijos Svelte hacen push sobre él).
export interface ContentProps {
    id: string
}

export function Content({ id }: ContentProps) {
    const tabData = useStore(drawerTabsData)
    const active = tabData[id]?.activeSubTab || null
    const streams = useRef<MediaStream[]>([])

    // $: if (id !== "media" || active) stopStreams()
    useEffect(() => {
        if (id !== "media" || active) stopStreams(streams.current)
    }, [id, active])

    function renderPage(): ReactNode {
        if (id === "shows") return <Shows active={active} />
        if (id === "media") return <Media active={active} streams={streams.current} />
        if (id === "audio") return <Audio active={active} />
        if (id === "scripture") return <Scripture active={active} />
        if (id === "calendar") return <Calendar active={active} />
        if (id !== "functions" || !active) return null

        switch (active) {
            case "actions":
                return <Actions />
            case "timer":
                return <Timers />
            case "variables":
                return <Variables />
            case "scenes":
                return <Scenes />
            case "interactions":
                return <Interactions />
            case "obs":
                return <OBS />
        }
        return null
    }

    return <div className={styles.main}>{renderPage()}</div>
}

function stopStreams(streams: MediaStream[]) {
    streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
            track.enabled = false
            track.stop()
        })
    })
}

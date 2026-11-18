import { useEffect, useRef, type ReactNode } from "react"
import Scripture from "../../components/drawer/bible/Scripture.svelte"
import Calendar from "../../components/drawer/calendar/Calendar.svelte"
import Actions from "../../components/drawer/pages/Actions.svelte"
import Interactions from "../../components/drawer/pages/Interactions.svelte"
import OBS from "../../components/drawer/pages/OBS.svelte"
import Scenes from "../../components/drawer/pages/Scenes.svelte"
import Shows from "../../components/drawer/pages/Shows.svelte"
import Variables from "../../components/drawer/pages/Variables.svelte"
import Timers from "../../components/drawer/timers/Timers.svelte"
import { drawerTabsData } from "../../stores"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { useStore } from "../hooks/useStore"
import { Audio } from "./audio/Audio"
import { Media } from "./media/Media"
import styles from "./Content.module.css"

// Port de components/drawer/Content.svelte. Todavía switchboard de Svelte: cada página sigue siendo una isla.
// `bind:streams` de Media se conserva pasando el mismo array (los hijos Svelte hacen push sobre él).
export interface ContentProps {
    id: string
}

const FUNCTION_COMPONENTS = {
    actions: Actions,
    timer: Timers,
    variables: Variables,
    scenes: Scenes,
    interactions: Interactions,
    obs: OBS
} as const

export function Content({ id }: ContentProps) {
    const tabData = useStore(drawerTabsData)
    const active = tabData[id]?.activeSubTab || null
    const streams = useRef<MediaStream[]>([])

    // $: if (id !== "media" || active) stopStreams()
    useEffect(() => {
        if (id !== "media" || active) stopStreams(streams.current)
    }, [id, active])

    function renderPage(): ReactNode {
        if (id === "shows") return <SvelteIsland component={Shows} props={{ active }} />
        if (id === "media") return <Media active={active} streams={streams.current} />
        if (id === "audio") return <Audio active={active} />
        if (id === "scripture") return <SvelteIsland component={Scripture} props={{ active }} />
        if (id === "calendar") return <SvelteIsland component={Calendar} props={{ active }} />
        if (id === "functions" && active && active in FUNCTION_COMPONENTS) {
            const Component = FUNCTION_COMPONENTS[active as keyof typeof FUNCTION_COMPONENTS]
            return <SvelteIsland component={Component} />
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

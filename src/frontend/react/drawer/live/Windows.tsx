import { Fragment, useEffect, useState } from "react"
import { Main } from "../../../../types/IPC/Main"
import { requestMain } from "../../../shared/core/ipc/main"
import { clone } from "../../../components/helpers/array"
import { Center } from "../../system/Center"
import { T } from "../../helpers/T"
import { Capture } from "./Capture"
import type { InputSelectDetail, Screen } from "./types"

export interface WindowsProps {
    streams: MediaStream[]
    onClick?: (detail: InputSelectDetail) => void
}

// Port de components/drawer/live/Windows.svelte. El `{#key fullFilteredWindows}` se traduce en una key de Fragment.
export function Windows({ streams, onClick }: WindowsProps) {
    const [windows, setWindows] = useState<Screen[]>([])
    const [filtered, setFiltered] = useState<Screen[]>([])

    useEffect(() => {
        let alive = true
        requestMain(Main.GET_WINDOWS).then((result: Screen[] | undefined) => {
            if (!alive) return
            const list = result || []
            setWindows(list)
            setFiltered(clone(list))
        })
        return () => {
            alive = false
        }
    }, [])

    if (!filtered.length) {
        return (
            <Center size={1.2} faded>
                <T id={windows.length ? "empty.search" : "empty.general"} />
            </Center>
        )
    }

    return (
        // El `{#key fullFilteredWindows}` del Svelte fuerza remontar los Captures cuando cambia la lista.
        <Fragment key={JSON.stringify(filtered)}>
            {filtered.map((screen) => (
                <Capture key={screen.id} screen={screen} streams={streams} onClick={(event) => onClick?.({ event, screen })} />
            ))}
        </Fragment>
    )
}

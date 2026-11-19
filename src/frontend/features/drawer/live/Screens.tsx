import { useEffect, useState } from "react"
import { Main } from "../../../../types/IPC/Main"
import { requestMain } from "../../../shared/core/ipc/main"
import { Capture } from "./Capture"
import type { InputSelectDetail, Screen } from "./types"

export interface ScreensProps {
    streams: MediaStream[]
    onClick?: (detail: InputSelectDetail) => void
}

// Port de components/drawer/live/Screens.svelte.
export function Screens({ streams, onClick }: ScreensProps) {
    const [screens, setScreens] = useState<Screen[]>([])

    useEffect(() => {
        let alive = true
        requestMain(Main.GET_SCREENS).then((result: Screen[] | undefined) => {
            if (alive) setScreens(result || [])
        })
        return () => {
            alive = false
        }
    }, [])

    return (
        <>
            {screens.map((screen) => (
                <Capture key={screen.id} screen={screen} streams={streams} onClick={(event) => onClick?.({ event, screen })} />
            ))}
        </>
    )
}

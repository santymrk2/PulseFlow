import { useEffect, useState } from "react"
import { BLACKMAGIC } from "../../../../types/Channels"
import { destroy, receive, send } from "../../../utils/request"
import { Center } from "../../system/Center"
import { T } from "../../helpers/T"
import { BMDStream } from "./BMDStream"
import type { InputSelectDetail, Screen } from "./types"

export interface BMDStreamsProps {
    onClick?: (detail: InputSelectDetail) => void
}

// Port de components/drawer/live/BMDStreams.svelte.
export function BMDStreams({ onClick }: BMDStreamsProps) {
    const [sources, setSources] = useState<Screen[]>([])

    useEffect(() => {
        const receiver: Record<string, (msg: string) => void> = {
            GET_DEVICES: (msg) => {
                if (!msg) return
                const list: Screen[] = JSON.parse(msg).map((device: any) => ({
                    id: device.deviceHandle,
                    name: device.displayName || device.modelName
                }))
                // El Svelte ignoraba actualizaciones cuando ya había dispositivos.
                setSources((current) => (current.length ? current : list))
            }
        }
        send(BLACKMAGIC, ["GET_DEVICES"])
        receive(BLACKMAGIC, receiver, "GET_DEVICES_RECEIVER")
        return () => destroy(BLACKMAGIC, "GET_DEVICES_RECEIVER")
    }, [])

    if (!sources.length) {
        return (
            <Center faded>
                <T id="empty.general" />
            </Center>
        )
    }

    return (
        <>
            {sources.map((screen) => (
                <BMDStream key={screen.id} screen={screen} onClick={(event) => onClick?.({ event, screen })} />
            ))}
        </>
    )
}

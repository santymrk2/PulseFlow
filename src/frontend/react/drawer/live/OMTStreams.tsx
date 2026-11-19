import { useEffect, useState } from "react"
import { OMT } from "../../../../types/Channels"
import { destroy, receive, send } from "../../../shared/utils/request"
import { Loader } from "../../main/Loader"
import { T } from "../../helpers/T"
import { Center } from "../../system/Center"
import { OMTStream } from "./OMTStream"
import type { InputSelectDetail, Screen } from "./types"

export interface OMTStreamsProps {
    onClick?: (detail: InputSelectDetail) => void
}

const REFRESH_INTERVAL_MS = 3000

// Port de components/drawer/live/OMTStreams.svelte.
export function OMTStreams({ onClick }: OMTStreamsProps) {
    const [loading, setLoading] = useState(true)
    const [sources, setSources] = useState<Screen[]>([])

    useEffect(() => {
        const receiver = {
            RECEIVE_LIST: (msg: string) => {
                setLoading(false)
                if (!msg) return
                const list: Screen[] = JSON.parse(msg).map(({ name, urlAddress }: { name: string; urlAddress: string }) => ({ name, id: urlAddress }))
                setSources((current) => (JSON.stringify(list) === JSON.stringify(current) ? current : list))
            }
        }
        receive(OMT, receiver, "OMT_CAPTURE")
        return () => destroy(OMT, "OMT_CAPTURE")
    }, [])

    useEffect(() => {
        send(OMT, ["RECEIVE_LIST"], {})
        const interval = setInterval(() => send(OMT, ["RECEIVE_LIST"], {}), REFRESH_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [])

    if (loading) {
        return (
            <Center>
                <Loader />
            </Center>
        )
    }
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
                <OMTStream key={screen.id} screen={screen} onClick={(event) => onClick?.({ event, screen })} />
            ))}
        </>
    )
}

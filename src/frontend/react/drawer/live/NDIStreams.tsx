import { useEffect, useState } from "react"
import { NDI } from "../../../../types/Channels"
import { special } from "../../../shared/core/stores"
import { destroy, receive, send } from "../../../shared/utils/request"
import { Loader } from "../../main/Loader"
import { T } from "../../helpers/T"
import { Center } from "../../system/Center"
import { useStore } from "../../hooks/useStore"
import { NDIStream } from "./NDIStream"
import type { InputSelectDetail, Screen } from "./types"

export interface NDIStreamsProps {
    onClick?: (detail: InputSelectDetail) => void
}

// Port de components/drawer/live/NDIStreams.svelte. Loader es el port React.
export function NDIStreams({ onClick }: NDIStreamsProps) {
    const [loading, setLoading] = useState(true)
    const [sources, setSources] = useState<Screen[]>([])
    const settings = useStore(special)
    const groups = settings?.ndiInputGroups || ""

    useEffect(() => {
        const receiver = {
            RECEIVE_LIST: (msg: string) => {
                setLoading(false)
                if (!msg) return
                const list: Screen[] = JSON.parse(msg).map(({ name, urlAddress }: { name: string; urlAddress: string }) => ({ name, id: urlAddress }))
                setSources((current) => (current.length ? current : list))
            }
        }
        receive(NDI, receiver, "NDI_CAPTURE")
        return () => destroy(NDI, "NDI_CAPTURE")
    }, [])

    // `$: send(NDI, ["RECEIVE_LIST"], { groups })`: se reenvía al cambiar los grupos.
    useEffect(() => {
        send(NDI, ["RECEIVE_LIST"], { groups })
    }, [groups])

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
                <NDIStream key={screen.id} screen={screen} onClick={(event) => onClick?.({ event, screen })} />
            ))}
        </>
    )
}

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { get } from "svelte/store"
import type { ValidChannels } from "../../../../types/Channels"
import type { StreamFrameData } from "../../../utils/streamPort"
import { onStreamFrame } from "../../../utils/streamPort"
import { outputs } from "../../../stores"
import { findMatchingOut } from "../../../components/helpers/output"
import { send } from "../../../utils/request"
import { SelectElem } from "../../system/SelectElem"
import { useStore } from "../../hooks/useStore"
import { Card } from "../Card"
import { StreamCanvasRenderer } from "../../../components/drawer/live/streamCanvas"
import { parseStyle } from "./style"
import type { Screen } from "./types"
import styles from "./StreamFrame.module.css"

// NDIStream.svelte y OMTStream.svelte son idénticos salvo el canal, el icono y el id de SelectElem.
export interface StreamFrameProps {
    channel: ValidChannels
    selectId: "ndi" | "omt"
    icon: "ndi" | "omt"
    screen: Screen
    background?: boolean
    mirror?: boolean
    outputId?: string
    style?: string
    onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

export function StreamFrame({ channel, selectId, icon, screen, background = false, mirror = false, outputId = "", style = "", onClick }: StreamFrameProps) {
    const [loaded, setLoaded] = useState(false)
    const [frame, setFrame] = useState<any>(null)
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
    const outputList = useStore(outputs)
    const renderer = useRef<StreamCanvasRenderer | null>(null)
    const screenRef = useRef(screen)
    screenRef.current = screen

    useEffect(() => {
        const instance = new StreamCanvasRenderer()
        renderer.current = instance
        const stop = onStreamFrame(channel, (data: StreamFrameData) => {
            if (data.id !== screenRef.current.id) return
            setLoaded(true)
            setFrame(data.frame)
        })
        return () => {
            instance.destroy()
            stop()
            renderer.current = null
        }
    }, [channel])

    useEffect(() => {
        const output = outputId || Object.keys(get(outputs))[0]
        if (background) {
            if (!mirror) send(channel, ["CAPTURE_STREAM"], { source: screen, outputId: output })
        } else send(channel, ["RECEIVE_STREAM"], { source: screen })

        return () => {
            if (background && !mirror) send(channel, ["CAPTURE_DESTROY"], { id: screen.id, outputId: output })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (frame && canvas) renderer.current?.draw(canvas, frame)
    }, [frame, canvas])

    const outlineColor = findMatchingOut(screen.id, outputList)

    if (background) return <canvas ref={setCanvas} className={styles.canvas} style={parseStyle(style)} />

    return (
        <Card outlineColor={outlineColor} active={outlineColor !== null} onClick={onClick} title={screen.name} label={screen.name} loaded={loaded} icon={icon} white showPlayOnHover>
            <SelectElem style={{ display: "flex" }} id={selectId} data={{ id: screen.id, type: selectId, name: screen.name }} draggable>
                <canvas ref={setCanvas} className={styles.canvas} />
            </SelectElem>
        </Card>
    )
}

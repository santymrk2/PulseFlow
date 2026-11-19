import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { get } from "../../../shared/core/lib/store"
import { BLACKMAGIC } from "../../../../types/Channels"
import { outputs } from "../../../shared/core/stores"
import { findMatchingOut } from "../../../shared/utils/helpers/output"
import { destroy, receive, send } from "../../../shared/utils/request"
import { SelectElem } from "../../../shared/ui/system/SelectElem"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Card } from "../Card"
import { parseStyle } from "./style"
import type { Screen } from "./types"
import styles from "./BMDStream.module.css"

// Port de components/drawer/live/BMDStream.svelte. El contador de instancias era `<script context="module">`.
let streamInstances = 0

export interface BMDStreamProps {
    screen: Screen
    background?: boolean
    mirror?: boolean
    outputId?: string
    style?: string
    onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

interface BmdFrame {
    width: number
    height: number
    data: Uint8Array | ArrayBuffer
}

export function BMDStream({ screen, background = false, mirror = false, outputId = "", style = "", onClick }: BMDStreamProps) {
    const [loaded, setLoaded] = useState(false)
    const [frame, setFrame] = useState<BmdFrame | null>(null)
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
    const outputList = useStore(outputs)

    // El receiverId se calcula una vez al cargar el componente, como en el Svelte.
    const receiverId = useRef<string>("")
    if (!receiverId.current) receiverId.current = `${screen.id}#${++streamInstances}`
    const screenRef = useRef(screen)
    screenRef.current = screen

    useEffect(() => {
        const receiver: Record<string, (data: any) => void> = {
            RECEIVE_STREAM: (data) => {
                if (data.id !== screenRef.current.id || !data.frame?.video) return
                setLoaded(true)
                setFrame(data.frame.video)
            }
        }
        receive(BLACKMAGIC, receiver, receiverId.current!)
        return () => destroy(BLACKMAGIC, receiverId.current!)
    }, [])

    useEffect(() => {
        const output = outputId || Object.keys(get(outputs))[0]
        if (background) {
            if (!mirror) send(BLACKMAGIC, ["RECEIVE_STREAM"], { source: screen, outputId: output })
        } else send(BLACKMAGIC, ["RECEIVE_FRAME"], { source: screen })

        return () => {
            if (background && !mirror) send(BLACKMAGIC, ["STOP_RECEIVER"], { id: screen.id, outputId: output })
        }
        // Igual que onMount/onDestroy: screen y flags son fijos durante la vida del stream.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!frame || !canvas) return
        const ctx = canvas.getContext("2d")
        canvas.width = frame.width
        canvas.height = frame.height
        ctx?.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0)
    }, [frame, canvas])

    const outlineColor = findMatchingOut(screen.id, outputList)

    if (background) return <canvas ref={setCanvas} className={styles.canvas} style={parseStyle(style)} />

    return (
        <Card outlineColor={outlineColor} active={outlineColor !== null} onClick={onClick} label={screen.name} loaded={loaded} icon="blackmagic" white showPlayOnHover>
            <SelectElem style={{ display: "flex" }} id="blackmagic" data={{ id: screen.id, type: "blackmagic", name: screen.name }} draggable>
                <canvas ref={setCanvas} className={styles.canvas} />
            </SelectElem>
        </Card>
    )
}

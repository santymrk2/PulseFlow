import { useEffect, useRef, useState, type MouseEvent } from "react"
import { get } from "../../../lib/store"
import { uid } from "uid"
import type { AudioRoutingConfig } from "../../../../types/AudioRouting"
import { AudioMicrophone } from "../../../audio/audioMicrophone"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { deduplicateConnections, syncOutputAudioChannels } from "../../../audio/routing/audioRoutingInit"
import { AudioRoutingManager } from "../../../audio/routing/audioRoutingManager"
import { keysToID } from "../../../components/helpers/array"
import { getAllOutputs } from "../../../components/helpers/output"
import { activePopup, audioChannelsData, audioEffects, audioPlaylists, audioRouting, outputs, selected, special } from "../../../stores"
import { newToast } from "../../../utils/common"
import { translateText } from "../../../utils/language"
import { cn } from "../../../lib/utils"
import { Button } from "../../ui/button/Button"
import { AudioRoutingNode } from "./AudioRoutingNode"
import { applyDrop, connectionPath, dragPath, FIXED_INPUTS, FIXED_OUTPUTS, isLineConnectedToPort, isValidConnection, isValidHoverTarget, keepAfterPortContext, lineKey, nodeHue, type AudioDevice, type ColumnType, type HoveredPort, type PortType, type RenderedLine } from "./routingLogic"
import { useFreshStore } from "../../hooks/useFreshStore"
import styles from "./AudioRouting.module.css"

// Port de components/settings/tabs/AudioRouting.svelte (F24.13b).
interface RoutingColumnNode {
    id: string
    name: string
    type: string
    isExpanded?: boolean
    hasSubNodes?: boolean
    subNodes?: RoutingColumnNode[]
    channels?: number
    isEnabled?: boolean
    color?: string
    isMuted?: boolean
    hasEffects?: boolean
    hasInputConnection?: boolean
    icon?: string | null
    onToggleEnabled?: (enabled: boolean) => void
}

interface RoutingColumn {
    title: string
    type: ColumnType
    nodes: RoutingColumnNode[]
}

interface Point {
    x: number
    y: number
}

interface DragState {
    isPanning: boolean
    isConnecting: boolean
    dragStartId: string | null
    dragStartType: ColumnType | null
    dragStartPortType: PortType | null
    dragStartChannelIndex: number | undefined
    dragFromPos: Point
    dragCurrentPos: Point
    hoverTargetId: string | null
    hoverTargetPortEl: HTMLElement | null
    hoverTargetPortType: PortType | null
}

const IDLE_DRAG: DragState = {
    isPanning: false,
    isConnecting: false,
    dragStartId: null,
    dragStartType: null,
    dragStartPortType: null,
    dragStartChannelIndex: undefined,
    dragFromPos: { x: 0, y: 0 },
    dragCurrentPos: { x: 0, y: 0 },
    hoverTargetId: null,
    hoverTargetPortEl: null,
    hoverTargetPortType: null
}

// WIP zoom en el Svelte: la variable existía pero nunca cambiaba (los controles están comentados)
const zoom = 1

const EMPTY_CONFIG: AudioRoutingConfig = { channels: [], connections: [] }

// Copia también las listas que se derivan: Rename/Color mutan `channels[i]` en el lugar
const copyRouting = (value: AudioRoutingConfig | null): AudioRoutingConfig | null => (value ? { ...value, channels: [...(value.channels || [])], connections: [...(value.connections || [])] } : value)

function updateConfig(fn: (c: AudioRoutingConfig) => void) {
    audioRouting.update((c) => {
        const copy: AudioRoutingConfig = {
            ...c,
            channels: [...(c?.channels || [])],
            connections: [...(c?.connections || [])]
        }
        fn(copy)
        copy.connections = deduplicateConnections(copy.connections)
        return copy
    })
}

function sameLines(a: RenderedLine[], b: RenderedLine[]) {
    return a.length === b.length && a.every((l, i) => JSON.stringify(l) === JSON.stringify(b[i]))
}

export function AudioRouting() {
    const routing = useFreshStore(audioRouting, copyRouting)
    const outputsValue = useFreshStore(outputs)
    const playlists = useFreshStore(audioPlaylists)
    const effects = useFreshStore(audioEffects)
    const specialValue = useFreshStore(special)

    const [fixedInputs] = useState(() =>
        FIXED_INPUTS.map((n) => ({
            id: n.id,
            type: n.type,
            name: n.id === "output_window" ? `${translateText("settings.display_settings")} <span style="font-size: 0.75em;opacity: 0.6;">(${translateText("category.videos")})</span>` : translateText(n.nameKey)
        }))
    )
    const [fixedOutputs] = useState(() => FIXED_OUTPUTS.map((n) => ({ id: n.id, type: n.type, name: n.id === "icecast" ? "Icecast" : translateText(n.nameKey) })))

    const [availableAudioInputs, setAvailableAudioInputs] = useState<AudioDevice[]>([])
    const [availableAudioOutputs, setAvailableAudioOutputs] = useState<AudioDevice[]>([])
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set(["output_window", "network_default"]))
    const [lines, setLines] = useState<RenderedLine[]>([])
    const [drag, setDrag] = useState<DragState>(IDLE_DRAG)
    const [hoveredPort, setHoveredPort] = useState<HoveredPort | null>(null)

    const containerEl = useRef<HTMLDivElement>(null)
    const spaceEl = useRef<HTMLDivElement>(null)
    // Los listeners de window y el rAF leen el estado vigente por ref (en Svelte eran variables vivas)
    const dragRef = useRef<DragState>(IDLE_DRAG)
    const devicesRef = useRef<{ inputs: AudioDevice[]; outputs: AudioDevice[] }>({ inputs: [], outputs: [] })
    const configRef = useRef<AudioRoutingConfig>(EMPTY_CONFIG)
    const connectionFrame = useRef<number | null>(null)
    const startPanMouse = useRef<Point>({ x: 0, y: 0 })
    const startScroll = useRef<{ left: number; top: number }>({ left: 0, top: 0 })

    const { isConnecting, isPanning, dragStartId, dragStartType, dragStartPortType, dragFromPos, dragCurrentPos, hoverTargetId, hoverTargetPortType } = drag

    function patchDrag(patch: Partial<DragState>) {
        dragRef.current = { ...dragRef.current, ...patch }
        setDrag(dragRef.current)
    }

    const config = routing || EMPTY_CONFIG
    const channelsList = config.channels || []
    const inactiveOutputIds = keysToID(outputsValue).filter((a) => !a.enabled)

    const availablePlaylists = keysToID(playlists).map((p) => ({
        id: `playlist_sub_${p.id}`,
        name: p.name || p.id,
        type: "playlist"
    }))

    // En el Svelte este `$:` no dependía de nada reactivo: se calculaba una sola vez al crear el componente
    const [nonStageOutputs] = useState(() =>
        getAllOutputs()
            .filter((out) => out && !out.stageOutput)
            .map((out) => ({
                id: `output_win_sub_${out.id}`,
                name: out.name || out.id,
                type: "output_window",
                color: out.color,
                isEnabled: out.enabled
            }))
    )

    const networkOutputWindows = getAllOutputs()
        .filter((out) => out && (out.rtmp || out.webrtc || out.ndi))
        .map((out) => {
            const connId = `network_sub_${out.id}`
            return {
                id: connId,
                name: out.name || out.id,
                type: "network",
                icon: out.ndi ? "ndi" : "broadcast",
                color: out.color,
                isEnabled: out.enabled,
                hasInputConnection: config.connections.some((c) => c.to === connId)
            }
        })

    function toggleDesktopAudio(enabled: boolean) {
        updateConfig((c) => {
            c.desktopAudioEnabled = enabled
        })
    }

    const columns: RoutingColumn[] = [
        {
            title: "audio.inputs",
            type: "input",
            nodes: fixedInputs.map((node) => {
                const subNodes: RoutingColumnNode[] =
                    node.id === "playlists_default"
                        ? availablePlaylists
                        : node.id === "mic_default"
                          ? availableAudioInputs.map((mic) => {
                                const micDeviceId = mic.value.startsWith("mic_sub_") ? mic.value.slice(8) : mic.value
                                const configured = config?.inputs?.find((i) => i.id === mic.value || i.id === micDeviceId || i.deviceId === micDeviceId)
                                return {
                                    id: mic.value,
                                    name: mic.label,
                                    type: "mic",
                                    channels: configured?.channels ?? mic.channels
                                }
                            })
                          : node.id === "output_window"
                            ? nonStageOutputs
                            : []
                const isEnabled = node.type === "desktop_audio" ? !!config.desktopAudioEnabled : true
                return {
                    ...node,
                    isEnabled,
                    isExpanded: expandedNodes.has(node.id) || node.id === "output_window",
                    hasSubNodes: subNodes.length > 0,
                    subNodes,
                    onToggleEnabled: node.type === "desktop_audio" ? toggleDesktopAudio : undefined
                }
            })
        },
        {
            title: "audio.channels",
            type: "channel",
            nodes: channelsList.map((m) => {
                const inactive = inactiveOutputIds.some((a) => `channel_${a.id}` === m.id)
                const linkedToOutput = m.outputLink || outputsValue[m.id.replace("channel_", "")]
                const chData = get(audioChannelsData)[m.id]
                const isMuted = chData ? chData.isMuted || chData.volume === 0 : false
                const hasEffects = (effects[m.id]?.stack?.length ?? 0) > 0

                return {
                    id: m.id,
                    name: m.name,
                    type: "channel",
                    color: m.color,
                    icon: m.id === "main" ? "protected" : linkedToOutput ? "display" : null,
                    isEnabled: !inactive,
                    isMuted,
                    hasEffects,
                    hasInputConnection: config.connections.some((c) => c.to === m.id)
                }
            })
        },
        {
            title: "audio.outputs",
            type: "output",
            nodes: fixedOutputs.map((node) => {
                const subNodes: RoutingColumnNode[] =
                    node.id === "speaker_default"
                        ? availableAudioOutputs.map((s) => ({
                              id: `speaker_sub_${s.value}`,
                              name: s.label,
                              type: "speaker",
                              channels: s.channels,
                              hasInputConnection: config.connections.some((c) => c.to === `speaker_sub_${s.value}`)
                          }))
                        : node.id === "network_default"
                          ? networkOutputWindows
                          : []

                const isEnabled = node.id === "icecast" ? (specialValue.icecast?.enabled ?? true) : true

                return {
                    ...node,
                    isEnabled,
                    isExpanded: expandedNodes.has(node.id) || node.id === "network_default",
                    hasSubNodes: subNodes.length > 0,
                    subNodes,
                    hasInputConnection: config.connections.some((c) => c.to === node.id)
                }
            })
        }
    ]

    const activeHoverPort: HoveredPort | null = isConnecting ? (dragStartId && dragStartPortType ? { nodeId: dragStartId, portType: dragStartPortType } : null) : hoveredPort

    const sortedLines = activeHoverPort
        ? [...lines].sort((a, b) => {
              const aHigh = isLineConnectedToPort(a, activeHoverPort)
              const bHigh = isLineConnectedToPort(b, activeHoverPort)
              return aHigh === bHigh ? 0 : aHigh ? 1 : -1
          })
        : lines

    useEffect(() => {
        configRef.current = config
        devicesRef.current = { inputs: availableAudioInputs, outputs: availableAudioOutputs }
    })

    function getNodePortPos(nodeId: string, portType: PortType, portElement?: HTMLElement | null): Point | null {
        const space = spaceEl.current
        if (!space) return null
        const portEl = portElement || space.querySelector<HTMLElement>(`[data-node-id="${nodeId}"] .port-${portType}`)
        if (!portEl) return null

        const spaceRect = space.getBoundingClientRect()
        const portRect = portEl.getBoundingClientRect()
        return {
            x: (portRect.left + portRect.width / 2 - spaceRect.left) / zoom,
            y: (portRect.top + portRect.height / 2 - spaceRect.top) / zoom
        }
    }

    function updateConnectionLines() {
        const space = spaceEl.current
        if (!space) return
        const newLines: RenderedLine[] = []

        for (const conn of configRef.current.connections) {
            const isMicSub = conn.from.startsWith("mic_sub_")
            const fromChIdx = conn.fromChannelIndex ?? (isMicSub ? conn.channelIndex : undefined)
            let fromPos: Point | null = null

            if (isMicSub && fromChIdx !== undefined) {
                const chEl = space.querySelector<HTMLElement>(`[data-node-id="${conn.from}"] .port-out[data-ch-index="${fromChIdx}"]`)
                if (chEl) fromPos = getNodePortPos(conn.from, "out", chEl)
            }
            fromPos ??= getNodePortPos(conn.from, "out")

            const isSpeakerSub = conn.to.startsWith("speaker_sub_")
            const isSidechain = conn.type === "sidechain"
            let toPos: Point | null = null

            if (isSidechain) {
                toPos = getNodePortPos(conn.to, "sidechain")
            } else if (isSpeakerSub && conn.channelIndex !== undefined) {
                const chEl = space.querySelector<HTMLElement>(`[data-node-id="${conn.to}"] [data-ch-index="${conn.channelIndex}"]`)
                if (chEl) toPos = getNodePortPos(conn.to, "in", chEl)
            }
            toPos ??= getNodePortPos(conn.to, "in")

            if (fromPos && toPos) {
                newLines.push({
                    fromId: conn.from,
                    toId: conn.to,
                    channelIndex: conn.channelIndex ?? fromChIdx ?? 0,
                    fromChannelIndex: fromChIdx,
                    toChannelIndex: conn.toChannelIndex ?? (isSpeakerSub ? conn.channelIndex : undefined),
                    type: conn.type || "audio",
                    x1: fromPos.x,
                    y1: fromPos.y,
                    x2: toPos.x,
                    y2: toPos.y
                })
            }
        }
        // Mismas líneas: no se vuelve a renderizar (evita el bucle efecto -> estado -> efecto)
        setLines((previous) => (sameLines(previous, newLines) ? previous : newLines))
    }

    function requestUpdateConnectionLines() {
        if (connectionFrame.current !== null) return
        connectionFrame.current = requestAnimationFrame(() => {
            connectionFrame.current = null
            updateConnectionLines()
        })
    }

    async function refreshDevices() {
        const outs = await AudioPlayer.getOutputs()
        devicesRef.current = { ...devicesRef.current, outputs: outs }
        setAvailableAudioOutputs(outs)
        try {
            const ins = await AudioMicrophone.getInputs()
            devicesRef.current = { ...devicesRef.current, inputs: ins }
            setAvailableAudioInputs(ins)
        } catch (e) {
            console.warn("Could not enumerate audio inputs:", e)
        }
    }

    useEffect(() => {
        syncOutputAudioChannels()
        audioRouting.update((a) => a && AudioRoutingManager.sortChannels(a))
        refreshDevices()

        navigator.mediaDevices.addEventListener("devicechange", refreshDevices)
        const resizeObs = new ResizeObserver(requestUpdateConnectionLines)
        const container = containerEl.current

        if (spaceEl.current) resizeObs.observe(spaceEl.current)
        if (container) container.addEventListener("scroll", requestUpdateConnectionLines)

        return () => {
            navigator.mediaDevices.removeEventListener("devicechange", refreshDevices)
            resizeObs.disconnect()
            if (container) container.removeEventListener("scroll", requestUpdateConnectionLines)
            if (connectionFrame.current !== null) cancelAnimationFrame(connectionFrame.current)
        }
    }, [])

    // `$: if (config || expandedNodes || zoom || …) tick().then(requestUpdateConnectionLines)`; el efecto corre ya con el DOM puesto
    useEffect(() => {
        requestUpdateConnectionLines()
    }, [config, expandedNodes, nonStageOutputs, networkOutputWindows, availablePlaylists, columns, specialValue])

    // Mientras se arrastra (conexión o paneo) los listeners de window viven; se quitan al soltar o al desmontar
    const listening = isConnecting || isPanning
    useEffect(() => {
        if (!listening) return

        function onMove(e: globalThis.MouseEvent) {
            const space = spaceEl.current
            if (!space) return
            const spaceRect = space.getBoundingClientRect()
            const state = dragRef.current

            if (state.isConnecting) {
                patchDrag({ dragCurrentPos: { x: (e.clientX - spaceRect.left) / zoom, y: (e.clientY - spaceRect.top) / zoom } })
            } else if (state.isPanning && containerEl.current) {
                containerEl.current.scrollLeft = startScroll.current.left - (e.clientX - startPanMouse.current.x)
                containerEl.current.scrollTop = startScroll.current.top - (e.clientY - startPanMouse.current.y)
            }
        }

        function onUp() {
            const state = dragRef.current

            if (state.isConnecting && state.hoverTargetId && state.dragStartId && state.dragStartId !== state.hoverTargetId) {
                const { valid, from: fromId, to: toId } = isValidConnection(state.dragStartId, state.hoverTargetId, { channelIds: configRef.current.channels.map((m) => m.id), dragStartPortType: state.dragStartPortType, hoverTargetPortType: state.hoverTargetPortType })

                if (valid) {
                    const isSidechain = state.dragStartPortType === "sidechain" || state.hoverTargetPortType === "sidechain"
                    const dragStartId = state.dragStartId
                    updateConfig((c) => applyDrop(c, { fromId, toId, isSidechain, dragStartId, dragStartChannelIndex: state.dragStartChannelIndex, hoverTargetId: state.hoverTargetId, hoverChIndex: state.hoverTargetPortEl?.dataset?.chIndex, availableInputs: devicesRef.current.inputs, availableOutputs: devicesRef.current.outputs, notify: newToast }))
                }
            }

            startPanMouse.current = { x: 0, y: 0 }
            startScroll.current = { left: 0, top: 0 }
            patchDrag(IDLE_DRAG)
        }

        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
        return () => {
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
    }, [listening])

    function toggleExpand(id: string) {
        setExpandedNodes((previous) => {
            const next = new Set(previous)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function addChannel() {
        const id = `channel_${uid()}`
        updateConfig((c) => {
            const list = c.channels || []
            list.push({ id, name: `${translateText("midi.channel")} ${list.length + 1}` })
            c.channels = list
        })
        selected.set({ id: "audio_channel", data: [{ id }] })
        activePopup.set("rename")
    }

    function handlePortMouseDown(e: MouseEvent<HTMLElement>, nodeId: string, nodeType: ColumnType, portType: PortType, channelIndex = 0) {
        e.preventDefault()
        e.stopPropagation()
        const pos = getNodePortPos(nodeId, portType, e.currentTarget)
        patchDrag({ isConnecting: true, dragStartId: nodeId, dragStartType: nodeType, dragStartPortType: portType, dragStartChannelIndex: channelIndex, ...(pos ? { dragFromPos: pos, dragCurrentPos: pos } : {}) })
    }

    function handleContainerMouseDown(e: MouseEvent<HTMLDivElement>) {
        if (e.button !== 0 && e.button !== 1) return
        if ((e.target as HTMLElement).closest(".node-card, .port, button, input, .dropdown")) return
        const container = containerEl.current
        if (!container) return

        startPanMouse.current = { x: e.clientX, y: e.clientY }
        startScroll.current = { left: container.scrollLeft, top: container.scrollTop }
        patchDrag({ isPanning: true })
    }

    function removeConnection(fromId: string, toId: string, type?: "audio" | "sidechain") {
        updateConfig((c) => {
            c.connections = c.connections.filter((conn) => {
                if (conn.from === fromId && conn.to === toId) {
                    if (type && (conn.type || "audio") !== type) return true
                    return false
                }
                return true
            })
        })
    }

    function handlePortContextMenu(e: MouseEvent<HTMLElement>, nodeId: string, portType: PortType, channelIndex = 0) {
        e.preventDefault()
        e.stopPropagation()

        updateConfig((c) => {
            c.connections = c.connections.filter((conn) => keepAfterPortContext(conn, nodeId, portType, channelIndex))
        })
    }

    function handleNodeMouseEnter(nodeId: string, columnType: ColumnType) {
        const state = dragRef.current
        if (!state.isConnecting || nodeId === state.dragStartId) return

        if (isValidHoverTarget(nodeId, columnType, state.dragStartType, state.dragStartPortType)) {
            patchDrag({ hoverTargetId: nodeId, hoverTargetPortEl: null, hoverTargetPortType: null })
        }
    }

    function handleNodeMouseLeave(nodeId: string) {
        if (dragRef.current.hoverTargetId === nodeId) {
            patchDrag({ hoverTargetId: null, hoverTargetPortEl: null, hoverTargetPortType: null })
        }
    }

    function handlePortMouseEnter(e: MouseEvent<HTMLElement>, portType: PortType = "in") {
        if (dragRef.current.isConnecting) {
            patchDrag({ hoverTargetPortEl: e.currentTarget, hoverTargetPortType: portType })
        }
    }

    function handlePortMouseLeave() {
        patchDrag({ hoverTargetPortEl: null, hoverTargetPortType: null })
    }

    // Nodo de origen de una línea / del arrastre, su posición en la columna y el tono derivado
    function findSource(id: string) {
        const col = columns.find((c) => c.nodes.some((n) => n.id === id || (n.subNodes || []).some((s) => s.id === id)))
        const colNodes = (col?.nodes || []).flatMap((n) => [n, ...(n.subNodes || [])])
        return { node: colNodes.find((n) => n.id === id), index: colNodes.findIndex((n) => n.id === id) }
    }

    function renderLine(line: RenderedLine) {
        const { node: sourceNode, index } = findSource(line.fromId)
        const strokeColor = line.type === "sidechain" ? "#f59e0b" : sourceNode?.color || `hsl(${nodeHue(index)}, 80%, 65%)`
        const isDisabled = sourceNode?.isEnabled === false
        const isHighlighted = isLineConnectedToPort(line, activeHoverPort)
        const isDimmed = activeHoverPort !== null && !isHighlighted
        const isSidechain = line.type === "sidechain"

        return <path key={lineKey(line)} d={connectionPath(line)} stroke={strokeColor} className={cn(styles["connection-path"], isSidechain && styles["sidechain-path"], isDisabled && styles.disabled, isHighlighted && styles.highlighted, isDimmed && styles.dimmed)} style={isHighlighted ? { zIndex: 10 } : isDimmed ? { zIndex: 1 } : isSidechain ? { zIndex: 4 } : undefined} onDoubleClick={() => removeConnection(line.fromId, line.toId, line.type)} />
    }

    function renderDragPath() {
        if (!isConnecting || !dragStartId) return null
        const { node: dragSourceNode, index } = findSource(dragStartId)
        const isDragSidechain = dragStartPortType === "sidechain" || hoverTargetPortType === "sidechain"
        const dragColor = isDragSidechain ? "#f59e0b" : dragSourceNode?.color || `hsl(${nodeHue(index)}, 80%, 65%)`
        return <path d={dragPath(dragFromPos, dragCurrentPos, dragStartPortType)} stroke={dragColor} className={styles["drag-path"]} style={isDragSidechain ? { zIndex: 5 } : undefined} />
    }

    function renderNode(column: RoutingColumn, node: RoutingColumnNode) {
        const colNodes = column.nodes.flatMap((n) => [n, ...(n.subNodes || [])])
        const nodeIndex = colNodes.findIndex((n) => n.id === node.id)
        const autoColor = `hsl(${nodeHue(nodeIndex)}, 80%, 65%)`
        const visibleSubNodes = node.subNodes ? (node.isExpanded ? node.subNodes : node.subNodes.filter((sub) => config.connections.some((c) => c.from === sub.id || c.to === sub.id))) : []

        if (node.isExpanded && (!node.subNodes || node.subNodes.length === 0)) return null

        return (
            <div key={node.id} className={cn(styles["node-card-group"], node.hasSubNodes && "has-subnodes")}>
                <AudioRoutingNode
                    id={node.id}
                    name={node.name}
                    type={node.type}
                    icon={node.icon}
                    color={node.color}
                    isEnabled={node.isEnabled}
                    isExpanded={node.isExpanded}
                    hasSubNodes={node.hasSubNodes}
                    channels={node.channels}
                    isMuted={node.isMuted}
                    hasEffects={node.hasEffects}
                    hasInputConnection={node.hasInputConnection}
                    onToggleEnabled={node.onToggleEnabled}
                    autoColor={autoColor}
                    nodeType={column.type}
                    hoverTargetId={hoverTargetId}
                    isConnecting={isConnecting}
                    dragStartId={dragStartId}
                    dragStartType={dragStartType}
                    dragStartPortType={dragStartPortType}
                    onToggleExpand={() => toggleExpand(node.id)}
                    onMouseDown={(e, portType, chIdx) => handlePortMouseDown(e, node.id, column.type, portType, chIdx)}
                    onMouseEnter={() => handleNodeMouseEnter(node.id, column.type)}
                    onMouseLeave={() => handleNodeMouseLeave(node.id)}
                    onMouseEnterPort={(e, portType = "in") => handlePortMouseEnter(e, portType)}
                    onMouseLeavePort={handlePortMouseLeave}
                    onHoverPort={(_e, portType, chIdx) => setHoveredPort({ nodeId: node.id, portType, channelIndex: chIdx })}
                    onHoverPortEnd={() => setHoveredPort(null)}
                    onPortContextMenu={(e, portType, chIdx) => handlePortContextMenu(e, node.id, portType, chIdx)}
                />

                {visibleSubNodes.length > 0 ? (
                    <div className={cn(styles["sub-nodes-list"], column.type === "input" && styles.input, column.type === "output" && styles.output)}>
                        {visibleSubNodes.map((sub) => {
                            const subIndex = colNodes.findIndex((n) => n.id === sub.id)
                            return (
                                <AudioRoutingNode
                                    key={sub.id}
                                    id={sub.id}
                                    name={sub.name}
                                    type={sub.type}
                                    icon={sub.icon}
                                    color={sub.color}
                                    isEnabled={sub.isEnabled}
                                    channels={sub.channels}
                                    hasInputConnection={sub.hasInputConnection}
                                    autoColor={`hsl(${nodeHue(subIndex)}, 80%, 65%)`}
                                    nodeType={column.type}
                                    isSubNode={true}
                                    hoverTargetId={hoverTargetId}
                                    isConnecting={isConnecting}
                                    dragStartId={dragStartId}
                                    dragStartType={dragStartType}
                                    dragStartPortType={dragStartPortType}
                                    onMouseDown={(e, portType, chIdx) => handlePortMouseDown(e, sub.id, column.type, portType, chIdx)}
                                    onMouseEnter={() => handleNodeMouseEnter(sub.id, column.type)}
                                    onMouseLeave={() => handleNodeMouseLeave(sub.id)}
                                    onMouseEnterPort={(e, portType = "in") => {
                                        if (dragRef.current.isConnecting) {
                                            patchDrag({ hoverTargetId: sub.id })
                                            handlePortMouseEnter(e, portType)
                                        }
                                    }}
                                    onMouseLeavePort={handlePortMouseLeave}
                                    onHoverPort={(_e, portType, chIdx) => setHoveredPort({ nodeId: sub.id, portType, channelIndex: chIdx })}
                                    onHoverPortEnd={() => setHoveredPort(null)}
                                    onPortContextMenu={(e, portType, chIdx) => handlePortContextMenu(e, sub.id, portType, chIdx)}
                                />
                            )
                        })}
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <div className={styles["audio-routing-wrapper"]}>
            {/* MAIN OVERFLOW CONTAINER & CHECKERED CANVAS */}
            <div className={cn(styles["routing-container"], "checkered", isPanning && styles["is-panning"])} ref={containerEl} onMouseDown={handleContainerMouseDown}>
                <div className={styles["routing-space"]} ref={spaceEl} style={{ transform: `scale(${zoom})`, transformOrigin: "0 0", width: `${100 / zoom}%`, minHeight: `${100 / zoom}%` }}>
                    {/* SVG Connections Layer */}
                    <svg className={styles["connections-layer"]}>
                        {sortedLines.map(renderLine)}
                        {renderDragPath()}
                    </svg>

                    {/* Nodes Grid Inside Moveable Space */}
                    <div className={styles["nodes-grid"]}>
                        {columns.map((column) => (
                            <div key={column.title} className={styles["space-column"]}>
                                <div className={styles["column-title"]}>
                                    <h3>{translateText(column.title)}</h3>
                                </div>

                                <div className={styles["nodes-list"]}>
                                    {column.nodes.map((node) => renderNode(column, node))}

                                    {column.type === "channel" ? <Button variant="outline" icon="add" onClick={addChannel} white /> : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
